# Decisions

> Append-only architectural decision log — the "why", not the "what's next" (that's context.md).
> One entry per decision: what was decided and why, not a discussion transcript.
> If it's a cheap/local implementation detail → docs/context.md instead.
> If it's a pattern repeated across multiple repos → AGENTS.md instead, not here.

## PDF passed to `pdftoppm` via temp file, not stdin

**Date:** 2026-07-21

**Decision:** Temp file + path argument.

**Why:** `pdftoppm` has no stdin-streaming mode for multi-page PDF output in the first place, so this wasn't purely a style choice — but it has a real side benefit worth recording: `asset-dedup-core`'s stdin-piping approach hit a production `EPIPE` crash (an unhandled 'error' event on `child.stdin` when the worker process exits mid-write on a large buffer).
Passing data via a file argument doesn't have that failure mode at all.

**Alternatives considered:** pipe the PDF bytes to `pdftoppm` over stdin (matching how `asset-dedup-core`'s `ImagehashRunner` pipes image bytes to its Python worker).

## Unix domain socket, paths on a shared volume, no hashing in this service

**Date:** 2026-07-24

**Decision:** UDS, paths only, no hashing — `core` connects once and keeps the connection open; this service only renders pages and writes them as PNGs, `core` sends the resulting paths to `image-hash` itself.

**Why:** base64-over-HTTP made every request pay a full document's encode/decode cost, and coupled this service's own logic to hash computation and combine-strategy selection it has no business owning — splitting rendering from hashing lets each extension evolve independently and lets `core` batch page paths across extensions however it wants.
Paths-on-a-shared-volume also removes the need to hold every rendered page in memory at once.
Pages still go through a temp directory on the way to `pdftoppm`, but the final artifact is a file on the shared volume, not a base64 string in an HTTP response — see `AGENTS.md` and `docs/context.md` for what actually ships now.

**Alternatives considered:** keep the original HTTP `POST /hash` design (base64 PDF in, pages rendered to a per-request temp directory and read back into memory, hashed here, result returned).

**Supersedes:** PDF passed to `pdftoppm` via temp file, not stdin — only insofar as pages are no longer read back into memory afterward; the temp-file-to-`pdftoppm` mechanism itself is unchanged.

## `first-middle-last` deduplicates instead of padding to a fixed count

**Date:** 2026-07-27

**Decision:** Deduplicate — a 1-page PDF returns `[1]`, a 2-page PDF returns `[1, 2]`, never a repeated page.

**Why:** unlike `video-frame-extract`'s `scene-change-detection` (which tops up a short result to a caller-specified `frame_count` because that count has direct downstream meaning, e.g. sizing a hash pool), `first-middle-last` has no equivalent caller-specified target — it's a fixed 3-landmark heuristic, and a repeated page number would just waste a render and produce a duplicate hash on the core side for no benefit.
`all` is unaffected by this question — it already returns exactly the document's real page count by definition.

**Alternatives considered:** always return exactly 3 pages for `first-middle-last`, padding with a repeated or nearby page number on short documents.
