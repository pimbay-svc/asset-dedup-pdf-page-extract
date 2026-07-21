# asset-dedup-pdf-page-extract

[![Docker Image](https://img.shields.io/badge/docker.io-pimbay%2Fasset--dedup--pdf--page--extract-blue?style=flat-square&logo=docker)](https://hub.docker.com/r/pimbay/asset-dedup-pdf-page-extract)
[![Node Version](https://img.shields.io/badge/node-%3E%3D24-339933?style=flat-square&logo=node.js)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-Unlicense-green?style=flat-square)](LICENSE)
[![Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen?style=flat-square)](https://codeberg.org/pimbay-svc/asset-dedup-pdf-page-extract)
[![Mutation Score](https://img.shields.io/badge/MSI-100%25-brightgreen?style=flat-square)](https://codeberg.org/pimbay-svc/asset-dedup-pdf-page-extract)

Page-extraction extension for `asset-dedup-core`.
Given one or more PDF paths on a shared volume, renders selected pages per PDF and writes each as a PNG file on that same volume.
Hashing is out of scope — `core` sends the extracted page paths to `image-hash` itself afterward.
Communication is a single persistent Unix-domain-socket connection from `core` (this service is the server), never HTTP — see the cross-repo protocol spec for the full design.

## Quick Start (Local)

Requires `pdftoppm` and `pdfinfo` (both part of `poppler-utils`) on `PATH`:

```bash
# Debian/Ubuntu
sudo apt-get install poppler-utils
```

```bash
npm install
cp .env.example .env
# edit .env — SOCKET_PATH and SHARED_VOLUME_DIR must point at paths this process can actually read/write
# (a volume shared with asset-dedup-core in production, any local directory for standalone dev)

npm run dev
```

## Quick Start (Docker)

```bash
docker compose up --build
```

Builds the image (Node runtime + `poppler-utils` in the same container, see `docker/Dockerfile`) and mounts two named volumes shared with `asset-dedup-core`: one for the socket file, one for source PDFs/extracted pages.
No TCP port is published — the only interface this service has is the socket file on the shared volume.

## Configuration

Env-only.

| Variable                | Required | Description                                                                         |
| ----------------------- | -------- | ----------------------------------------------------------------------------------- |
| `SOCKET_PATH`           | yes      | Path of the Unix domain socket this service listens on.                             |
| `SHARED_VOLUME_DIR`     | yes      | Base directory shared with `asset-dedup-core`: source PDFs read, pages written.     |
| `OUTPUT_DIR`            | no       | Where extracted pages are written. Default `${SHARED_VOLUME_DIR}/pdf-page-extract`. |
| `PDF_RENDER_TIMEOUT_MS` | no       | Hard timeout for a single `pdftoppm`/`pdfinfo` invocation. Default `15000`.         |

Full reference (all env vars, incl. `PDFTOPPM_BIN`/`PDFINFO_BIN`, TTL sweep settings): **[docs/configuration.md](docs/configuration.md)**.

## API

Not HTTP — a length-prefixed JSON protocol over a private Unix domain socket shared with `asset-dedup-core`; no auth beyond the socket file itself being reachable only on that shared volume.

| Op        | Description                                                                                                | Success response       |
| --------- | ---------------------------------------------------------------------------------------------------------- | ---------------------- |
| `extract` | Renders selected pages per input PDF (`first-middle-last` or `all`), written as PNGs to the shared volume. | `{ "outputs": {...} }` |

Full request/response shapes, error codes, and a usage example: **[docs/api.md](docs/api.md)**.

## Testing

```bash
npm run test:unit          # includes real pdftoppm/pdfinfo runs against test/fixtures/ — nothing mocked at the OS level
npm run test:integration   # real DI container wiring, a real UDS socket pair
npm run test:all           # both
npm run test:coverage      # both, with a coverage report (target: 100%, enforced)
npm run test:mutation      # StrykerJS mutation testing (target: 100% MSI, enforced) — no Python needed

```

## Development Helpers

```bash
npm run js:lint       # check
npm run js:lint:fix   # fix
npm run js:format     # check
npm run js:format:fix # fix
npm run js:typecheck  # tsc --noEmit
```

```bash
scripts/dev/extract.sh --pdf /shared/asset-def456.pdf
scripts/dev/extract.sh --pdf /shared/asset-def456.pdf --page-selection all
scripts/dev/extract.sh --page-selection first-middle-last --dpi 150 --pdf /shared/asset-def456.pdf
scripts/dev/extract.sh --socket-path /sockets/pdf-page-extract.sock --pdf /shared/asset-def456.pdf --page-selection all --dpi 150
```

Sends an `extract` op directly to a running instance over the socket — `PDF_PATH` must already be readable by this process (a path on the shared volume, not your host machine); only the path is sent, never file bytes.

## Architecture & Decisions

- **[docs/context.md](docs/context.md)** — current working state and non-obvious gotchas.
- **[docs/DECISIONS.md](docs/DECISIONS.md)** — why things are built the way they are, in the order the decisions were made.
- **[docs/CHANGELOG.md](docs/CHANGELOG.md)** — version history.

## License

Public domain — [Unlicense](LICENSE)

Created by [Jan Sarmir](https://pimbay.dev) · No conditions · No copyright

Bundled third-party dependencies and their licenses: **[docs/THIRD-PARTY-NOTICES.md](docs/THIRD-PARTY-NOTICES.md)**.
