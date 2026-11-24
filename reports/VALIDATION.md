# Uganda IPT v03 comparison and validation

## TEMP and v03

| Item | TEMP workbook | v03 workbook |
| --- | --- | --- |
| Sheets | Data Inventory, ES Model Results, RawData, FilteredData, RankScoreData, FinalRank | RawData, FilteredData, RankScoreData, FinalRank |
| RawData | 2,177 rows, 72 fields | 2,177 rows, 71 fields |
| Default scope | All WMZs, basins and catchments, minimum 1,000 ha | All WMZs, basins and catchments, minimum 0 ha, Flag02 = 1 |
| Default population | 2,028 | 2,057 |
| Criteria | 21 available, 7 enabled, 5 positive weights | 25 available, 8 enabled, all positive weights |
| Sum of enabled raw weights | 2.45 | 1.50 |
| Percentiles and ranks | PERCENTRANK.INC with three decimals and descending RANK.EQ | Same functions, updated source column mappings and filter population |
| Priority tiers | Workbook column blank | Four formula-based tiers with round-to-nearest cutoffs and minimum ranks of 1, 2 and 3 |
| Top watershed | #1584, 0.9586734694 | #1205, 0.8931 |

All 2,177 Lev12_IDs, paired HYBAS_IDs and AreaHa values are identical across the two workbooks. After joining on Lev12_ID, the source values differ in 2,155 avoided-export rate records, 2,160 nitrogen-export rate records, 2,160 phosphorus-export rate records and 2,135 mean water-yield records. These counts use exact source-cell comparisons and include changed missingness. The workbooks use different criteria and reference populations, so differences in score reflect changes in the model.

The v03 FinalRank settings define the selectable criteria. The raw sheet also includes source variables outside those 25 criteria. The v03 weights expand the evidence to carbon, population, wetlands, farmed land and forest. Some TEMP selections, including the USLE, standalone sediment-deposition, nitrogen component and general land-condition criteria, are absent from the v03 criteria list. The extractor follows the RankScoreData source references through FilteredData and checks every mapping against the field named in FinalRank. The data dictionary supplies units and defines the geographic flags.

| Enabled v03 criterion | Direction | Raw weight | Normalized |
| --- | --- | ---: | ---: |
| Avoided sediment export rate | Lower | 0.10 | 6.67% |
| Nitrogen total export rate | Higher | 0.50 | 33.33% |
| Phosphorus surface export rate | Higher | 0.50 | 33.33% |
| Baseline carbon density | Higher | 0.10 | 6.67% |
| Population density | Higher | 0.05 | 3.33% |
| Degraded wetland share of watershed | Higher | 0.15 | 10.00% |
| Farmed land share of watershed | Higher | 0.05 | 3.33% |
| Forest land share of watershed | Higher | 0.05 | 3.33% |

## Workbook validation

The TypeScript engine independently recalculated the default results from the exported RawData values and settings. It matched all **51,425 percentiles, 2,057 scores, 2,057 competition ranks and 2,057 FinalRank tier labels exactly** as lists of values keyed by Lev12_ID. Normalized weights matched within 1e−15 and sum to 100% to floating-point precision. Default cumulative rank cutoffs are 103, 309 and 617. Scenario checks exercise all five scope controls, criteria changes, missing inputs, and ties. Excel's blank numeric inputs become zero in the filter output. Browser tables and exports retain the original missing values and flag them.

With zero total enabled weight, scored watersheds receive a zero score and share rank 1, consistent with the workbook formula. The website retains its existing explicit unscored state for a singleton scope. The supplied workbook cache only validates the default 2,057-record scenario.

| v03 rank | Lev12_ID | v03 score | TEMP rank |
| ---: | ---: | ---: | ---: |
| 1 | 1205 | 0.8931000000 | 177 |
| 2 | 1667 | 0.8919666667 | 555 |
| 3 | 1178 | 0.8917666667 | 299 |
| 4 | 1454 | 0.8845000000 | 63 |
| 5 | 1358 | 0.8750333333 | 1,270 |

## Map and geography

The existing watershed and WMZ GeoJSON files are carried forward byte-for-byte. All 2,135 existing watershed polygons match unique workbook Lev12_ID values, with no HYBAS_ID or ws_id cross-check differences. All 2,057 default records have polygons. The 42 workbook records without existing polygons each have Flag02 = 0. They are available in rankings and non-spatial exports when the centroid filter is off. The 120 Flag02 = 0 records include 78 mapped polygons. The centroid rule can select polygons whose boundaries extend into neighboring countries.

The hosted page was unreachable from the execution environment. The update uses the outer `uganda-watershed` source, which contains the OpenStreetMap default, opacity slider and location controls from the later local release. The all-source package supplied the TEMP comparison workbook. The live Pages source branch could not be verified.

## Modified files

| Files | Change |
| --- | --- |
| src/engine.ts | Adds centroid filtering and workbook tier boundaries to the existing scoring engine |
| src/App.tsx, src/styles.css, src/MapView.tsx | Adds the scope checkbox, updates methodology and metadata, and aligns map outlines and tier controls with workbook thresholds |
| public/data/watersheds.json, indicators.json, validation.json | v03 source records, criteria and validation results |
| scripts/extract_v03.py | Reproducible workbook extraction and identifier cross-checks |
| tests/engine.test.ts, rank-check.ts, excel-v03.json, browser-v03.cjs | Workbook parity fixture, regression checks and browser smoke test |
| README.md, reports/VALIDATION.md | Testing, deployment, workbook comparison and validation |

## Production build and browser checks

TypeScript and the production Vite build passed. The built page loaded from a simulated GitHub Pages repository subpath in Chromium. Checks covered map initialization, the five analysis scope controls, tier display, search, the watershed profile, CSV and metadata contents, the eight enabled criteria, weight controls, and a 390 px viewport without horizontal overflow. The browser test served production files through Playwright routing because local network navigation was restricted. Live OpenStreetMap tile delivery and the hosted page were outside that offline check.
