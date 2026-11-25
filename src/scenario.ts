import {Ranked, withinTier} from './engine';

export const groups = ['Consistently high priority', 'Newly selected', 'Dropped out', 'Not selected'] as const;
export type Group = typeof groups[number];

export function compareRankings(baseline: Ranked[], alternative: Ranked[], cutoff: number) {
  const lookup = new Map(alternative.map(row => [row.id, row]));
  return baseline.map(base => {
    const alt = lookup.get(base.id)!;
    const baselineTop = withinTier(base, cutoff, baseline.length);
    const alternativeTop = withinTier(alt, cutoff, baseline.length);
    const group: Group = groups[baselineTop ? (alternativeTop ? 0 : 2) : (alternativeTop ? 1 : 3)];
    return {
      id: base.id, wmz: base.wmz, baselineScore: base.score, alternativeScore: alt.score,
      scoreChange: base.score === null || alt.score === null ? null : alt.score - base.score,
      baselineRank: base.rank, alternativeRank: alt.rank,
      improvement: base.rank === null || alt.rank === null ? null : base.rank - alt.rank,
      baselineTop, alternativeTop, group,
    };
  });
}
export type Comparison = ReturnType<typeof compareRankings>[number];

function midranks(ranks: number[]) {
  const counts = new Map<number, number>();
  for (const rank of ranks) counts.set(rank, (counts.get(rank) ?? 0) + 1);
  return ranks.map(rank => rank + (counts.get(rank)! - 1) / 2);
}

export function summarize(rows: Comparison[]) {
  const baselineTop = rows.filter(r => r.baselineTop).length;
  const alternativeTop = rows.filter(r => r.alternativeTop).length;
  const retained = rows.filter(r => r.baselineTop && r.alternativeTop).length;
  const paired = rows.filter(r => r.improvement !== null);
  const averageChange = paired.length ? paired.reduce((sum, row) => sum + Math.abs(row.improvement!), 0) / paired.length : null;
  const a = midranks(paired.map(r => r.baselineRank!));
  const b = midranks(paired.map(r => r.alternativeRank!));
  const mean = (paired.length + 1) / 2;
  let covariance = 0, varianceA = 0, varianceB = 0;
  for (let i = 0; i < paired.length; i++) {
    const x = a[i] - mean, y = b[i] - mean;
    covariance += x * y;
    varianceA += x * x;
    varianceB += y * y;
  }
  const correlation = varianceA && varianceB ? Math.max(-1, Math.min(1, covariance / Math.sqrt(varianceA * varianceB))) : null;
  return {baselineTop, alternativeTop, retained, newly: alternativeTop - retained, dropped: baselineTop - retained,
    retention: baselineTop ? retained / baselineTop : null, averageChange, correlation};
}
