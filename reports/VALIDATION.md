# Uganda IPT rev02 comparison and validation

Rev02 uses the same 2,177 RawData records, 25 criteria, workbook formulas, and watershed geometries as v03. The centroid filter stays enabled. The minimum area rises from 0 to 1,000 hectares, so the default ranked population falls from 2,057 to 1,910. Every default watershed has a matching polygon.

| Rev02 enabled criterion | Direction | Raw weight | Normalized |
| --- | --- | ---: | ---: |
| Sediment export rate | Higher | 0.50 | 34.48% |
| Nitrogen total export rate | Higher | 0.25 | 17.24% |
| Phosphorus surface export rate | Higher | 0.25 | 17.24% |
| Population density | Lower | 0.25 | 17.24% |
| Wetland share of watershed | Higher | 0.10 | 6.90% |
| Forest land share | Higher | 0.10 | 6.90% |

The tool independently recalculated all 47,750 indicator percentiles and all 1,910 composite scores, ranks, and priority tiers. Every result matched the rev02 workbook’s saved Excel values exactly. The cumulative tier cutoffs are ranks 96, 287, and 573. The acceptance test also checks combined geographic and area filters, the effect of changing the scoring direction, and zero-weight and missing-value behavior.

| Rev02 rank | Watershed | Rev02 score | Previous v03 rank |
| ---: | ---: | ---: | ---: |
| 1 | 1692 | 0.81489655 | 114 |
| 2 | 1430 | 0.80482759 | 304 |
| 3 | 696 | 0.79975862 | 129 |
| 4 | 517 | 0.79924138 | 55 |
| 5 | 886 | 0.79451724 | 86 |

The previous leader, #1205, ranks 13th in rev02. Of the 1,910 watersheds present in both default views, 1,907 changed rank and 530 changed tier.

Turning off the centroid filter with the minimum area still at 1,000 ha includes 2,028 records. Clearing the area threshold as well includes all 2,177. The existing 42 unmapped records remain available in rankings and non-spatial exports when included by the filters.

The TypeScript and Vite production builds passed. A Chromium smoke test loaded the build at a simulated GitHub Pages subpath and checked the map, filters, rankings, search, exports, criteria controls, and mobile layout.
