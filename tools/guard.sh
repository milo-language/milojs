#!/usr/bin/env bash
# Run a command under a process-group watchdog.
#
# Why this exists: a milojs bug in child_process/fork can turn one node test
# into a fork bomb (node's tests re-exec themselves via `fork(__filename, [...])`
# and detect the child from argv; get argv wrong and every child re-runs the
# parent branch). Each milojs process carries a full interpreter heap, so the
# machine is out of RAM long before anything times out. That has already taken
# this machine down once.
#
# So: nothing that spawns milojs runs bare. Wrap it here. The command gets its
# own process group; a watchdog polls the group's process count and total RSS
# and SIGKILLs the whole group the moment either crosses a limit, which is the
# part `timeout(1)` cannot do (it signals one pid; the grandchildren survive and
# keep multiplying).
#
#   tools/guard.sh ./tests/run.sh
#   GUARD_MAX_PROCS=60 GUARD_TIMEOUT=1800 tools/guard.sh bun scripts/node-compat-sweep.ts
#
# Exit 99 = the watchdog fired. Anything else is the command's own status.
set -uo pipefail

if [ $# -eq 0 ]; then
  echo "usage: tools/guard.sh <command> [args...]" >&2
  exit 2
fi

# Physical RAM in MB, so the default cap scales with the machine rather than
# being a number tuned on one laptop.
mem_mb=$(( $(sysctl -n hw.memsize 2>/dev/null || echo $((8 * 1024 * 1024 * 1024))) / 1024 / 1024 ))

GUARD_MAX_PROCS=${GUARD_MAX_PROCS:-80}          # processes in the group
GUARD_MAX_RSS_MB=${GUARD_MAX_RSS_MB:-$(( mem_mb / 2 ))}
GUARD_TIMEOUT=${GUARD_TIMEOUT:-1800}            # wall-clock seconds
GUARD_POLL=${GUARD_POLL:-2}
GUARD_QUIET=${GUARD_QUIET:-0}

note() { [ "$GUARD_QUIET" = "1" ] || echo "guard: $*" >&2; }

# The watchdog polls, and a real fork bomb doubles faster than any poll
# interval. RLIMIT_NPROC is the part the KERNEL enforces: once the uid is at the
# cap, fork() returns EAGAIN instantly and the bomb cannot grow at all. The cap
# is set relative to what this uid is already running, so it bounds the guarded
# subtree without breaking whatever the user has open.
uid_procs=$(ps -U "$(id -u)" -o pid= 2>/dev/null | wc -l | tr -d ' ')
GUARD_NPROC=${GUARD_NPROC:-$(( uid_procs + 150 ))}
hard=$(ulimit -H -u 2>/dev/null)
if [ "$hard" != "unlimited" ] && [ -n "$hard" ] && [ "$GUARD_NPROC" -gt "$hard" ]; then
  GUARD_NPROC=$hard
fi
ulimit -u "$GUARD_NPROC" 2>/dev/null \
  && note "RLIMIT_NPROC capped at $GUARD_NPROC (uid currently at $uid_procs)" \
  || note "WARNING: could not set RLIMIT_NPROC; polling watchdog is the only defence"

# Job control gives the child its own process group, so `kill -- -PGID` reaches
# every descendant no matter how deep it forked.
set -m
"$@" &
child=$!
set +m

# The pgid is normally the child pid, but read it back rather than assume: if
# job control were unavailable the child would share OUR group and killing it
# would kill the watchdog and this script too.
pgid=$(ps -o pgid= -p "$child" 2>/dev/null | tr -d ' ')
if [ -z "$pgid" ]; then
  wait "$child"; exit $?
fi
if [ "$pgid" = "$(ps -o pgid= -p $$ | tr -d ' ')" ]; then
  note "WARNING: no separate process group; watchdog limited to pid $child"
  pgid=""
fi

marker=$(mktemp -t guardtrip)
rm -f "$marker"

note "watching pid $child pgid ${pgid:-none} (max ${GUARD_MAX_PROCS} procs, ${GUARD_MAX_RSS_MB} MB rss, ${GUARD_TIMEOUT}s)"

# Runs inside the watchdog subshell, so `exit` here cannot set this script's
# status. It leaves a marker instead and the parent reads it after wait().
reap() {
  local why=$1
  note "KILL - $why"
  echo "$why" > "$marker"
  if [ -n "$pgid" ]; then
    kill -9 -- "-$pgid" 2>/dev/null
  else
    kill -9 "$child" 2>/dev/null
  fi
  # Belt and braces: anything that escaped the group by re-parenting to launchd
  # still answers to its own name.
  pkill -9 -f 'mj-runtime|mj-engine|milojs_' 2>/dev/null
  exit 99
}

(
  elapsed=0
  while kill -0 "$child" 2>/dev/null; do
    if [ -n "$pgid" ]; then
      # One ps, two numbers: count of processes in the group and their summed RSS.
      read -r n rss < <(ps -A -o pgid=,rss= 2>/dev/null | awk -v g="$pgid" \
        '$1==g { n++; r+=$2 } END { printf "%d %d\n", n+0, (r+0)/1024 }')
      [ "${n:-0}" -gt "$GUARD_MAX_PROCS" ] && reap "$n processes in group (limit $GUARD_MAX_PROCS) — looks like a fork bomb"
      [ "${rss:-0}" -gt "$GUARD_MAX_RSS_MB" ] && reap "${rss} MB resident (limit $GUARD_MAX_RSS_MB)"
    fi
    # System-wide free memory floor: something outside the group can still be
    # the thing that wedges the machine, and a wedged machine is the failure we
    # are actually preventing.
    free_mb=$(vm_stat 2>/dev/null | awk '/page size of/ { ps=$8 } /Pages free/ { f=$3 } /Pages inactive/ { i=$3 } END { gsub(/\./,"",f); gsub(/\./,"",i); printf "%d", (f+i)*ps/1048576 }')
    if [ -n "${free_mb:-}" ] && [ "$free_mb" -lt 512 ]; then
      reap "system free+inactive memory down to ${free_mb} MB"
    fi
    sleep "$GUARD_POLL"
    elapsed=$(( elapsed + GUARD_POLL ))
    [ "$elapsed" -ge "$GUARD_TIMEOUT" ] && reap "wall-clock timeout after ${elapsed}s"
  done
) &
watchdog=$!

wait "$child"; status=$?
kill "$watchdog" 2>/dev/null
wait "$watchdog" 2>/dev/null
if [ -f "$marker" ]; then
  note "command was killed by the watchdog: $(cat "$marker")"
  rm -f "$marker"
  exit 99
fi
rm -f "$marker"
exit $status
