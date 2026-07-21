# API Reference

`core` opens a single persistent Unix domain socket connection to this service and keeps it open, reconnecting on drop — see `AGENTS.md`, "UDS connection lifecycle".
Every message, both directions, is length-prefixed JSON: `[4-byte big-endian length][UTF-8 JSON payload]` (`src/infrastructure/uds/framing.ts`).
There is no per-request connect/disconnect and no auth — the socket file itself, reachable only on the shared volume, is the trust boundary.

Socket path: `SOCKET_PATH` (see [docs/configuration.md](configuration.md)).
Requests are dispatched by their `op` field (`src/presentation/uds/server.ts`); an unrecognized `op` is logged and silently ignored — no error frame is sent back, since there's no request id to correlate a reply to on a fire-and-forget bad message.

## Error format

Per-item errors (not connection- or transport-level failures) share one shape, keyed under `outputs[<id>].error`:

```json
{ "code": "corrupt_input", "message": "human-readable message" }
```

| Code             | Meaning                                                                                                                                                                                      |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `corrupt_input`  | The PDF itself is unreadable/malformed — page count can't be determined, `pdftoppm` rejects the document, a selected page can't be rendered.                                                 |
| `internal_error` | `pdftoppm`/`pdfinfo` failed to start, timed out, or crashed for reasons unrelated to the input file's validity — also used for a request-level problem like an unsupported `page_selection`. |

A failure on one item in a batch never prevents the rest from being attempted — each input is handled independently, and its result (success or error, never both) is reported under its own key in `outputs`, mirroring the request's `inputs` keys exactly.

---

## `op: "extract"`

Renders selected pages of each input PDF to PNG and writes them on the shared volume.
Handled by `src/presentation/uds/socket/extract.socket.ts`.

**Request**

```json
{
  "op": "extract",
  "config": {
    "page_selection": "first-middle-last",
    "dpi": 150
  },
  "inputs": {
    "id1": { "path": "/shared/asset-def456.pdf" }
  }
}
```

| Field                   | Type                             | Description                                                                                                                                                                                                                                          |
| ----------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `config.page_selection` | `"first-middle-last"` \| `"all"` | `first-middle-last`: page 1, the middle page, and the last page, deduplicated for short documents (a 1-page PDF yields just page 1). `all`: every page. Invalid value fails the whole batch (see below), not per item.                               |
| `config.dpi`            | `number`                         | Render resolution passed to `pdftoppm`.                                                                                                                                                                                                              |
| `inputs.<id>.path`      | `string`                         | Absolute path to the source PDF, already readable on the shared volume — never file bytes. `<id>` is request-scoped only (never used to derive output filenames — see `AGENTS.md`, "Subprocess delegation") and can repeat across separate requests. |

**Response**

```json
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

One entry per input key, in the same shape as the request's `inputs`: either `{ "paths": string[] }` on success (one path per rendered page, in ascending physical page-number order) or `{ "error": { "code", "message" } }` on failure — never both.
Output filenames follow `{uniqueId}-{index}.png` under `OUTPUT_DIR`, where `uniqueId` is generated per input item (not derived from the request's own `id` keys).

**Fewer pages than requested is not an error.** A 1-page PDF asked for `first-middle-last` returns a single-entry `paths` array — pages are never duplicated to pad the count.

**Errors**

| Code             | Cause                                                                                                                                                                                                                                                                                                                                                 |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `corrupt_input`  | Per item. Page-count probe or page render failed against that specific PDF.                                                                                                                                                                                                                                                                           |
| `internal_error` | Per item, for a `pdftoppm`/`pdfinfo` process failure unrelated to the input; or for every item in the batch at once if `config.page_selection` isn't a recognized value or `config.dpi` isn't a positive integer — a malformed request-level config is reported the same way for every `id` in `inputs`, rather than silently substituting a default. |

**Example** (using `scripts/dev/extract.sh`, which speaks this protocol directly — there is no `curl` equivalent since this isn't HTTP):

```bash
scripts/dev/extract.sh --pdf /shared/asset-def456.pdf --page-selection all --dpi 150
```

---

Any other `op` value is logged as a warning and ignored; no response frame is sent.
A structurally malformed `extract` message (missing `config`/`inputs`, wrong field types) fails zod validation (`ExtractRequestSchema` in `extract.socket.ts`) the same way — logged as a warning and dropped entirely, no response frame — rather than throwing and taking down the connection.
