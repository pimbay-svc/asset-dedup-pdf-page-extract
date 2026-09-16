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

- **`pdftoppm` has no arbitrary-page-list mode — one invocation per page.**
  `pdftoppm -f <n> -l <n>` renders a single page at a time; there's no way to ask it for pages `[1, 12, 24]` in one call.
  `PdfProvider.renderPageTo()` therefore spawns one `pdftoppm` invocation per selected page number, each into its own short-lived temp directory, then copies (not renames) the single rendered file into `OUTPUT_DIR`.

## Implementation notes

None currently.

## Ideas / future plans

None currently.
