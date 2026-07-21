#!/usr/bin/env bash
# Produces no "Pages:" line and writes nothing to stderr — exercises the generic-message
# fallback in probePageCount() that a real pdfinfo failure won't produce on demand (it always
# writes something to stderr for an unreadable file).
exit 0
