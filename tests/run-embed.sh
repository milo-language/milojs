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
# -lsqlite3 is required because node:sqlite calls libsqlite3 directly. Milo adds
# that flag itself when it links a binary, but an embedder linking libmilojs.a
# with its own compiler does not get it, so the archive has undefined sqlite3_*
# symbols until the embedder names the library.
if [ -z "${MILOJS_EMBED_LIBS:-}" ]; then
  case "$(uname -s)" in
    Darwin) MILOJS_EMBED_LIBS="-lssl -lcrypto -lsqlite3 -pthread" ;;
    *)      MILOJS_EMBED_LIBS="-lm -lssl -lcrypto -lsqlite3 -ldl -pthread" ;;
  esac
fi
# macOS OpenSSL is keg-only under Homebrew — its headers/libs are off the default
# search path, so -lssl fails to resolve without pointing the compiler at the keg.
if [ -z "${MILOJS_EMBED_CFLAGS:-}" ]; then
  case "$(uname -s)" in
    Darwin)
      OPENSSL_PREFIX="$(brew --prefix openssl@3 2>/dev/null || brew --prefix openssl 2>/dev/null || echo /opt/homebrew/opt/openssl@3)"
      MILOJS_EMBED_CFLAGS="-I$OPENSSL_PREFIX/include -L$OPENSSL_PREFIX/lib" ;;
    *) MILOJS_EMBED_CFLAGS="" ;;
  esac
fi

"${MILO_RUN[@]}" build-lib src/libmilojs.milo -o "$TMP/libmilojs.a"
cp include/milojs.h "$TMP/milojs.h"
"$CC" -std=c11 -Wall -Wextra -Werror -I"$TMP" $MILOJS_EMBED_CFLAGS \
  tests/embed/context.c "$TMP/libmilojs.a" $MILOJS_EMBED_LIBS -o "$TMP/context"
"$TMP/context"
"$CC" -std=c11 -Wall -Wextra -Werror -I"$TMP" $MILOJS_EMBED_CFLAGS \
  examples/embed/hello.c "$TMP/libmilojs.a" $MILOJS_EMBED_LIBS -o "$TMP/hello"
test "$("$TMP/hello")" = "hello from embedded milo, woof! the answer is 42"
