# Uganda Watershed Prioritization Tool

This repository contains the editable source and a prebuilt GitHub Pages site in `docs/`. It uses Daniel’s **v03 rev02** Hydroshed scoring workbook.

## Publish on GitHub Pages

Commit the extracted repository contents to `main`. In **Settings → Pages**, choose **Deploy from a branch**, select **main** and **/docs**, and save. The built site uses relative asset paths and includes `docs/.nojekyll`. The site is served at the repository’s Pages URL without a `/docs/` suffix.

## Develop and test locally

Use Node.js 22 or newer and pnpm 11. Run the following from the repository root.

```text
pnpm install --frozen-lockfile
pnpm test
pnpm build
pnpm preview
```

After rebuilding, replace the published contents of `docs/` with the contents of `dist/`, including `.nojekyll`.

To regenerate the workbook extracts, run the following with Python 3 and openpyxl.

```text
python scripts/extract_v03.py "path/to/rev02.xlsx" "path/to/v03.xlsx"
pnpm test --record
```

The second workbook supplies comparison ranks. Rev02 uses its own browser storage key so an earlier saved session does not override its defaults. Previously exported custom configurations with compatible criteria can still be loaded explicitly.

See [Rev02 comparison and validation](reports/VALIDATION.md) for the Excel results.
