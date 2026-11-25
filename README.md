# Uganda Watershed IPT v04

v04 adds **Scenario Comparison** to the original v03 site. The v03 rev02 workbook defaults and watershed assets are included. Open Scenario Comparison from the navigation to compare the fixed baseline with an alternative weighting scheme.

- Both scenarios use the geographic and area filters above the comparison. The baseline always uses the workbook’s rev02 weights and directions. Enter non-negative relative weights for the alternative. A positive weight activates its criterion, and weights are normalized to 100%.
- The two priority maps share zoom, pan, the original score color scale, and gold outlines. Choose a 5%, 15%, or 30% cutoff for both maps. Competition-rank ties at the cutoff are included.
- The Ranking Change map shows baseline minus alternative rank. The top-priority comparison map shows membership under both scenarios. Click legend items to highlight categories and select watersheds for details.
- Retention is the proportion of baseline top-priority watersheds also selected in the alternative. Average rank change uses absolute differences. Spearman correlation is Pearson correlation on average ranks for ties. It is undefined when either ranking has no variance.
- The results CSV includes the current table filters and top-priority threshold. The separate weights CSV records baseline and alternative weights, directions, and percentage-point changes.

## Build and test

Use Node.js 22 or newer and pnpm 11. Run `pnpm install --frozen-lockfile`, then `pnpm test`, `pnpm build`, and `pnpm preview`. The regression suite verifies rev02 Excel parity and scenario calculations on the existing watershed data. The browser test in `tests/browser-scenario.cjs` uses a local Chromium executable and Playwright to test the built assets at a repository subpath.

## GitHub Pages

The ZIP contains the full source and a prebuilt site in `docs/`. Commit the extracted files on `main`, then select **Settings → Pages → Deploy from a branch → main → /docs**. After rebuilding, replace the contents of `docs/` with the new `dist/` contents, including `.nojekyll`. The Vite build uses relative asset paths.

The [original v03 ChatGPT Site](https://uganda-watershed-ipt-v03.shiyuepiaoxue.chatgpt.site) remains available as a backup.
