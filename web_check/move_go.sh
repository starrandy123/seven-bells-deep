#!/bin/bash
# Movement's private copy: live web/ with my work in progress laid over it, on its own port, so a half-made edit never reaches anyone else.
#   bash web_check/move_go.sh sync                      rebuild the private copy
#   bash web_check/move_go.sh walls [move_walls args]   rebuild, serve, run the walls on it (run under heavy.sh)
#   bash web_check/move_go.sh run <script> [args]       rebuild, serve, run a check that takes the port as PORT in its environment
#   bash web_check/move_go.sh promote                   syntax-check my files, then move each into web/js in one step
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; DEV="${MOVE_DEV:-/private/tmp/claude-501/-Users-randy-Documents/94551cef-900c-4e1e-983d-458983ce2a35/scratchpad/move_dev}"; PORT="${MOVE_PORT:-8863}"
sync_copy() {
  mkdir -p "$DEV/web"; rm -rf "$DEV/web/js"
  for e in "$ROOT"/web/*; do n=$(basename "$e"); [ "$n" = "js" ] && continue; [ "$n" = "dev" ] && continue; ln -sfn "$e" "$DEV/web/$n"; done
  cp -R "$ROOT/web/js" "$DEV/web/js"
  cp -R "$DEV/src/." "$DEV/web/js/"
  if [ -d "$DEV/assets" ]; then rm -rf "$DEV/web/assets"; mkdir -p "$DEV/web/assets"; for e in "$ROOT"/web/assets/*; do ln -sfn "$e" "$DEV/web/assets/$(basename "$e")"; done; for e in "$DEV"/assets/*; do [ -e "$e" ] || continue; rm -f "$DEV/web/assets/$(basename "$e")"; cp "$e" "$DEV/web/assets/"; done; fi
}
serve() { node "$ROOT/web_check/serve.mjs" "$DEV/web" "$PORT" > /dev/null & SRV=$!; trap 'kill $SRV 2>/dev/null' EXIT; sleep 0.5; }
case "$1" in
  sync) sync_copy; echo "$DEV/web" ;;
  walls) shift; sync_copy; serve; cd "$ROOT/web_check"; node move_walls.mjs "http://127.0.0.1:$PORT/index.html" chromium --out="$DEV/walls" "$@" ;;
  film) shift; sync_copy; serve; cd "$ROOT/web_check"; node move_film.mjs "$DEV/film" "$1" "$PORT" "${2:-640}" "${3:-360}" "${4:-2}" ;;
  combat) shift; sync_copy; serve; cd "$ROOT/web_check/combat"; node walls_page.mjs "$PORT" "$@" ;;
  webkit) shift; sync_copy; serve; cd "$ROOT/web_check"; node move_walls.mjs "http://127.0.0.1:$PORT/index.html" webkit --out="$DEV/walls_webkit" "$@" ;;
  run) shift; sync_copy; serve; s="$1"; shift; cd "$ROOT/web_check"; node "$s" "http://127.0.0.1:$PORT/index.html" chromium --out="$DEV/walls" "$@" ;;
  promote)
    cd "$DEV/src"; for f in $(find . -name '*.js'); do node --check "$f"; done
    for f in $(find . -name '*.js'); do t="$ROOT/web/js/$f"; mkdir -p "$(dirname "$t")"; cp "$f" "$t.move_tmp"; mv -f "$t.move_tmp" "$t"; done
    if [ -d "$DEV/assets" ]; then for e in "$DEV"/assets/*; do [ -e "$e" ] || continue; t="$ROOT/web/assets/$(basename "$e")"; cp "$e" "$t.move_tmp"; mv -f "$t.move_tmp" "$t"; rm -f "$e"; done; fi
    echo promoted; ;;
  *) echo "sync | walls | run | promote"; exit 2 ;;
esac
