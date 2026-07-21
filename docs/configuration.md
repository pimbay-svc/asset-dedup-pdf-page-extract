# Configuration Reference

Env-only — there is no `config.yaml`, no `CONFIG_PATH`.
Everything is validated by a single zod schema at startup (`src/infrastructure/env/env.ts`, `EnvSchema`); a broken or missing required value throws `EnvError` immediately, before the socket server starts listening, rather than accepting connections with silently wrong behavior.

`README.md`'s Configuration section lists the handful of variables needed to get Quick Start running.
This is the full reference — every variable, its type, default, and validation rule.

## Environment variables

| Variable                | Required | Default                                 | Description                                                                                                                                                                                                                    |
| ----------------------- | -------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `NODE_ENV`              | no       | `production`                            | `development` \| `production` \| `test`. Controls log pretty-printing (`src/infrastructure/logger.ts`) — see `AGENTS.md` on why a typo here enabling pretty-print in prod has bitten us before.                                |
| `LOG_LEVEL`             | no       | `info`                                  | pino level: `trace`\|`debug`\|`info`\|`warn`\|`error`\|`fatal`\|`silent`.                                                                                                                                                      |
| `SOCKET_PATH`           | yes      | —                                       | Filesystem path of the Unix domain socket this service listens on (`net.createServer().listen(SOCKET_PATH)`). Must be on a location `core` can also reach — a volume shared with `asset-dedup-core` in production.             |
| `SHARED_VOLUME_DIR`     | yes      | —                                       | Base directory shared with `core`: source PDF paths sent over the socket are expected to resolve under here, and `OUTPUT_DIR` defaults to a subdirectory of it.                                                                |
| `OUTPUT_DIR`            | no       | `${SHARED_VOLUME_DIR}/pdf-page-extract` | Directory extracted PNG pages are written into. Created (`mkdir -p`) on first use if it doesn't exist.                                                                                                                         |
| `PDFTOPPM_BIN`          | no       | `pdftoppm`                              | Path to the `pdftoppm` binary (poppler-utils), or a bare name resolved via `PATH`.                                                                                                                                             |
| `PDFINFO_BIN`           | no       | `pdfinfo`                               | Path to the `pdfinfo` binary (poppler-utils), or a bare name resolved via `PATH`.                                                                                                                                              |
| `PDF_RENDER_TIMEOUT_MS` | no       | `15000`                                 | Hard timeout for a single `pdftoppm`/`pdfinfo` invocation (page-count probe or one page render). Exceeding it kills the child process (`SIGKILL`) and fails that call with `internal_error`.                                   |
| `TTL_SWEEP_INTERVAL_MS` | no       | `300000` (5 min)                        | How often the background sweep of `OUTPUT_DIR` runs (`src/infrastructure/storage/ttlSweeper.ts`).                                                                                                                              |
| `TTL_RETENTION_MS`      | no       | `3600000` (1 h)                         | Age past which the TTL sweep deletes an output file it finds in `OUTPUT_DIR`. A defensive backstop only — `core` is expected to consume/delete its own output; this catches what's left behind if `core` crashes mid-pipeline. |

All numeric variables are parsed with `z.coerce.number()` (so `"15000"` and `15000` are both accepted) and must be positive integers; a non-numeric or non-positive value fails startup validation the same as a missing required variable.

## Schema source of truth

`src/infrastructure/env/env.ts` (`EnvSchema`) is authoritative — if this document and that file ever disagree, the file wins and this document is stale.
`.env.example` mirrors the same variables with inline comments for local development; keep both in sync when adding or changing a variable.

## Not configurable via env

- **Page selection and DPI** are per-request, sent by `core` in the `extract` op's `config` field (`page_selection`, `dpi`) — see [docs/api.md](api.md). There is no server-side default or override for either.
- **Output filename convention** (`{uniqueId}-{index}.png`) is fixed, not configurable.
