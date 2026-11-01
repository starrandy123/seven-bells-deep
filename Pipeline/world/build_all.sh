#!/bin/bash
# The whole world, end to end, one heavy job at a time: every piece, the GLBs, the map, the check, the manifest. W14: check_world.py on every build.
cd "$(dirname "$0")"
BL=/Applications/Blender.app/Contents/MacOS/Blender
PY=~/Documents/Marketing/ContentFunnel/engine/tools/venv_cv/bin/python
bash ~/.mosa/heavy.sh run world -- $BL -b --factory-startup --python build_assets.py -- props > out/run_props.log 2>&1 || exit 1
bash ~/.mosa/heavy.sh run world -- $BL -b --factory-startup --python build_assets.py -- creatures > out/run_creatures.log 2>&1 || exit 1
bash pack.sh
$PY build_tex.py
$PY build_world.py | tail -6
$PY check_world.py || exit 1
$PY build_manifest.py
