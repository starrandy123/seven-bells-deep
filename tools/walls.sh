#!/bin/bash
# Run walls one after another, inside one turn of the heavy lock. Called by tools/round.sh, which holds the lock. Never takes it itself.
#   tools/walls.sh <n> <engine> <wall> [wall...]
cd "$(dirname "$0")/.."; ROOT=$(pwd); n=$1; e=$2; shift 2
RUN=runs/$n; GATE=$RUN/gate; URL=http://127.0.0.1:$((8800 + n))/index.html; LOG=$RUN/ROUND.log
for w in "$@"; do
  t0=$(date +%s); f="$GATE/${w}_${e}.txt"
  node "web_check/$w.mjs" "$URL" "$e" --out="$ROOT/$GATE" > "$f" 2>&1; rc=$?
  sum=$(grep -E "^[a-z_0-9]+ $e: [0-9]+ of " "$f" | tail -1)
  # a wall with no summary line of its own (the g_*.mjs walls): counted from its lines; no lines at all is no reading
  if [ -z "$sum" ]; then p=$(grep -c '^PASS ' "$f"); q=$(grep -c '^FAIL ' "$f"); if [ $((p + q)) -gt 0 ]; then sum="$w $e: $p of $((p + q)) pass; failing: $(grep '^FAIL ' "$f" | awk '{print $2}' | tr '\n' ' ' | cut -c1-120)"; fi; fi
  echo "$(date '+%H:%M:%S') wall $w $e rc=$rc $(( $(date +%s) - t0 ))s ${sum:-NO SUMMARY: read $f}" | tee -a "$LOG"
done
