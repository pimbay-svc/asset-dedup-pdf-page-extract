# Context

> Working memory, not a historical record.
> Continuously edited, not append-only — unlike DECISIONS.md.
> When something here resolves: delete it if it was only ever local/temporary, or promote it to DECISIONS.md if it turned out to matter beyond this moment.
> Don't let resolved items pile up here.

## Current focus

Nothing in progress — repo is in a stable, maintenance state.

## Open questions

None currently.

## Known limitations / non-goals (for now)

- **No hashing here — `core` sends the extracted page paths to `image-hash` itself.**
  This is a deliberate scope narrowing from an earlier HTTP-based design, where this same service also hashed each rendered page via a call back to `asset-dedup-core`'s own `POST /hash` and combined the per-page hashes into one — see `docs/DECISIONS.md`, 2026-07-24, for the full before/after.
  If you find yourself wanting to add hash computation or a combine-strategy here, that almost certainly means the feature belongs in `image-hash`, not here.

- **`pdftoppm` has no arbitrary-page-list mode — one invocation per page.**
  `pdftoppm -f <n> -l <n>` renders a single page at a time; there's no way to ask it for pages `[1, 12, 24]` in one call.
  `PdfProvider.renderPageTo()` therefore spawns one `pdftoppm` invocation per selected page number, each into its own short-lived temp directory, then copies (not renames) the single rendered file into `OUTPUT_DIR`.

## Implementation notes

- **`core` is the client, this service is the server.**
  `core` opens the connection to this service's Unix domain socket and keeps it open, reconnecting on drop — not the other way around.
  `presentation/uds/server.ts` accepts connections via `net.createServer`; it never initiates an outbound connection to `core`.
  A connection only becomes "active" once it sends its first valid frame, not merely on accept — this is what lets the Docker healthcheck (a short-lived connect-and-close probe with no `op` sent) coexist with the real, persistent connection from `core` without racing it.
  If you're touching connection-lifecycle logic, read the comment at the top of `buildUdsServer` first; the healthcheck race is easy to reintroduce by treating any accepted connection as authoritative.

- **Paths in, paths out — never buffers.**
  Socket messages carry only paths and metadata, never raw file bytes (see spec, "Binary data policy").
  `PdfProvider.extractPages()` reads the input PDF directly from its given path and writes each rendered page straight to a file.
  The output filename convention is `{unique_id}-{sequence_index}.png`, where `unique_id` is generated per input (never derived from the request's own `id` keys, which are request-scoped only and can collide across concurrent requests — see spec, "Id scope and temp file naming").
  `copyFile` instead of `rename` on the way into `OUTPUT_DIR` is deliberate: the OS temp dir and `OUTPUT_DIR` (a mounted shared volume in production) can be on different filesystems, and a cross-device `rename` fails with `EXDEV`.

- **Page selection is pure logic, kept separate from process-spawning.**
  `infrastructure/pdf/pageSelection.ts` (`selectPageNumbers`) resolves a `PageSelection` strategy against a real page count from `pdfinfo` without spawning anything itself — kept separate from `PdfProvider` so it's unit-testable in isolation.
  `first-middle-last` deduplicates for short documents: a 1-page PDF yields `[1]`, a 2-page PDF yields `[1, 2]`, never a repeated page number — see `docs/DECISIONS.md`, 2026-07-27, for why this doesn't pad to a fixed count the way `video-frame-extract`'s `scene-change-detection` does.

- **Testing real subprocesses and a real socket.**
  `test/fixtures/multi-page.pdf` (5 blank pages), `single-page.pdf`, and `two-page.pdf` (generated via `pypdf`) back `pdfProvider.test.ts`'s real `pdftoppm`/`pdfinfo` runs — nothing is mocked at the OS level.
  `test/fixtures/corrupt.pdf` is garbage bytes, not a real PDF, for the `CorruptInputError` path.
  `test/fixtures/bin/*.sh` are small fake-binary test doubles (e.g. `fake-pdftoppm-hangs.sh`, `fake-pdfinfo-zero-pages.sh`) used to deterministically hit failure/timeout branches that real `pdftoppm`/`pdfinfo` won't reliably produce on demand — `PDFTOPPM_BIN` and `PDFINFO_BIN` are separate env vars, so unlike `video-frame-extract`'s shared `ffprobe` binary, these fakes never need to discriminate which probe they're standing in for.
  `server.test.ts` (integration) drives a real `net.Server`/`net.Socket` pair rather than mocking the socket layer — connection-lifecycle bugs (the healthcheck race above, in particular) don't show up in a mocked socket.
  `npm run test:coverage` targets 100%.
  `../vitest.config.ts`'s `coverage.exclude` currently contains `server.ts` (bootstrap composition root) and `presentation/uds/healthcheck.ts` (a standalone script invoked directly by Docker `HEALTHCHECK`, never imported by the app itself).
  A couple of genuinely unreachable defensive branches (`match[1] ?? ''` after a regex whose capturing group always participates when the overall match succeeds, a timer callback that can't fire after `clearTimeout` already ran) are marked `/* v8 ignore next */` with a comment explaining why — see `pdfProvider.ts` for examples before adding a new one elsewhere.
  `pageSelection.ts`'s defensive `.filter()`/`.sort()` is a `// Stryker disable` case instead — it's covered and reachable, just provably a no-op given the calling contract (`totalPages >= 1`, enforced upstream), so no test could ever kill those mutants validly.

- **Package identity.**
  `"name": "@pimbay/asset-dedup-pdf-page-extract"`, `"private": true` — a deployed service (image on `ghcr.io`), not an npm library.
  Don't remove `private: true`.

## Ideas / future plans

None currently.
