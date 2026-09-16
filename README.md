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
git clone https://codeberg.org/pimbay-svc/asset-dedup-pdf-page-extract.git
cd asset-dedup-pdf-page-extract
npm install
cp .env.example .env
npm run dev
```

## Quick Start (Docker)

```bash
docker compose up --build
```

Builds the image (Node runtime + `poppler-utils` in the same container, see `docker/Dockerfile`) and mounts two named volumes shared with `asset-dedup-core`: one for the socket file, one for source PDFs/extracted pages.
No TCP port is published — the only interface this service has is the socket file on the shared volume.

```bash
docker pull pimbay/asset-dedup-pdf-page-extract:latest       # Docker Hub
docker pull ghcr.io/pimbay-svc/asset-dedup-pdf-page-extract:latest  # GitHub Container Registry
```

## Usage

The smallest useful thing this service does: extract the default pages (`first-middle-last`, 150 DPI) from one PDF already sitting on the shared volume.
`scripts/dev/extract.sh` sends an `extract` op directly to a running instance — no full `core` client setup needed.

```bash
scripts/dev/extract.sh --pdf /shared/asset-def456.pdf --page-selection all --dpi 150 --socket-path /sockets/pdf-page-extract.sock
```

```text
extract op -> /sockets/pdf-page-extract.sock  (path: /shared/asset-def456.pdf, page_selection: all, dpi: 150)
{
  "outputs": {
    "id1": {
      "paths": [
        "/shared/asset-def456/page-1.png",
        "/shared/asset-def456/page-12.png",
        "/shared/asset-def456/page-24.png"
      ]
    }
  }
}
```

`--page-selection` (`first-middle-last`/`all`), `--dpi`, and `--socket-path` are all optional:

```bash
scripts/dev/extract.sh --pdf /shared/asset-def456.pdf
scripts/dev/extract.sh --pdf /shared/asset-def456.pdf --page-selection all
scripts/dev/extract.sh --page-selection first-middle-last --dpi 150 --pdf /shared/asset-def456.pdf
scripts/dev/extract.sh --socket-path /sockets/pdf-page-extract.sock --pdf /shared/asset-def456.pdf --page-selection all --dpi 150
```

The PDF path must already be readable by the running instance — a path on the shared volume, not your host machine; only the path is sent, never file bytes.
Not HTTP, so there's no `curl` equivalent — full request/response shapes, error codes, and batch requests: **[docs/api.md](docs/api.md)**.

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

Full request/response shapes and error codes: **[docs/api.md](docs/api.md)**.

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

## Architecture & Decisions

- **[docs/context.md](docs/context.md)** — current working state and non-obvious gotchas.
- **[docs/DECISIONS.md](docs/DECISIONS.md)** — why things are built the way they are, in the order the decisions were made.
- **[docs/CHANGELOG.md](docs/CHANGELOG.md)** — version history.

## License

Public domain — [Unlicense](LICENSE)

Created by [Jan Sarmir](https://pimbay.dev) · No conditions · No copyright

Bundled third-party dependencies and their licenses: **[docs/THIRD-PARTY-NOTICES.md](docs/THIRD-PARTY-NOTICES.md)**.
