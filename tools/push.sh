#!/bin/bash
# Snapshot part2's web/, check it, leave build.zip ready. PART2_OUT=<your scratchpad> bash tools/push.sh <tag> <port>
# Then: begin_bundle_upload with game_id and size, curl PUT the zip, finish_bundle_upload, playtest_game, node runner.mjs playtest <url> --no-window from ~/Documents under heavy.sh, get_playtest
S=${PART2_OUT:?set PART2_OUT to your scratchpad}; tag=$1; port=$2; O=$S/up_$tag; rm -rf $O; mkdir -p $O
cd ~/Documents/UnrealProjects/DrownedCity_part2 || exit 1
for f in web/js/*.js web/js/*/*.js; do node --check "$f" 2>&1 | head -2; done
for f in web/data/*.json web/assets/*.json; do python3 -c "import json,sys;json.load(open(sys.argv[1]))" "$f" || echo BAD $f; done
rsync -a --exclude dev --exclude dev.html --exclude look_test.html --exclude .DS_Store web/ $O/web/ && (cd $O/web && zip -q -r -X ../build.zip . -x '.DS_Store')
stat -f 'zip %z' $O/build.zip
cd web_check; node serve.mjs $O/web $port > /dev/null 2>&1 & SV=$!
sleep 0.5
bash ~/.mosa/heavy.sh run pickup-part2 -- bash -c "node smoke.mjs http://127.0.0.1:$port/ $O/smoke webkit phone 12 2>&1 | cut -c1-220; node input.mjs http://127.0.0.1:$port/index.html webkit --only=C1t 2>&1 | grep -E 'FAIL|pass in' | cut -c1-200; node returning_at_sea.mjs http://127.0.0.1:$port/ webkit 2>&1 | tail -1 | cut -c1-160; node look_swipe.mjs http://127.0.0.1:$port/ webkit 2>&1 | tail -1 | cut -c1-160" > $O/smoke.log 2>&1
kill $SV 2>/dev/null
grep -n "boot\|errors\|NO BOOT\|pageerror\|http \|FAIL\|PASS\|pass in" $O/smoke.log | cut -c1-240; tail -2 $O/smoke.log | cut -c1-180; date '+%H:%M:%S'
