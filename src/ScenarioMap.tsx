import {useEffect, useRef, useState} from 'react';
import maplibre, {type ExpressionSpecification} from 'maplibre-gl';
import {fmt} from './engine';
import {type Comparison} from './scenario';

export type MapMode = 'baseline' | 'alternative' | 'movement' | 'membership';
export type CameraGroup = Set<maplibre.Map>;
type FeatureCollection = Exclude<maplibre.GeoJSONSourceSpecification['data'], string>;
const priorityPaint: ExpressionSpecification = ['interpolate', ['linear'], ['number', ['feature-state', 'score'], 0],
  0, '#d9e7d3', 0.25, '#abc8a0', 0.5, '#6f9d73', 0.75, '#367453', 1, '#124733'];
const changeColors = [
  ['Improved', '#28734e'], ['Declined', '#b84747'], ['No change', '#919ba2'],
] as const;
const groupColors = [
  ['Consistently high priority', '#235c43'], ['Newly selected', '#267a9a'],
  ['Dropped out', '#af632e'], ['Not selected', '#c1c8c9'],
] as const;
const legends = {movement: changeColors, membership: groupColors};
const unavailableColor = '#e0e6e6';

export function ComparisonDetails({row}: {row: Comparison}) {
  return <div className="scenario-detail">
    <strong>Watershed #{row.id}</strong> · {row.wmz}
    <div>Baseline score {fmt(row.baselineScore, 5)} · Rank {fmt(row.baselineRank, 0)}</div>
    <div>Alternative score {fmt(row.alternativeScore, 5)} · Rank {fmt(row.alternativeRank, 0)}</div>
    <div>Ranking change {row.improvement === null ? '—' : row.improvement > 0 ? `+${row.improvement} (improved)` : row.improvement < 0 ? `${row.improvement} (declined)` : '0 (unchanged)'}</div>
  </div>;
}

