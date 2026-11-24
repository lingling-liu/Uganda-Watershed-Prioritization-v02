import assert from 'node:assert/strict';
import fs from 'node:fs';
import {calculate, normalized, percentiles, scope, defaultFilters, withinTier, tier, tierBoundary, Indicator, Watershed} from '../src/engine';
const read = (path: string) => JSON.parse(fs.readFileSync(path, 'utf8'));
const rows: Watershed[] = read('public/data/watersheds.json');
const config: Indicator[] = read('public/data/indicators.json');
const excel = read('tests/excel-v03.json');
const report = read('public/data/validation.json');
const base = scope(rows, defaultFilters);
const ranked = calculate(base, config);
assert.equal(rows.length, 2177);
assert.equal(base.length, 2057);
assert.equal(scope(rows, {...defaultFilters, centroidOnly: false}).length, 2177);
assert.equal(config.length, 25);
assert.equal(config.filter(i => i.include).length, 8);
assert.equal(rows.filter(r => r.hasGeometry).length, 2135);
assert(base.every(r => r.flag02 === 1 && r.hasGeometry));
assert.equal(defaultFilters.minArea, 0);
assert.deepEqual([5, 15, 30].map(p => tierBoundary(base.length, p)), [103, 309, 617]);
for (const r of base.slice(0, 50)) {
  const filters = {...defaultFilters, wmz: r.wmz, basin: r.basin, catchment: r.catchment, minArea: r.area};
  assert.deepEqual(scope(rows, filters), base.filter(w =>
    w.wmz === r.wmz && w.basin === r.basin && w.catchment === r.catchment && w.area >= r.area));
}
const weights = normalized(config);
for (const i of config) assert(Math.abs(weights[i.id] - excel.weights[i.id]) < 1e-15);
assert(Math.abs(Object.values(weights).reduce((a, b) => a + b, 0) - 1) < 1e-15);
let maxScoreDifference = 0;
let maxPercentileDifference = 0;
const differentRanks: {id:number;web:number|null;excel:number}[] = [];
let differentTiers = 0;
assert.equal(Object.keys(excel.rows).length, ranked.length);
for (const r of ranked) {
  const expected = excel.rows[r.id];
  assert(expected, `Missing workbook record ${r.id}`);
  maxScoreDifference = Math.max(maxScoreDifference, Math.abs(r.score! - expected.score));
  for (const [index, i] of config.entries()) {
    maxPercentileDifference = Math.max(maxPercentileDifference,
      Math.abs(r.percentiles[i.id]! - expected.percentiles[index]));
  }
  if (r.rank !== expected.rank) differentRanks.push({id:r.id,web:r.rank,excel:expected.rank});
  if (r.tier !== expected.tier) differentTiers++;
}
console.log({maxScoreDifference, maxPercentileDifference, differentRanks, differentTiers});
assert(maxScoreDifference < 1e-12);
assert.equal(maxPercentileDifference, 0);
assert.equal(differentRanks.length, 0);
assert.equal(differentTiers, 0);
assert.deepEqual(ranked.slice(0, 5).map(r => r.id), [1205, 1667, 1178, 1454, 1358]);
assert.equal(ranked.filter(r => withinTier(r, 5, ranked.length)).length, 103);
assert.equal(tier(103, 2057), 'Tier 1 (Top 5%)');
assert.equal(tier(104, 2057), 'Tier 2 (Top 15%)');
assert.equal(tier(310, 2057), 'Tier 3 (Top 30%)');
assert.equal(tier(618, 2057), 'Tier 4 (Standard)');
const single = config.map(i => ({...i, include: i.id === config[0].id, weight: 1, direction: 'higher' as const}));
const high = calculate(base, single);
const low = new Map(calculate(base, single.map(i => ({...i, direction: 'lower'}))).map(r => [r.id, r]));
for (const r of high) assert(Math.abs(r.score! + low.get(r.id)!.score! - 1) < 1e-12);
assert(high.some((r, i) => r.id !== ranked[i].id));
assert(calculate(base, config.map(i => ({...i, include:false}))).every(r => r.score === 0 && r.rank === 1));
assert(calculate([base[0]], config).every(r => r.score === null));
assert.deepEqual(calculate([], config), []);
assert.equal(percentiles([1, 2, 3, 4]).get(2), .333);
assert.equal(percentiles([0, 0, 1]).get(0), 0);
const nullRow = rows.find(r => r.raw[config[0].id] === null)!;
assert(calculate([nullRow, base[0]], config).find(r => r.id === nullRow.id)?.missing.includes(config[0].id));
if (process.argv.includes('--record')) {
  Object.assign(report, {validatedScores: ranked.length, validatedPercentiles: ranked.length * config.length,
    validatedRanks: ranked.length, validatedTiers: ranked.length, maxScoreDifference, maxPercentileDifference});
  fs.writeFileSync('public/data/validation.json', JSON.stringify(report, null, 2) + '\n');
}
console.log('PASS: Excel v03 worksheet parity and dynamic scoring checks.');
