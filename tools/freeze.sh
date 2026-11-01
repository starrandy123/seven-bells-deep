#!/bin/bash
# Freeze the web folder into runs/<n>/web, without the dev pages: what gets checked and uploaded is this copy.
#   tools/freeze.sh        the next number
#   tools/freeze.sh <n>    that number (an existing frozen copy is never overwritten)
set -e
cd "$(dirname "$0")/.."
if [ -n "$1" ]; then n=$1; else n=$(ls runs 2>/dev/null | sort -n | tail -1); n=$((${n:-0} + 1)); fi
if [ -d runs/$n/web ]; then echo "runs/$n/web is already frozen: it stays as it is" >&2; exit 1; fi
mkdir -p runs/$n
rsync -a --exclude dev --exclude dev.html --exclude look_test.html --exclude .DS_Store web/ runs/$n/web/
(cd runs/$n/web && find . -type f -print0 | sort -z | xargs -0 shasum -a 256) > runs/$n/MANIFEST.txt
echo "runs/$n/web"; du -sh runs/$n/web; find runs/$n/web -type f | wc -l
