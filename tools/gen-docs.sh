#!/usr/bin/env bash
# Regenerate docs/api/ — the symbol reference for THIS project.
#
# `milo api` only indexes std, so without this there is no way to grep for a
# project-local helper before writing a duplicate of it. Covers private fns too,
# which is the point: the helpers you collide with are usually not pub.
#
# `milo doc <dir>` recurses; scoping it to src/ documents exactly the engine
# sources and nothing else (test fixtures under tests/milo live outside src).
set -euo pipefail
cd "$(dirname "$0")/.."
milo doc src -o docs/api
echo "docs/api regenerated ($(ls docs/api/*.md | wc -l | tr -d ' ') modules)"
