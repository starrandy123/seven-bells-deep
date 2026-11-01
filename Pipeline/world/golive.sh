#!/bin/bash
# The staged map goes live. Everything but world.json first, world.json last and atomically, so a reader never sees the new map with the old files. The old map is kept in out/live_1280 to go back to.
#   bash golive.sh          goes live         bash golive.sh back     puts the 1,280 m map back
set -e
cd "$(dirname "$0")"
A=../../web/assets
B=out/live_1280
if [ "$1" = "back" ]; then
  cp $B/height.bin $B/biome.bin $B/props.glb $B/creatures.glb $A/
  rm -f $A/biome2.bin $A/height_z.bin $A/biome_z.bin $A/biome2_z.bin $A/props_*.glb
  cp $B/world.json $A/world.json.new && mv $A/world.json.new $A/world.json
  echo "the 1,280 m map is back"
  exit 0
fi
[ -f $B/world.json ] || { mkdir -p $B; cp $A/height.bin $A/biome.bin $A/props.glb $A/creatures.glb $A/world.json $B/; }
S=out/stage
for f in height_z.bin biome_z.bin biome2_z.bin creatures.glb props.glb; do cp $S/$f $A/$f.new; mv $A/$f.new $A/$f; done
for f in $S/props_*.glb; do b=$(basename $f); cp $f $A/$b.new; mv $A/$b.new $A/$b; done
cp $S/world.json $A/world.json.new && mv $A/world.json.new $A/world.json
rm -f $A/height.bin $A/biome.bin $A/biome2.bin                           # world.json's `files` names the small ones: nothing reads these now, and they'd only add to what's uploaded
ls -la $A | cut -c28-
