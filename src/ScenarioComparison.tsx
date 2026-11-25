import {useMemo, useRef, useState} from 'react';
import Papa from 'papaparse';
import {calculate, fmt, normalized, tierCutoffs, type Indicator, type Watershed} from './engine';
import {compareRankings, groups, summarize, type Comparison} from './scenario';
import ScenarioMap, {ComparisonDetails, type CameraGroup} from './ScenarioMap';

const columns = [
  ['id', 'Watershed ID'], ['wmz', 'WMZ'], ['baselineScore', 'Baseline score'],
  ['alternativeScore', 'Alternative score'], ['scoreChange', 'Score change'],
  ['baselineRank', 'Baseline rank'], ['alternativeRank', 'Alternative rank'],
  ['improvement', 'Ranking improvement'], ['baselineTop', 'Baseline top priority'],
  ['alternativeTop', 'Alternative top priority'], ['group', 'Priority group change'],
] as const satisfies ReadonlyArray<readonly [keyof Comparison, string]>;
const pageSize = 25;

function csv(name: string, rows: object[]) {
  const url = URL.createObjectURL(new Blob([Papa.unparse(rows)], {type: 'text/csv;charset=utf-8'}));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function display(row: Comparison, key: keyof Comparison) {
  const value = row[key];
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string') return value;
  const sign = value !== null && value > 0 && (key === 'improvement' || key === 'scoreChange') ? '+' : '';
  return sign + fmt(value, ['baselineScore', 'alternativeScore', 'scoreChange'].includes(key) ? 5 : 0);
}

export default function ScenarioComparison({population, defaults, geo, wmz}: {
  population: Watershed[]; defaults: Indicator[];
  geo: React.ComponentProps<typeof ScenarioMap>['geo']; wmz: React.ComponentProps<typeof ScenarioMap>['wmz'];
}) {
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [weightError, setWeightError] = useState('');
  const [cutoff, setCutoff] = useState(5);
  const [selected, setSelected] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [zone, setZone] = useState('');
  const [group, setGroup] = useState('');
  const [move, setMove] = useState('');
  const [sort, setSort] = useState<{key: keyof Comparison; descending: boolean}>({key: 'baselineRank', descending: false});
  const [page, setPage] = useState(0);
  const cameras = useRef<CameraGroup>(new Set());
  const alternative = useMemo(() => defaults.map(criterion => {
    const weight = overrides[criterion.id] ?? (criterion.include ? criterion.weight : 0);
    return {...criterion, weight, include: weight > 0};
  }), [defaults, overrides]);
  const baselineRanked = useMemo(() => calculate(population, defaults), [population, defaults]);
  const alternativeRanked = useMemo(() => calculate(population, alternative), [population, alternative]);
  const rows = useMemo(() => compareRankings(baselineRanked, alternativeRanked, cutoff), [baselineRanked, alternativeRanked, cutoff]);
  const stats = useMemo(() => summarize(rows), [rows]);
  const baselineWeights = normalized(defaults);
  const alternativeWeights = normalized(alternative);
  const tableRows = useMemo(() => rows.filter(row => {
    const delta = row.improvement;
    return (!zone || row.wmz === zone) && (!group || row.group === group) &&
      (!move || (delta !== null && (move === 'up' ? delta > 0 : move === 'down' ? delta < 0 : delta === 0))) &&
      (!query.trim() || `${row.id} ${row.wmz}`.toLowerCase().includes(query.trim().toLowerCase()));
  }).sort((a, b) => {
    const x = a[sort.key], y = b[sort.key];
    if (x === null || y === null) return Number(x === null) - Number(y === null) || a.id - b.id;
    const order = typeof x === 'string' ? x.localeCompare(String(y)) : Number(x) - Number(y);
    return (sort.descending ? -order : order) || a.id - b.id;
  }), [rows, query, zone, group, move, sort]);
  const last = Math.max(0, Math.ceil(tableRows.length / pageSize) - 1);
  const current = Math.min(page, last);
  const focused = rows.find(row => row.id === selected);
  const metrics = [
    ['Watersheds analyzed', fmt(rows.length, 0)], ['Baseline top priority', fmt(stats.baselineTop, 0)],
    ['Alternative top priority', fmt(stats.alternativeTop, 0)], ['Consistently high priority', fmt(stats.retained, 0)],
    ['Newly selected', fmt(stats.newly, 0)], ['Dropped out', fmt(stats.dropped, 0)],
    ['Baseline top priority retained', stats.retention === null ? '—' : `${fmt(stats.retention * 100, 1)}%`],
    ['Average absolute rank change', fmt(stats.averageChange, 2)], ['Spearman rank correlation', fmt(stats.correlation, 3)],
  ];

  function changeWeight(id: string, value: number) {
    if (!Number.isFinite(value) || value < 0) return;
    if (!value && !alternative.some(item => item.id !== id && item.weight > 0)) {
      setWeightError('Keep at least one positive alternative weight.');
      return;
    }
    setWeightError('');
    setOverrides(previous => ({...previous, [id]: value}));
  }

  return <div className="scenario">
    <p>The Scenario Comparison feature allows users to assess how changes in criteria weights influence watershed prioritization. Watersheds that remain highly ranked under different weighting schemes may represent more robust investment priorities.</p>
    <section className="panel">
      <div className="section-title"><h2>Compare priorities</h2><label>Top-priority threshold{' '}
        <select value={cutoff} onChange={e => setCutoff(Number(e.target.value))}>{tierCutoffs.map(value =>
          <option value={value} key={value}>Top {value}%</option>)}</select>
      </label></div>
      <p>Both scenarios use the analysis scope above. The baseline keeps the original weights. Ties at the cutoff are included.</p>
      <dl className="scenario-metrics">{metrics.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    </section>
    <details className="panel scenario-weights" open>
      <summary>Criteria weights</summary>
      <div className="scenario-actions">
        <p>Enter relative weights for the alternative. The tool normalizes them to 100% and keeps the original scoring directions.</p>
        <button onClick={() => {setOverrides({}); setWeightError('');}}>Reset to Default Weights</button>
        <button onClick={() => csv('Uganda-IPT-scenario-criteria-weights.csv', alternative.map(item => ({
          Criterion: item.name, Direction: item.direction, 'Baseline weight (%)': baselineWeights[item.id] * 100,
          'Alternative relative weight': item.weight, 'Alternative weight (%)': alternativeWeights[item.id] * 100,
          'Change (pp)': (alternativeWeights[item.id] - baselineWeights[item.id]) * 100,
        })))}>Download weights CSV</button>
      </div>
      {weightError && <p className="warning" role="alert">{weightError}</p>}
      <div className="table-scroll scenario-weight-scroll"><table>
        <thead><tr><th>Criterion</th><th>Original weight (%)</th><th>Alternative input</th><th>Revised weight (%)</th><th>Change (pp)</th></tr></thead>
        <tbody>{alternative.map(item => {
          const delta = (alternativeWeights[item.id] - baselineWeights[item.id]) * 100;
          return <tr key={item.id}><td>{item.name} <small>{item.direction === 'higher' ? 'Higher values prioritized' : 'Lower values prioritized'}</small></td>
            <td>{fmt(baselineWeights[item.id] * 100)}%</td>
            <td><input type="number" min="0" step="0.05" aria-label={`Alternative weight for ${item.name}`}
              value={item.weight} onChange={e => changeWeight(item.id, Number(e.target.value))}/></td>
            <td>{fmt(alternativeWeights[item.id] * 100)}%</td><td>{delta > 0 ? '+' : ''}{fmt(delta)}</td></tr>;
        })}</tbody>
      </table></div>
    </details>
    <div className="scenario-map-grid">
      <ScenarioMap title="Baseline prioritization" mode="baseline" {...{geo, wmz, rows, cutoff, selected}} onSelect={setSelected} cameras={cameras.current}/>
      <ScenarioMap title="Alternative prioritization" mode="alternative" {...{geo, wmz, rows, cutoff, selected}} onSelect={setSelected} cameras={cameras.current}/>
    </div>
    <section className="panel" aria-live="polite">
      <h3>Selected watershed</h3>
      {focused ? <ComparisonDetails row={focused}/> : <p>Select a watershed on a map or in the comparison table.</p>}
    </section>
    <div className="scenario-map-grid">
      <ScenarioMap title="Ranking Change" mode="movement" {...{geo, wmz, rows, cutoff, selected}} onSelect={setSelected}/>
      <ScenarioMap title="Top-priority watershed comparison" mode="membership" {...{geo, wmz, rows, cutoff, selected}} onSelect={setSelected}/>
    </div>
    <section className="panel">
      <div className="section-title"><h2>Watershed comparison</h2>
        <button onClick={() => csv('Uganda-IPT-scenario-comparison.csv', tableRows.map(row => ({
          ...Object.fromEntries(columns.map(([key, label]) => [label, row[key]])), 'Top-priority threshold (%)': cutoff,
        })))}>Download filtered results CSV</button>
      </div>
      <div className="scenario-actions">
        <label>Search watersheds<input type="search" value={query} onChange={e => {setQuery(e.target.value); setPage(0);}}/></label>
        <label>Table WMZ<select value={zone} onChange={e => {setZone(e.target.value); setPage(0);}}><option value="">All zones</option>
          {[...new Set(rows.map(row => row.wmz))].sort().map(value => <option key={value}>{value}</option>)}</select></label>
        <label>Priority group change<select value={group} onChange={e => {setGroup(e.target.value); setPage(0);}}>
          <option value="">All groups</option>{groups.map(value => <option key={value}>{value}</option>)}</select></label>
        <label>Rank movement<select value={move} onChange={e => {setMove(e.target.value); setPage(0);}}>
          <option value="">Any movement</option><option value="up">Improved</option><option value="down">Declined</option><option value="same">No change</option></select></label>
      </div>
      <p>Ranking improvement equals baseline rank minus alternative rank. Positive values indicate higher priority. Score change is alternative minus baseline.</p>
      <div className="table-scroll"><table>
        <thead><tr>{columns.map(([key, name]) => <th key={key} aria-sort={sort.key === key ? (sort.descending ? 'descending' : 'ascending') : 'none'}>
          <button onClick={() => {setSort({key, descending: sort.key === key && !sort.descending}); setPage(0);}}>{name}{sort.key === key ? (sort.descending ? ' ↓' : ' ↑') : ''}</button>
        </th>)}</tr></thead>
        <tbody>{tableRows.slice(current * pageSize, (current + 1) * pageSize).map(row => <tr key={row.id}>
          {columns.map(([key]) => <td key={key}>{key === 'id' ? <button aria-pressed={row.id === selected} onClick={() => setSelected(row.id)}>#{row.id}</button> : display(row, key)}</td>)}
        </tr>)}</tbody>
      </table></div>
      <div className="scenario-actions">
        <span>{tableRows.length ? `${current * pageSize + 1}–${Math.min((current + 1) * pageSize, tableRows.length)} of ${fmt(tableRows.length, 0)}` : 'No watersheds match the table filters.'}</span>
        <button disabled={!current} onClick={() => setPage(current - 1)}>Previous</button>
        <button disabled={current >= last} onClick={() => setPage(current + 1)}>Next</button>
      </div>
    </section>
  </div>;
}
