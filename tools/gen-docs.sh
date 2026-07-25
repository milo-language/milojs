#!/usr/bin/env bash
# Regenerate docs/api/ — the symbol reference for THIS project.
#
# `milo api` only indexes std, so without this there is no way to grep for a
# project-local helper before writing a duplicate of it. Covers private fns too,
# which is the point: the helpers you collide with are usually not pub.
#
# `milo doc <dir>` recurses, so it also documents tests/milo/*.milo. Those are
# fixtures, not API — dropped after generating. It also accepts only ONE path
# argument (a second is silently ignored), so scoping by listing files is not an
# option.
set -euo pipefail
cd "$(dirname "$0")/.."
milo doc . -o docs/api
rm -rf docs/api/tests
echo "docs/api regenerated ($(ls docs/api/*.md | wc -l | tr -d ' ') modules)"
