"""Extract v03 browser data and the separate Excel verification fixture."""
import hashlib
import json
import re
import sys
from collections import Counter
from pathlib import Path

import openpyxl

root = Path(__file__).resolve().parents[1]
out = root / 'public' / 'data'
book, temp = map(Path, sys.argv[1:3])
values = openpyxl.load_workbook(book, read_only=True, data_only=True)
formulas = openpyxl.load_workbook(book, read_only=True, data_only=False)
previous = openpyxl.load_workbook(temp, read_only=True, data_only=True)
units = ['t/ha/yr', 't/yr', 'ha', 't/ha/yr', 't/ha/yr', 't/yr',
         'kg/ha/yr', 'kg/yr', 'kg/ha/yr', 'kg/yr', 'mm/yr', 'm³/yr',
         't C/ha', 't C', 'persons', 'persons/ha',
         'ha', 'fraction', 'ha', 'fraction', 'fraction', 'ha', 'fraction', 'ha', 'fraction']
raw = iter(values['RawData'].values)
headers = next(raw)
source = {r[0]: dict(zip(headers, r)) for r in raw}
assert len(source) == values['RawData'].max_row - 1 == 2177
geo = json.loads((out / 'watersheds.geojson').read_text(encoding='utf-8'))
spatial = {f['properties']['Lev12_ID']: f['properties'] for f in geo['features']}
assert len(spatial) == len(geo['features'])

# Trace each FinalRank criterion through its percentile formula to RawData.
rank = list(formulas['RankScoreData'].iter_rows(min_row=7, max_row=7, values_only=True))[0]
filtered = list(formulas['FilteredData'].iter_rows(min_row=8, max_row=8, values_only=True))[0]
indicators = []
for index, (pillar, label, enabled, direction, weight, norm) in enumerate(
    values['FinalRank'].iter_rows(min_row=9, max_row=33, max_col=6, values_only=True)
):
    name, field = label.rsplit(' (', 1)
    field = field.removesuffix(')')
    raw_index = 5 + index * 3
    filtered_col = re.search(r'FilteredData!([A-Z]+)9\)$', rank[raw_index])[1]
    raw_col = filtered[openpyxl.utils.column_index_from_string(filtered_col) - 1].split('!')[1][:-1]
    assert headers[openpyxl.utils.column_index_from_string(raw_col) - 1] == field, label
    col = openpyxl.utils.get_column_letter(raw_index + 3)
    assert f'{col}7' in rank[80]
    indicators.append(dict(id=field, name=name, pillar=pillar, include=enabled,
                           direction='lower' if direction.startswith('Lower') else 'higher',
                           weight=weight, unit=units[index], definition=f'{name} ({units[index]}).',
                           percentileColumn=col, excelWeight=norm))

cache = {r[0]: r for r in values['RankScoreData'].iter_rows(min_row=7, values_only=True)
         if isinstance(r[0], int)}
final = {r[1]: (r[0], r[6], r[7]) for r in values['FinalRank'].iter_rows(
    min_row=9, min_col=8, max_col=15, values_only=True) if isinstance(r[1], int)}
default_ids = {k for k, r in source.items() if r['Flag02'] == 1 and r['AreaHa'] >= 0}
assert default_ids == cache.keys() == final.keys()
assert len(default_ids) == 2057 and Counter(r['Flag02'] for r in source.values()) == {1: 2057, 0: 120}
rows = [
    dict(id=k, hybasId=r['HYBAS_ID'], wsId=r['ws_id'], wmz=r['Water_Mana'] or 'Unassigned',
         basin=r['Basin'] or 'Unassigned', catchment=r['Catchment'] or 'Unassigned',
         area=r['AreaHa'], flag02=r['Flag02'], hasGeometry=k in spatial,
         raw={i['id']: r[i['id']] for i in indicators}, sourceAttributes=r)
    for k, r in source.items()
]
report = json.loads((out / 'validation.json').read_text(encoding='utf-8'))
duplicates = lambda vals: [dict(id=k, count=n) for k, n in Counter(vals).items() if n > 1]
keys = []
for field in ('Lev12_ID', 'ws_id', 'HYBAS_ID'):
    a, b = [[r[field] for r in records.values()] for records in (source, spatial)]
    keys.append(dict(field=field, workbookDistinct=len(set(a)), spatialDistinct=len(set(b)),
                     sharedDistinct=len(set(a) & set(b)), workbookDuplicates=duplicates(a),
                     spatialDuplicates=duplicates(b)))
shared = source.keys() & spatial.keys()
mismatches = [dict(Lev12_ID=k, field=f, workbook=source[k][f], spatial=spatial[k][f])
              for k in sorted(shared) for f in ('HYBAS_ID', 'ws_id') if source[k][f] != spatial[k][f]]
assert not mismatches and not spatial.keys() - source.keys()
assert not keys[0]['workbookDuplicates'] and not keys[2]['workbookDuplicates'] and not keys[2]['spatialDuplicates']
old_ranks = {r[1]: r[0] for r in previous['FinalRank'].iter_rows(
    min_row=9, min_col=8, max_col=9, values_only=True) if isinstance(r[1], int)}
top = sorted(final, key=lambda k: (final[k][0], k))[:5]
report.update(workbook=book.name, workbookSHA256=hashlib.sha256(book.read_bytes()).hexdigest(),
              rawRecords=len(rows), spatialRecords=len(spatial), matched=len(shared),
              workbookOnly=sorted(source.keys() - spatial.keys()), spatialOnly=[], candidateKeys=keys,
              crossAttributeMismatches=mismatches, defaultIncluded=len(default_ids),
              defaultUnmapped=sorted(default_ids - spatial.keys()),
              defaultActiveIndicators=sum(i['include'] for i in indicators),
              defaultPositiveWeightIndicators=sum(i['include'] and i['weight'] > 0 for i in indicators),
              defaultRawWeightSum=values['FinalRank']['E34'].value,
              defaultNormalizedWeightSum=values['FinalRank']['F34'].value,
              topFive=[dict(Lev12_ID=k, rank=final[k][0], score=final[k][1],
                            tier=final[k][2], tempRank=old_ranks.get(k)) for k in top],
              missingValues={i['id']: sum(r['raw'][i['id']] is None for r in rows) for i in indicators},
              missingDefaultValues={i['id']: sum(source[k][i['id']] is None for k in default_ids)
                                    for i in indicators},
              defaultMissingAdministrativeLabels=sum(not source[k]['Water_Mana'] for k in default_ids))
for key in ('validatedScores', 'validatedPercentiles', 'validatedRanks', 'validatedTiers',
            'maxScoreDifference', 'maxPercentileDifference'):
    report.pop(key, None)
def write(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':'), allow_nan=False), encoding='utf-8')

write(out / 'watersheds.json', rows)
weights = {i['id']: i.pop('excelWeight') for i in indicators}
write(out / 'indicators.json', indicators)
write(root / 'tests' / 'excel-v03.json', dict(weights=weights, rows={
    k: dict(score=r[80], rank=r[81], tier=final[k][2], percentiles=r[7:80:3])
    for k, r in cache.items()
}))
write(out / 'validation.json', report)
print('Unmapped in default scope:', report['defaultUnmapped'])
print('Default Excel top five:', report['topFive'])
