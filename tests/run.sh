#!/bin/sh
# Run the full JS test suite. Exit 0 iff every test passes.
set -u
cd "$(dirname "$0")"
node run.js