export default function ScenarioMap({title, mode, geo, wmz, rows, cutoff, selected, onSelect, cameras}: {
  title: string; mode: MapMode; geo: FeatureCollection; wmz: FeatureCollection; rows: Comparison[];
  cutoff: number; selected: number | null; onSelect: (id: number) => void; cameras?: CameraGroup;
}) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<maplibre.Map | null>(null);
  const rowIndex = useRef(new Map<number, Comparison>());
  const [ready, setReady] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);
  const [legendFilter, setLegendFilter] = useState<string | null>(null);
  const entries = mode === 'baseline' || mode === 'alternative' ? null : legends[mode];

  useEffect(() => {
    let m: maplibre.Map;
    try {
      m = new maplibre.Map({container: host.current!, center: [32.3, 1.4], zoom: 5.5,
        maxPitch: 0, dragRotate: false, renderWorldCopies: false, style: {version: 8, sources: {}, layers: [
          {id: 'background', type: 'background', paint: {'background-color': '#edf2ed'}},
        ]}});
    } catch {
      setUnavailable(true);
      return;
    }
    map.current = m;
    m.addControl(new maplibre.NavigationControl({showCompass: false}), 'top-right');
    m.on('load', () => {
      const colors: ExpressionSpecification = entries
        ? ['match', ['string', ['feature-state', 'category'], ''], entries[0][0], entries[0][1], ...entries.slice(1).flatMap(([label, color]) => [label, color]), unavailableColor]
        : ['case', ['boolean', ['feature-state', 'scored'], false], priorityPaint, unavailableColor];
      m.addSource('watersheds', {type: 'geojson', data: geo, promoteId: 'Lev12_ID'});
      m.addSource('wmz', {type: 'geojson', data: wmz});
      m.addLayer({id: 'watersheds', type: 'fill', source: 'watersheds', paint: {'fill-color': colors, 'fill-opacity': 0.88}});
      m.addLayer({id: 'boundaries', type: 'line', source: 'watersheds', paint: {'line-color': '#f5f7ed', 'line-width': 0.45}});
      m.addLayer({id: 'wmz', type: 'line', source: 'wmz', paint: {'line-color': '#294f68', 'line-width': 1.3, 'line-dasharray': [3, 2]}});
      m.addLayer({id: 'priority', type: 'line', source: 'watersheds', paint: {
        'line-color': '#dbad4c', 'line-width': ['case', ['boolean', ['feature-state', 'top'], false], 1.5, 0],
      }});
      m.addLayer({id: 'selected', type: 'line', source: 'watersheds', paint: {
        'line-color': '#db5b30', 'line-width': ['case', ['boolean', ['feature-state', 'selected'], false], 2.7, 0],
      }});
      const initial = cameras?.values().next().value;
      if (initial) m.jumpTo({center: initial.getCenter(), zoom: initial.getZoom()});
      else m.fitBounds([[29.45, -1.62], [35.25, 4.45]], {padding: 18, duration: 0});
      cameras?.add(m);
      m.on('move', event => {
        if ('scenarioSync' in event) return;
        for (const peer of cameras ?? []) {
          if (peer !== m) peer.jumpTo({center: m.getCenter(), zoom: m.getZoom()}, {scenarioSync: true});
        }
      });
      m.on('mousemove', 'watersheds', event => {
        const id = Number(event.features?.[0]?.properties.Lev12_ID);
        const present = rowIndex.current.has(id);
        setHovered(present ? id : null);
        m.getCanvas().style.cursor = present ? 'pointer' : '';
      });
      m.on('mouseleave', 'watersheds', () => {
        setHovered(null);
        m.getCanvas().style.cursor = '';
      });
      m.on('click', 'watersheds', event => {
        const id = Number(event.features?.[0]?.properties.Lev12_ID);
        if (rowIndex.current.has(id)) onSelect(id);
      });
      setReady(true);
    });
    return () => { cameras?.delete(m); m.remove(); map.current = null; };
  }, [geo, wmz, cameras, entries, onSelect]);

  useEffect(() => {
    const index = new Map(rows.map(row => [row.id, row]));
    rowIndex.current = index;
    const m = map.current;
    if (!m || !ready) return;
    m.removeFeatureState({source: 'watersheds'});
    for (const row of rows) {
      const score = mode === 'baseline' ? row.baselineScore : row.alternativeScore;
      const category = mode === 'membership' ? row.group : row.improvement === null ? '' :
        row.improvement > 0 ? 'Improved' : row.improvement < 0 ? 'Declined' : 'No change';
      m.setFeatureState({source: 'watersheds', id: row.id}, {
        score: score ?? 0, scored: score !== null, category,
        top: mode === 'baseline' ? row.baselineTop : mode === 'alternative' && row.alternativeTop,
        selected: row.id === selected,
      });
    }
  }, [mode, ready, rows, selected]);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    m.setPaintProperty('watersheds', 'fill-opacity', legendFilter
      ? ['case', ['==', ['feature-state', 'category'], legendFilter], 0.93, 0.14] : 0.88);
  }, [ready, legendFilter]);

  const active = rows.find(row => row.id === hovered);
  return <section className="panel scenario-map">
    <h3>{title}</h3>
    <div className="scenario-map-body">
      <div className="map" ref={host} aria-label={title}/>
      {active && <div className="scenario-map-tooltip" role="tooltip"><ComparisonDetails row={active}/></div>}
    </div>
    {unavailable && <p role="status">WebGL is unavailable. Use the comparison table to inspect watershed results.</p>}
    {entries ? <div className="scenario-legend" aria-label={`${title} legend`}>
      {entries.map(([label, color]) => <button type="button" key={label} aria-pressed={legendFilter === label}
        onClick={() => setLegendFilter(legendFilter === label ? null : label)}>
        <i style={{background: color}}/>{label}
      </button>)}
      <small>Select a legend item to highlight it.</small>
    </div> : <div className="scenario-legend">
      <span>Score 0</span><i className="scenario-score-scale"/><span>1</span>
      <small>Gold outline · Top {cutoff}%</small>
    </div>}
  </section>;
}
