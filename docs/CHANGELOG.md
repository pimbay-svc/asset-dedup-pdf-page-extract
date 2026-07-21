# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows [SemVer](https://semver.org/).

## [Unreleased]

## [1.0.0] - 2026-08-23

- Unix-domain-socket page-extraction service: `core` is the client, this service is the server, connecting once and staying open (`docs/DECISIONS.md`, 2026-07-24) — no HTTP, no auth beyond the shared-volume socket file itself.
- Single `op: "extract"` request/response over the socket (see `docs/api.md`), plus a standalone `presentation/uds/healthcheck.ts` script invoked directly by Docker `HEALTHCHECK`, not exposed as a network endpoint.
- Page selection via `pdftoppm`/`pdfinfo` (poppler-utils) — `all` or `first-middle-last`, the latter deduplicating for short documents instead of padding to a fixed count.
- Each PDF is passed to `pdftoppm` via a temp file, not stdin — poppler-utils has no stdin-streaming mode for this, and it sidesteps the `EPIPE` failure mode `asset-dedup-core`'s stdin-piping approach hit in production.
- Extracted pages are written as PNGs directly to `OUTPUT_DIR` on the shared volume, named `{uniqueId}-{index}.png`; a background TTL sweep (`TTL_SWEEP_INTERVAL_MS`/`TTL_RETENTION_MS`) removes anything `core` fails to clean up itself.
- Env-only configuration, zod-validated at startup (`src/infrastructure/env/env.ts`) — no YAML file, no `CONFIG_PATH`.
