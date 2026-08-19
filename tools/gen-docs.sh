#!/usr/bin/env bash
# Regenerate docs/api/ — the symbol reference for THIS project.
#
# `milo api` only indexes std, so without this there is no way to grep for a
# project-local helper before writing a duplicate of it. Covers private fns too,
# which is the point: the helpers you collide with are usually not pub.
#
# `milo doc <dir>` recurses; scoping it to src/ documents exactly the engine
# sources and nothing else (test fixtures under tests/milo live outside src).
# It mirrors src/'s shape, so docs/api/engine/ and docs/api/runtime/ track the
# layering split.
#
# The output directory is emptied first: `milo doc` writes the modules it finds
# and never deletes, so after the engine/runtime split every pre-split file
# stayed behind as a stale copy of a page that had moved. A generated tree that
# accumulates orphans is worse than none, because agents grep it and trust it.
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf docs/api
milo doc src -o docs/api
echo "docs/api regenerated ($(find docs/api -name '*.md' | wc -l | tr -d ' ') modules)"
