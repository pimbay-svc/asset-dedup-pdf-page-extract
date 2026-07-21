# Third-Party Notices

This project itself is released under [The Unlicense](../LICENSE).
It bundles or invokes the following third-party software, each under its own license.

## npm dependencies

Full list with versions and licenses: run `npx license-checker --summary --production --excludePrivatePackages` — don't hand-maintain a duplicate of `package.json`/`package-lock.json` here.
Every transitive dependency currently resolved is verified directly against each package's own `package.json` `license` field, not assumed; none of it is copyleft.

Direct runtime dependencies — listed even though none carry an attribution requirement, so a reader doesn't have to run the tool just to see there's nothing unusual here:

| Package  | License | Note |
| -------- | ------- | ---- |
| `awilix` | MIT     | —    |
| `pino`   | MIT     | —    |
| `zod`    | MIT     | —    |

## External processes invoked (not linked)

These run as separate OS processes, invoked via CLI arguments with output read back from `stdout`/disk — never linked into this project's build output.
This is what keeps their licenses (often copyleft) from applying to this project's own code; see AGENTS.md before changing how any of these are invoked.

| Tool                       | License          | Invoked for                                                                                                                              |
| -------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `pdftoppm` (poppler-utils) | GPL-2.0-or-later | Rendering a single selected PDF page to a PNG image, one invocation per page (`src/infrastructure/pdf/pdfProvider.ts`).                  |
| `pdfinfo` (poppler-utils)  | GPL-2.0-or-later | Probing a PDF's total page count before resolving `page_selection` into physical page numbers (`src/infrastructure/pdf/pdfProvider.ts`). |

## Notes

This is not legal advice.
`pdftoppm`/`pdfinfo` are invoked by `PdfProvider` with `node:child_process.spawn`, given file paths as CLI arguments, with output read back from `stdout`/disk — no `poppler` source or object code is compiled into, statically linked, or dynamically linked against this project's own code.
This is treated as the standard "mere aggregation" / separate-process boundary that keeps `poppler-utils`'s GPL-2.0-or-later license from propagating to this project's own code; the Docker image ships both under their own separate licenses (this project's under [The Unlicense](../LICENSE), `poppler-utils` under GPL-2.0-or-later), see `../README.md`, "License".
