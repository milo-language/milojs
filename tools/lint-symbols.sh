#!/usr/bin/env bash
# Guard against the one hazard Milo's flat namespace creates and the compiler
# does not report: two top-level definitions of the same name.
#
# Milo compiles every .milo file in a program into ONE namespace, and a repeated
# definition is accepted silently — the LAST one wins. That is not theoretical.
# This repo shipped `propertyBagOf` twice with DIFFERENT bodies: the live copy
# handled native receivers, the dead one returned -1 for them. Nothing warned.
# It also shipped `hexDigitVal` in two files and `isUndefinedValue` twice in one.
#
# Two checks:
#   1. duplicate top-level definitions inside this project
#   2. project definitions that shadow a std symbol of the same name (this broke
#      std internally once already, when a milojs helper shadowed strIndexOf)
#
# No --fix: choosing which duplicate to delete needs a human or an agent to read
# both bodies, and picking wrong silently changes behavior. The report gives
# exact file:line for every copy so the fix is mechanical.
#
# Usage: tools/lint-symbols.sh [--quiet]
set -uo pipefail
cd "$(dirname "$0")/.."

quiet=0
[ "${1:-}" = "--quiet" ] && quiet=1
status=0

# `main` is legitimately defined twice: milojs.milo and milojs-engine.milo are
# separate programs, never compiled together.
ALLOWED_DUPES="main"

defs=$(grep -nHoE '^(pub )?fn [a-zA-Z0-9_]+' src/*.milo \
       | sed -E 's/:(pub )?fn /:/' )

dupes=$(echo "$defs" | awk -F: '{print $3}' | sort | uniq -d)

for name in $dupes; do
    case " $ALLOWED_DUPES " in *" $name "*) continue ;; esac
    status=1
    echo "duplicate definition: $name"
    echo "$defs" | awk -F: -v n="$name" '$3 == n {printf "    %s:%s\n", $1, $2}'
done

# std symbols, dumped in one call rather than one lookup per name
std=$(milo api --markdown 2>/dev/null \
      | grep -oE '^### `[^`]+`' | sed 's/^### `//;s/`$//' \
      | grep -v '\.' | sort -u)

if [ -z "$std" ]; then
    echo "warning: could not read std symbols (\`milo api --markdown\` gave nothing);" >&2
    echo "         the shadowing check did not run." >&2
else
    ours=$(echo "$defs" | awk -F: '{print $3}' | sort -u)
    shadowed=$(comm -12 <(echo "$ours") <(echo "$std"))
    for name in $shadowed; do
        status=1
        echo "shadows std: $name"
        echo "$defs" | awk -F: -v n="$name" '$3 == n {printf "    %s:%s\n", $1, $2}'
        milo api "$name" 2>/dev/null | grep -E "^std/[a-z0-9]+ +(pub )?fn $name\(" \
            | sed 's/^/    /'
    done
fi

if [ "$status" -eq 0 ] && [ "$quiet" -eq 0 ]; then
    echo "lint-symbols: no duplicate or std-shadowing definitions"
fi
exit "$status"
