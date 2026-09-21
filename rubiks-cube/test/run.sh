#!/bin/sh
# Runs every check. No dependencies beyond node.
set -e
cd "$(dirname "$0")"
node cube.test.js
node net.test.js
node teach.test.js
node solver.test.js "${1:-1000}"
echo "all tests passed"
