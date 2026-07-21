#!/usr/bin/env bash
# Deterministically reports a non-positive page count, exercising the CorruptInputError
# guard in probePageCount() that real pdfinfo won't produce on demand.
echo "Pages: 0"
