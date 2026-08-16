#!/usr/bin/env bash
# Boot real Node applications under milojs and diff their HTTP responses against
# node's, byte for byte.
#
# Why this exists: the fixture suite and test262 both missed defects that a real
# dependency tree hit within minutes (express would not load at all; `[\s\S]`
# silently served an untouched HTML template; `var undefined;` in get-intrinsic
# killed four apps at their first require). An application exercises module
# resolution, native addons, the event loop and HTTP together, which no fixture
# here does.
#
#   tools/check-apps.sh            # every app that is present
#   tools/check-apps.sh chat       # one app by name
#
# Apps live outside this repo, so each is SKIPPED rather than failed when its
# checkout or node_modules is missing. Point MILOJS_APPS_ROOT elsewhere to move
# the whole set.
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

ROOT="${MILOJS_APPS_ROOT:-$HOME/git/digitalocean}"
RUNTIME="${MILOJS_RUNTIME_BIN:-.dev/mj-runtime}"
FILTER="${1:-}"
NODE_BIN="${NODE:-node}"

if [ ! -x "$RUNTIME" ]; then
  echo "check-apps: no runtime at $RUNTIME (run tools/dev.sh first)" >&2
  exit 1
fi
RUNTIME="$(cd "$(dirname "$RUNTIME")" && pwd)/$(basename "$RUNTIME")"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"; pkill -9 -f "$TMP" 2>/dev/null' EXIT

# name | subdir | entry | port | env | routes (space separated)
APPS=(
  "tahoeroads|tahoeroads/backend|dist/index.js|3009|JWT_SECRET=x|/ /health /sitemap.xml /robots.txt /nope"
  "chat|chat|server.js|3006||/ /nope"
)

# Boot $1 (a binary) on the app and capture every route into $2.
capture() {
  local bin="$1" out="$2" dir="$3" entry="$4" port="$5" envs="$6" routes="$7"
  # `exec` matters: without it $! is the subshell and `kill` leaves the server
  # itself running, holding the port and leaking a process per invocation.
  ( cd "$dir" && exec env $envs "$bin" "$entry" >"$TMP/boot.log" 2>&1 ) &
  local pid=$!
  local i
  for i in $(seq 1 20); do
    lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1 && break
    perl -e 'select(undef,undef,undef,0.5)'
  done
  if ! lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    kill -9 $pid 2>/dev/null
    return 1
  fi
  : >"$out"
  local r
  for r in $routes; do
    curl -s -m 10 "http://127.0.0.1:$port$r" >>"$out" 2>&1
  done
  kill -9 $pid 2>/dev/null
  wait $pid 2>/dev/null
  # let the port drain before the next boot binds it
  for i in $(seq 1 10); do
    lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1 || break
    perl -e 'select(undef,undef,undef,0.5)'
  done
  return 0
}

fail=0
ran=0
skipped=0
for spec in "${APPS[@]}"; do
  IFS='|' read -r name sub entry port envs routes <<<"$spec"
  [ -n "$FILTER" ] && [ "$FILTER" != "$name" ] && continue
  dir="$ROOT/$sub"
  if [ ! -f "$dir/$entry" ] || [ ! -d "$dir/node_modules" ]; then
    echo "skip $name (no $dir/$entry or its node_modules)"
    skipped=$((skipped + 1))
    continue
  fi
  ran=$((ran + 1))
  if ! capture "$NODE_BIN" "$TMP/$name.node" "$dir" "$entry" "$port" "$envs" "$routes"; then
    echo "SKIP $name (node itself did not bind :$port)"
    skipped=$((skipped + 1))
    ran=$((ran - 1))
    continue
  fi
  if ! capture "$RUNTIME" "$TMP/$name.milo" "$dir" "$entry" "$port" "$envs" "$routes"; then
    echo "FAIL $name (milojs did not bind :$port)"
    sed -n '1,15p' "$TMP/boot.log" | sed 's/^/      /'
    fail=$((fail + 1))
    continue
  fi
  if diff -q "$TMP/$name.node" "$TMP/$name.milo" >/dev/null 2>&1; then
    echo "ok   $name ($(wc -c <"$TMP/$name.milo" | tr -d ' ') bytes over $(echo $routes | wc -w | tr -d ' ') routes)"
  else
    echo "FAIL $name (response differs from node)"
    diff "$TMP/$name.node" "$TMP/$name.milo" | sed -n '1,20p' | sed 's/^/      /'
    fail=$((fail + 1))
  fi
done

echo "check-apps: $ran compared, $fail failed, $skipped skipped"
[ "$fail" -eq 0 ]
