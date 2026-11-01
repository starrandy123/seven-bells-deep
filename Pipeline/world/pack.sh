#!/bin/bash
# Pack the GLBs for the web. Props are quantized to 14 bits: smaller on a wire that sends .glb raw (Q24), and world.js folds each mesh's node back into metres at load.
# Creatures keep float positions: boss.js and enemies.js read their raw geometry in real metres, and that path hasn't been proved quantized.
#   WORLD_ASSETS=<dir> bash pack.sh      packs into a stage.    QUANT=1 also reports each props file's float size, for comparison.
cd "$(dirname "$0")"
GP=../node_modules/gltfpack/cli.js
A=${WORLD_ASSETS:-../../web/assets}
for f in out/props.glb out/props_*.glb; do
  [ -f "$f" ] || continue
  b=$(basename "$f")
  node $GP -i "$f" -o "$A/$b" -cc -kn -km -vp 14 -vc 8 > "out/pack_${b%.glb}.log" 2>&1
  if [ -n "$QUANT" ]; then
    mkdir -p out/q
    node $GP -i "$f" -o "out/q/$b" -cc -kn -km -vpf -vp 16 -vc 8 > /dev/null 2>&1
    echo "$b quantized $(stat -f %z "$A/$b") float $(stat -f %z "out/q/$b")"
  fi
done
[ -f out/creatures.glb ] && node $GP -i out/creatures.glb -o "$A/creatures.glb" -cc -kn -km -vpf -vp 16 -vc 8 > out/pack_creatures.log 2>&1
ls -la "$A"/props*.glb "$A"/creatures.glb
