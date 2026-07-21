#!/usr/bin/env bash
# Usage: scripts/dev/extract.sh --pdf <path> [--page-selection <all|first-middle-last>] [--dpi <n>] [--socket-path <path>]
#
# All parameters are named flags and can be given in any order. --pdf is the only required one.
#
# Examples:
#   scripts/dev/extract.sh --pdf /shared/asset-def456.pdf
#   scripts/dev/extract.sh --pdf /shared/asset-def456.pdf --page-selection all
#   scripts/dev/extract.sh --page-selection first-middle-last --dpi 150 --pdf /shared/asset-def456.pdf
#   scripts/dev/extract.sh --socket-path /sockets/pdf-page-extract.sock --pdf /shared/asset-def456.pdf --page-selection all --dpi 150
#
# PDF_PATH must already be a path this extension can read directly — i.e. somewhere on the shared
# volume, not a path on your host machine. Only the path is sent over the socket, never file bytes.
set -euo pipefail

usage() {
  echo "usage: extract.sh --pdf <pdf-path-on-shared-volume> [--page-selection <all|first-middle-last>] [--dpi <n>] [--socket-path <path>]" >&2
  exit 1
}

PDF_PATH=""
PAGE_SELECTION="first-middle-last"
DPI="150"
SOCKET_PATH="./var/dev/pdf-page-extract.sock"

while [ $# -gt 0 ]; do
  case "$1" in
    --pdf)
      PDF_PATH="${2:?--pdf requires a value}"
      shift 2
      ;;
    --page-selection)
      PAGE_SELECTION="${2:?--page-selection requires a value}"
      shift 2
      ;;
    --dpi)
      DPI="${2:?--dpi requires a value}"
      shift 2
      ;;
    --socket-path)
      SOCKET_PATH="${2:?--socket-path requires a value}"
      shift 2
      ;;
    -h | --help)
      usage
      ;;
    *)
      echo "unknown argument: $1" >&2
      usage
      ;;
  esac
done

[ -n "$PDF_PATH" ] || usage

echo "extract op -> $SOCKET_PATH  (path: $PDF_PATH, page_selection: $PAGE_SELECTION, dpi: $DPI)" >&2

npx tsx "$(dirname "$0")/extract-client.ts" "$SOCKET_PATH" "$PDF_PATH" "$PAGE_SELECTION" "$DPI"
