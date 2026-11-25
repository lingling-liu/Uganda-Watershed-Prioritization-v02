import assert from 'node:assert/strict';
import fs from 'node:fs';
import {calculate, defaultFilters, scope, type Indicator, type Watershed} from '../src/engine';
import {compareRankings, summarize} from '../src/scenario';

const data: Watershed[] = JSON.parse(fs.readFileSync('public/data/watersheds.json', 'utf8'));
const criteria: Indicator[] = JSON.parse(fs.readFileSync('public/data/indicators.json', 'utf8'));
const bounds = [5, 15, 30];
for (const filters of [defaultFilters, {...defaultFilters, minArea: 0}, {...defaultFilters, wmz: 'Kyoga WMZ'}]) {
  const population = scope(data, filters);
  const base = calculate(population, criteria);
  const initial = calculate(population, criteria.map(i => ({...i, weight: i.include ? i.weight : 0})));
  assert.deepEqual(initial, base);
  const alternative = calculate(population, criteria.map((i, index) => ({...i, weight: index ? 0 : 1, include: index === 0})));
  for (const bound of bounds) {
    const equal = compareRankings(base, initial, bound);
    assert(equal.every(r => r.improvement === 0 && r.scoreChange === 0));
    assert.equal(summarize(equal).correlation, 1);
    assert.equal(summarize(equal).retention, 1);
    const compared = compareRankings(base, alternative, bound);
    assert.equal(compared.length, population.length);
    assert(compared.some(r => r.improvement! > 0));
    assert(compared.some(r => r.improvement! < 0));
    assert(compared.every(r => r.improvement === r.baselineRank! - r.alternativeRank!));
    const stats = summarize(compared);
    assert.equal(stats.newly, compared.filter(r => r.group === 'Newly selected').length);
    assert.equal(stats.dropped, compared.filter(r => r.group === 'Dropped out').length);
    assert.equal(stats.retained, compared.filter(r => r.group === 'Consistently high priority').length);
  }
}
assert.equal(summarize([]).correlation, null);
const rows = compareRankings(calculate(data.slice(0, 1), criteria), calculate(data.slice(0, 1), criteria), 5);
assert.equal(rows[0].improvement, null);
assert.equal(rows[0].group, 'Not selected');
console.log('PASS: identical weights, population filters, cutoff membership, rank direction, and summary consistency.');
