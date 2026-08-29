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

| Variable                | Required | Default                                 | Description                                                                     |
| ----------------------- | -------- | --------------------------------------- | ------------------------------------------------------------------------------- |
| `SOCKET_PATH`           | Yes      | —                                       | Path of the Unix domain socket this service listens on.                         |
| `SHARED_VOLUME_DIR`     | Yes      | —                                       | Base directory shared with `asset-dedup-core`: source PDFs read, pages written. |
| `OUTPUT_DIR`            | No       | `${SHARED_VOLUME_DIR}/pdf-page-extract` | Where extracted pages are written.                                              |
| `PDF_RENDER_TIMEOUT_MS` | No       | `15000`                                 | Hard timeout for a single `pdftoppm`/`pdfinfo` invocation.                      |
| `TTL_SWEEP_INTERVAL_MS` | No       | `300000`                                | How often the background sweep of `OUTPUT_DIR` runs.                            |
| `TTL_RETENTION_MS`      | No       | `3600000`                               | Age past which the TTL sweep deletes a leftover output file.                    |
| `NODE_ENV`              | No       | `production`                            | `development` \| `production` \| `test`.                                        |
| `LOG_LEVEL`             | No       | `info`                                  | pino level: `trace`\|`debug`\|`info`\|`warn`\|`error`\|`fatal`\|`silent`.       |

Full reference, including `PDFTOPPM_BIN`/`PDFINFO_BIN`: see the main repo's `docs/configuration.md`.

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
