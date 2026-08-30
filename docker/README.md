# asset-dedup-pdf-page-extract

Page-extraction extension for `asset-dedup-core`.
Given one or more PDF paths on a shared volume, renders selected pages per PDF and writes each as a PNG file on that same volume.
Hashing is out of scope — `core` sends the extracted page paths to `image-hash` itself afterward.
Communication is a single persistent Unix-domain-socket connection from `core` (this service is the server), never HTTP.

## Quick Start

```bash
docker run --rm \
  -v pdf-sockets:/sockets \
  -v pdf-shared-assets:/shared \
  -e SOCKET_PATH=/sockets/pdf-page-extract.sock \
  -e SHARED_VOLUME_DIR=/shared \
  pimbay/asset-dedup-pdf-page-extract:latest
```

`SOCKET_PATH` and `SHARED_VOLUME_DIR` must point at a volume also mounted into `asset-dedup-core` — this service exposes no TCP port, only the socket file.

## Docker Compose

```yaml
services:
  pdf-page-extract:
    image: pimbay/asset-dedup-pdf-page-extract:latest
    environment:
      NODE_ENV: production
      LOG_LEVEL: info
      SOCKET_PATH: /sockets/pdf-page-extract.sock
      SHARED_VOLUME_DIR: /shared
    volumes:
      - sockets:/sockets
      - shared-assets:/shared
    restart: unless-stopped

volumes:
  sockets:
  shared-assets:
```

`sockets` and `shared-assets` should be the same named volumes `asset-dedup-core`'s compose service mounts, so the socket file and PDF/PNG paths resolve identically on both sides.

## Environment Variables

Env-only — there is no config file. Everything is validated at startup; a broken or missing required value fails immediately, before the socket server starts listening, rather than accepting connections with silently wrong behavior. All numeric variables accept both string and number form (`"15000"` or `15000`) and must be positive integers.

| Variable                | Required | Default                                 | Description                                                                                                                                                                                                 |
| ----------------------- | -------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SOCKET_PATH`           | Yes      | —                                       | Filesystem path of the Unix domain socket this service listens on. Must be on a location `core` can also reach — a volume shared with `asset-dedup-core`.                                                   |
| `SHARED_VOLUME_DIR`     | Yes      | —                                       | Base directory shared with `core`: source PDF paths sent over the socket are expected to resolve under here, and `OUTPUT_DIR` defaults to a subdirectory of it.                                             |
| `OUTPUT_DIR`            | No       | `${SHARED_VOLUME_DIR}/pdf-page-extract` | Directory extracted PNG pages are written into. Created automatically on first use if it doesn't exist.                                                                                                     |
| `PDFTOPPM_BIN`          | No       | `pdftoppm`                              | Path to the `pdftoppm` binary (poppler-utils), or a bare name resolved via `PATH`.                                                                                                                          |
| `PDFINFO_BIN`           | No       | `pdfinfo`                               | Path to the `pdfinfo` binary (poppler-utils), or a bare name resolved via `PATH`.                                                                                                                           |
| `PDF_RENDER_TIMEOUT_MS` | No       | `15000`                                 | Hard timeout for a single `pdftoppm`/`pdfinfo` invocation (page-count probe or one page render). Exceeding it kills the child process and fails that call.                                                  |
| `TTL_SWEEP_INTERVAL_MS` | No       | `300000` (5 min)                        | How often the background sweep of `OUTPUT_DIR` runs.                                                                                                                                                        |
| `TTL_RETENTION_MS`      | No       | `3600000` (1 h)                         | Age past which the TTL sweep deletes a leftover output file. Defensive backstop only — `core` is expected to consume/delete its own output; this catches what's left behind if `core` crashes mid-pipeline. |
| `NODE_ENV`              | No       | `production`                            | `development` \| `production` \| `test`. Controls log pretty-printing.                                                                                                                                      |
| `LOG_LEVEL`             | No       | `info`                                  | pino level: `trace`\|`debug`\|`info`\|`warn`\|`error`\|`fatal`\|`silent`.                                                                                                                                   |

**Not configurable via env:** page selection and DPI are per-request, sent by `core` in the request's `config` field (see Protocol below) — there is no server-side default or override for either. Output filename convention (`{uniqueId}-{index}.png`) is fixed, not configurable.

## Volumes

| Container path | Description                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------------- |
| `/sockets`     | Holds the Unix domain socket file (`SOCKET_PATH`) that `asset-dedup-core` connects to as a client.                  |
| `/shared`      | Shared with `asset-dedup-core`: source PDFs are read from here, extracted PNG pages are written under `OUTPUT_DIR`. |

Both volumes must be shared with (mounted into) `asset-dedup-core` for the two services to see the same paths.

## Ports / Sockets

| Port / Path                      | Protocol    | Description                                                                               |
| -------------------------------- | ----------- | ----------------------------------------------------------------------------------------- |
| `/sockets/pdf-page-extract.sock` | Unix socket | Length-prefixed JSON protocol; only interface this service exposes. No HTTP, no TCP port. |

No HTTP port is exposed.

## Tags

| Tag      | Description                         |
| -------- | ----------------------------------- |
| `latest` | latest stable release               |
| `1.0`    | major.minor — updated on each patch |
| `1.0.0`  | exact version                       |

Images are published to both registries on each release:

```bash
docker pull pimbay/asset-dedup-pdf-page-extract:latest
docker pull ghcr.io/pimbay-svc/asset-dedup-pdf-page-extract:latest
```

## License

Public domain — Unlicense

Created by Jan Sarmir · No conditions · No copyright
