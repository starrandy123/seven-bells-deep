#!/bin/bash
# The judge's clips of a frozen round, from the game's own camera at a locked clock: each shot at 1x and at 1/4, a turn of the lock a plan, then a contact sheet of each for reading.
#   tools/clips.sh <n> [shot names]
cd "$(dirname "$0")/.."; ROOT=$(pwd); n=$1; shift; RUN=runs/$n; PORT=$((8800 + n)); OUT=$RUN/clips; mkdir -p "$OUT"
lsof -ti tcp:$PORT >/dev/null 2>&1 || { node web_check/serve.mjs "$RUN/web" $PORT > /dev/null 2>&1 & SV=$!; trap 'kill $SV 2>/dev/null' EXIT; sleep 1; }
node web_check/judge_plan.mjs "http://127.0.0.1:$PORT/index.html" "$OUT/plan" "$@" | while read -r plan; do
  bash ~/.mosa/heavy.sh run qa-r$n -- node web_check/film.mjs "$ROOT/$OUT" "$plan" 406 720 1 30
done
for f in "$OUT"/*.mp4; do s="${f%.mp4}_sheet.jpg"; [ -e "$s" ] && [ "$s" -nt "$f" ] && continue
  d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f"); nice -n 10 ffmpeg -y -loglevel error -i "$f" -vf "fps=$(python3 -c "print(max(0.5, min(30, 18 / $d)))"),scale=135:-1,tile=9x2" -frames:v 1 -q:v 4 "$s"
done
# a dense sheet of each 1x clip, one tile every 3 frames: the 18-tile sheet misses what lasts a quarter of a second (round 6: the sprint's snap, the dive's mirror)
for f in "$OUT"/*_1x.mp4; do s="${f%.mp4}_dense.jpg"; [ -e "$s" ] && [ "$s" -nt "$f" ] && continue
  c=$(ffprobe -v error -count_packets -select_streams v -show_entries stream=nb_read_packets -of csv=p=0 "$f"); rows=$(( (c / 3 + 11) / 12 ))
  nice -n 10 ffmpeg -y -loglevel error -i "$f" -vf "select='not(mod(n,3))',scale=110:-1,tile=12x$rows" -frames:v 1 -vsync 0 "$s"
done
ls -la "$OUT"/*.mp4 2>/dev/null | awk '{print $5, $9}'
