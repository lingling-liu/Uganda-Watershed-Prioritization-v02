# Uganda IPT for GitHub Pages

This repository contains the editable project and the exact static build published on ChatGPT Sites as Uganda Watershed Prioritization v03. The GitHub repository can be named v02. The watershed data is from Daniel's v03 workbook.

1. Extract this archive and commit its contents at the root of your GitHub repository on the main branch.
2. Open Settings > Pages. Under Build and deployment, choose Deploy from a branch.
3. Select main and /docs, then select Save. GitHub displays the link on the Pages settings screen after the deployment completes.

The site is already built in docs/. Its assets use relative paths, so it works at a GitHub repository subpath. For future updates, run the tests and build below, then replace the published contents of docs/ with the new dist/ contents, including .nojekyll.

# Uganda Watershed Prioritization v03

This copy updates the existing React, TypeScript, Vite and MapLibre site to use Daniel's v03 workbook. The previous project directories are preserved. See [TEMP and v03 comparison and validation](reports/VALIDATION.md).

## Local testing

Use Node.js 22 or newer and pnpm 10.26 or newer. Run the commands in this directory.

```text
pnpm install --frozen-lockfile
pnpm test
pnpm build
pnpm preview
```

Open the URL printed by Vite, usually http://127.0.0.1:8090/. Serve the site over HTTP so the data files can load. In Explore, confirm that the default count is 2,057 and the first watershed is #1205. Clear the centroid checkbox to see all 2,177. Try a basin or minimum-area filter, change a criterion weight, reset to Excel defaults, and download the current view.

The v03 release starts with v03 defaults in an existing browser because the saved configuration has its own v03 storage key. TEMP configurations remain in their old storage key. A TEMP JSON configuration references older criterion IDs and needs to be recreated using the v03 criteria.

## GitHub Pages

After approval, build and publish the **contents** of `dist/` to the existing repository's configured GitHub Pages source, or upload `dist/` as the artifact if the repository uses GitHub Actions. For a branch-based deployment, retain `.nojekyll`. Confirm the Pages source in the repository settings before publishing. The build uses relative asset and data paths and requires no backend. Open the deployed repository subpath and repeat the local smoke checks.

The deployment ZIP contains the built site at its root. It can be previewed by extracting it and serving the extracted directory over HTTP.

## Regenerate and verify the data

The source includes ready-to-build JSON. To regenerate it from the original workbooks using Python 3 with openpyxl, run:

```text
python scripts/extract_v03.py "path/to/v03.xlsx" "path/to/TEMP.xlsx"
pnpm test --record
```

The extractor reads the existing geometry and verifies its identifiers. It never writes geometry. The test compares the browser engine against Excel values in a fixture outside the published site. `scripts/process_data.py` is the previous spatial preparation script and is retained for provenance. It is not the v03 extraction command.

The browser test in `tests/browser-v03.cjs` uses Playwright after the production build. Set `PLAYWRIGHT_MODULE` to an installed Playwright module and `TEST_BROWSER` to the Chromium executable, then run `node tests/browser-v03.cjs`. It loads the built assets under a repository subpath and supports an optional `TEST_URL` for a running server.
