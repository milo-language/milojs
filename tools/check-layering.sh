#!/usr/bin/env bash
# Keeps src/engine/ the ECMAScript language and nothing else.
#
# src/ is split three ways:
#   src/engine/   the language: lexer, parser, values, heap+GC, evaluator, the
#                 spec built-ins, regex, bigint, the Unicode tables
#   src/runtime/  host bindings: the module loader, Node-API, fetch/child
#                 process/sqlite, the REPL and its completer
#   src/          the three entry points that pick a side and link it
#
# The split is only worth anything if something enforces it, so this is the
# enforcement. Two halves, because there are two ways the engine reaches the
# host and only the first is visible in an import graph:
#
#   1. IMPORT EDGES — a file on the engine side importing from src/runtime/.
#   2. ENGINE GLOBAL SURFACE — src/engine/bootstrap.milo defines the `__`-prefixed
#      natives that the JS-written built-ins call. Some of those are engine
#      intrinsics (__construct, __reflectGet); most are host bindings (sqlite,
#      tcp, spawn, fs), and they are installed by the ENGINE, so `milojs-engine`
#      answers `function` for __sqliteOpen. No import edge shows that.
#
# Both halves are ratchets against src/.layering-exempt, in the shape
# tests/.node-oracle-exempt already uses here: every hole in the rule is a line
# in one file with an argument next to it, rather than a comment at the top of a
# source file that nobody reads. A registered exemption that no longer applies is
# ALSO a failure — the list is only allowed to shrink.
#
# Anti-vacuity: this prints what it scanned, and fails if it scanned
# suspiciously little. A gate that silently checks nothing is worse than no gate,
# and this repo has already shipped two of those (check-arity.mjs reporting
# "0 checked" and exiting 0; check-gaps quietly dropping two of six probes).
#
# Usage: tools/check-layering.sh [--quiet]
set -uo pipefail
cd "$(dirname "$0")/.."

quiet=0
[ "${1:-}" = "--quiet" ] && quiet=1
status=0

EXEMPT_FILE="src/.layering-exempt"

# The engine side: everything under src/engine/, plus the two entry points that
# are engine-only programs. src/milojs.milo is the runtime entry point and is
# expected to import both sides.
engine_files=$( { find src/engine -name '*.milo'; echo src/milojs-engine.milo; echo src/libmilojs.milo; } | sort )

# --- anti-vacuity: the file set ---
n_files=$(echo "$engine_files" | grep -c . )
if [ "$n_files" -lt 15 ]; then
    echo "check-layering: only $n_files engine-side files found — the scan is broken, not clean" >&2
    exit 1
fi

# --- half 1: import edges ---
#
# Milo imports are by path: `from "../runtime/host" import { ... }`. Resolve each
# relative specifier against the importing file's directory and see where it
# lands. std/ imports are not project files and are skipped.

# dir + spec -> repo-relative .milo path. Only ./ and ../ appear in Milo
# specifiers, so this is the whole of path resolution.
resolve() {
    local dir="$1" spec="$2"
    while :; do
        case "$spec" in
            ./*)  spec=${spec#./} ;;
            ../*) spec=${spec#../}; dir=$(dirname "$dir") ;;
            *)    break ;;
        esac
    done
    [ "$dir" = "." ] && { printf '%s.milo\n' "$spec"; return; }
    printf '%s/%s.milo\n' "$dir" "$spec"
}

edges=$(
    echo "$engine_files" | while IFS= read -r f; do
        dir=$(dirname "$f")
        grep -nE '^[[:space:]]*from "\.\.?/' "$f" | while IFS= read -r line; do
            lineno=${line%%:*}
            spec=$(printf '%s' "$line" | sed -E 's/^[0-9]+:[[:space:]]*from "([^"]+)".*/\1/')
            printf '%s\t%s\t%s\n' "$f" "$lineno" "$(resolve "$dir" "$spec")"
        done
    done
)

n_edges=$(printf '%s' "$edges" | grep -c . )
if [ "$n_edges" -lt 40 ]; then
    echo "check-layering: only $n_edges relative imports parsed across $n_files files — the parse is broken" >&2
    exit 1
fi

# Registered exemptions, "<from> -> <to>" before any whitespace-separated reason.
exempt_edges=$(grep -E '^[^#]*[^ ] -> ' "$EXEMPT_FILE" 2>/dev/null \
    | sed -E 's/^([^ ]+) -> ([^ ]+).*/\1 -> \2/' | sort -u)

seen_edges=""
while IFS=$'\t' read -r f lineno target; do
    case "$target" in src/runtime/*) ;; *) continue ;; esac
    edge="$f -> $target"
    seen_edges="$seen_edges$edge
"
    if echo "$exempt_edges" | grep -qxF "$edge"; then
        continue
    fi
    status=1
    echo "layering violation: $f:$lineno imports $target"
    echo "    src/engine/ is the language; src/runtime/ is the host. If this edge"
    echo "    is genuinely unavoidable, register it in $EXEMPT_FILE with an argument."
done <<< "$edges"

# A registered exemption that no longer occurs is stale: delete the line. Without
# this the file only ever grows and stops describing the tree.
seen_sorted=$(printf '%s' "$seen_edges" | grep . | sort -u)
while IFS= read -r e; do
    [ -z "$e" ] && continue
    if ! echo "$seen_sorted" | grep -qxF "$e"; then
        status=1
        echo "stale layering exemption: $e no longer exists — delete its line from $EXEMPT_FILE"
    fi
done <<< "$exempt_edges"

# --- half 2: the engine's global surface ---
#
# Every `__`-prefixed global src/engine/bootstrap.milo installs must be classified
# in the exempt file as either an engine intrinsic or a registered host binding.
# An unclassified one fails: adding a host native to the engine's bootstrap should
# cost a line and an argument, not nothing.
BOOTSTRAP="src/engine/bootstrap.milo"
globals=$(grep -oE 'scopeDefine\(st, 0, "__[A-Za-z0-9_]+"' "$BOOTSTRAP" \
    | sed -E 's/.*"(.*)"/\1/' | sort -u)
n_globals=$(printf '%s' "$globals" | grep -c . )
if [ "$n_globals" -lt 50 ]; then
    echo "check-layering: only $n_globals __-globals found in $BOOTSTRAP — the scan is broken" >&2
    exit 1
fi

classified=$(grep -E '^global:' "$EXEMPT_FILE" 2>/dev/null | awk '{print $2}' | sort -u)

unclassified=$(comm -23 <(echo "$globals") <(echo "$classified"))
for g in $unclassified; do
    status=1
    echo "unclassified engine global: $g"
    echo "    $BOOTSTRAP installs it, so the milojs-engine binary exposes it."
    echo "    Add a 'global: $g <engine-intrinsic|host-native> <argument>' line to $EXEMPT_FILE."
done

gone=$(comm -13 <(echo "$globals") <(echo "$classified"))
for g in $gone; do
    status=1
    echo "stale global classification: $g is no longer installed by $BOOTSTRAP — delete its line from $EXEMPT_FILE"
done

if [ "$status" -eq 0 ] && [ "$quiet" -eq 0 ]; then
    n_viol=$(printf '%s' "$seen_sorted" | grep -c . )
    n_host=$(grep -cE '^global:.* host-native' "$EXEMPT_FILE")
    echo "check-layering: $n_files engine files, $n_edges imports, $n_globals engine globals checked"
    echo "check-layering: 0 unregistered engine->runtime edges ($n_viol registered), 0 unclassified globals ($n_host registered as host)"
fi
exit "$status"
