#!/bin/bash
# One frozen round, one command: freeze, serve on its own port, every wall in Chromium and WebKit one at a time under heavy.sh, then every plant. Evidence in runs/<n>/.
#   tools/round.sh <n>                  the whole round (freezes runs/<n>/web if it isn't frozen yet)
#   tools/round.sh <n> walls [a b c]    only the walls (or only the named ones)
#   tools/round.sh <n> plants [names]   only the plants
#   tools/round.sh <n> judge            only the clips for the judge
# ROUND.log has one line a step. Each wall's own lines are in runs/<n>/gate/<wall>_<engine>.txt. The lock is released between walls, so the other builders get their turn.
# Never `set -e`: a red wall is a result, not a stop.
cd "$(dirname "$0")/.."; ROOT=$(pwd)
n=${1:?usage: tools/round.sh <n> [walls|plants|judge] [names]}; what=${2:-all}; shift; shift 2>/dev/null
WHO=qa-r$n; PORT=$((8800 + n)); URL=http://127.0.0.1:$PORT/index.html; RUN=runs/$n; LOG=$RUN/ROUND.log; GATE=$RUN/gate
[ -d "$RUN/web" ] || { bash tools/freeze.sh "$n" || exit 1; }
[ -f "$RUN/MANIFEST.txt" ] || (cd "$RUN/web" && find . -type f -print0 | sort -z | xargs -0 shasum -a 256) > "$RUN/MANIFEST.txt"
mkdir -p "$GATE"
say() { echo "$(date '+%H:%M:%S') $*" | tee -a "$LOG"; }
# the frozen copy, on its own port, for as long as this runs
lsof -ti tcp:$PORT >/dev/null 2>&1 || { node web_check/serve.mjs "$RUN/web" $PORT > "$GATE/serve.log" 2>&1 & SERVE=$!; trap 'kill $SERVE 2>/dev/null' EXIT; sleep 1; }
ENGINES="chromium webkit"
# walls in one turn of the lock, each turn under about 3 minutes, so a round isn't twenty-eight trips through a queue of six builders
turn() { local e=$1; shift; bash ~/.mosa/heavy.sh run "$WHO" -- bash tools/walls.sh "$n" "$e" "$@"; }
if [ "$what" = all ] || [ "$what" = walls ]; then
  # test readiness (EPIC §17): the first line says what this round stands on
  plantsNow=$(node web_check/plants.mjs "$ROOT/$RUN/web" --check 2>&1 | tail -1); swapNow=$(sysctl -n vm.swapusage | sed -E 's/.*used = ([0-9.]+)M.*/\1/')
  say "TRR round $n: frozen $(wc -l < "$RUN/MANIFEST.txt" | tr -d ' ') files, manifest sha $(shasum -a 256 "$RUN/MANIFEST.txt" | cut -c1-16), port $PORT; $plantsNow; swap ${swapNow} MB; heavy: $(bash ~/.mosa/heavy.sh status | head -1 | cut -c1-60)"
  STATIC_OUT="$ROOT/$GATE" node web_check/static.mjs "$RUN/web" > "$GATE/static_any.txt" 2>&1; say "wall static (node) rc=$? $(tail -1 "$GATE/static_any.txt" | cut -c1-120)"
  # the other owners' walls, on this harness or to its contract: <base> <engine>, PASS/FAIL lines, an exit code
  OTHERS=""; for f in web_check/move_walls.mjs web_check/g_*.mjs; do [ -e "$f" ] && OTHERS="$OTHERS $(basename "$f" .mjs)"; done
  # the world's own check, read back from the frozen copy
  if [ -z "$*" ] && [ -f Pipeline/world/check_world.py ]; then
    sed "s#^A = .*#A = '$ROOT/$RUN/web/assets'#" Pipeline/world/check_world.py > "$GATE/check_world_frozen.py"
    PY=~/Documents/Marketing/ContentFunnel/engine/tools/venv_cv/bin/python   # the world's own interpreter (build_all.sh): numpy is there
    (cd Pipeline/world && "$PY" -c "__file__='$ROOT/Pipeline/world/check_world.py'; exec(open('$ROOT/$GATE/check_world_frozen.py').read())") > "$GATE/check_world.txt" 2>&1
    cw=$?; if grep -q '^Traceback' "$GATE/check_world.txt"; then say "wall check_world DID NOT RUN: $(tail -1 "$GATE/check_world.txt" | cut -c1-150): no reading, not a pass and not a fail"
    else say "wall check_world (python) rc=$cw $(grep -c '^FAIL' "$GATE/check_world.txt") FAIL, $(grep -c '^ok' "$GATE/check_world.txt") ok"; fi
  fi
  [ -z "$*" ] && [ -f web_check/formulas.mjs ] && { node web_check/formulas.mjs > "$GATE/formulas.txt" 2>&1; say "wall formulas (node) rc=$? $(tail -1 "$GATE/formulas.txt" | cut -c1-120)"; }
  if [ -n "$*" ]; then for e in $ENGINES; do turn "$e" "$@"; done
  else
    for e in $ENGINES; do
      turn "$e" load play rates
      turn "$e" collide
      turn "$e" drawn
      turn "$e" perf
      turn "$e" pace
      turn "$e" turned
      turn "$e" lowpower lag input
      turn "$e" ui focus
      turn "$e" contrast motion state
      turn "$e" weigh first judged
      turn "$e" cold
      turn "$e" soak
      for o in $OTHERS; do turn "$e" "$o"; done
    done
  fi
  node tools/score.mjs "$n" | tee -a "$LOG"
fi
if [ "$what" = all ] || [ "$what" = plants ]; then
  node web_check/plants.mjs "$ROOT/$RUN/web" --gate="$ROOT/$GATE" --who="$WHO" ${*:+--only=$(echo "$*" | tr ' ' ',')} 2>&1 | tee "$GATE/plants.txt" | while IFS= read -r l; do case "$l" in CAUGHT*|MISSED*|STALE*|PLANTS*) say "$l";; esac; done
fi
if { [ "$what" = all ] || [ "$what" = plants ]; } && [ -z "$*" ] && [ -f web_check/move_plants.mjs ]; then
  total=$(grep -c "{ name: '" web_check/move_plants.mjs); from=0; : > "$GATE/move_plants.txt"
  while [ "$from" -lt "$total" ]; do to=$((from + 18)); bash ~/.mosa/heavy.sh run "$WHO" -- node web_check/move_plants.mjs "$ROOT/$RUN/web" --from=$from --to=$to >> "$GATE/move_plants.txt" 2>&1; from=$to; done
  say "move plants (movement's own runner): $(grep -c '^RED ' "$GATE/move_plants.txt") caught, $(grep -c '^NOT CAUGHT ' "$GATE/move_plants.txt") missed, $(grep -cE '^STALE' "$GATE/move_plants.txt") stale, of $total"
fi
if [ "$what" = judge ]; then bash tools/clips.sh "$n" 2>&1 | tee -a "$LOG"; fi
say "round $n: $what done"
