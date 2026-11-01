#!/bin/bash
# A contact sheet of a filmed scenario: move_sheet.sh <scenario dir> <first frame> <how many> <every nth> <columns> <out.jpg> [width of each]
d="$1"; a="$2"; n="$3"; s="$4"; c="$5"; o="$6"; w="${7:-320}"; r=$(( (n + c - 1) / c ))
ffmpeg -y -loglevel error -start_number "$a" -i "$d/frames/%05d.jpg" -vf "select='not(mod(n\,$s))',scale=$w:-1,tile=${c}x${r}" -frames:v 1 -update 1 "$d/$o"
