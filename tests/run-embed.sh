#!/usr/bin/env bash
# Build the public static library/header, then compile and run a C consumer.
set -euo pipefail
cd "$(dirname "$0")/.."

MILO="${MILO:-milo}"
case "$MILO" in
  *.ts) MILO_RUN=(bun run "$MILO") ;;
  *)    MILO_RUN=("$MILO") ;;
esac

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

if [ -z "${CC:-}" ]; then
  for candidate in clang clang-18 cc; do
    if command -v "$candidate" >/dev/null 2>&1; then
      CC="$candidate"
      break
    fi
  done
fi
: "${CC:?no C compiler found; set CC}"
if [ -z "${MILOJS_EMBED_LIBS:-}" ]; then
  case "$(uname -s)" in
    Darwin) MILOJS_EMBED_LIBS="-lssl -lcrypto -pthread" ;;
    *)      MILOJS_EMBED_LIBS="-lm -lssl -lcrypto -ldl -pthread" ;;
  esac
fi

"${MILO_RUN[@]}" build-lib libmilojs.milo -o "$TMP/libmilojs.a"
cp include/milojs.h "$TMP/milojs.h"
"$CC" -std=c11 -Wall -Wextra -Werror -I"$TMP" \
  tests/embed/context.c "$TMP/libmilojs.a" $MILOJS_EMBED_LIBS -o "$TMP/context"
"$TMP/context"
"$CC" -std=c11 -Wall -Wextra -Werror -I"$TMP" \
  examples/embed/hello.c "$TMP/libmilojs.a" $MILOJS_EMBED_LIBS -o "$TMP/hello"
test "$("$TMP/hello")" = "hello from embedded milo, woof! the answer is 42"
