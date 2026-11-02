#!/bin/bash
# one row per clip: a frame every half second, each 180x320
out=$1; shift; rows=(); for f in "$@"; do b=$(basename $f .mp4); ffmpeg -nostdin -y -loglevel error -i $f -vf "fps=2,scale=180:320,tile=8x1:padding=2:color=black" -frames:v 1 /tmp/claude_row_$b.jpg 2>/dev/null || ffmpeg -nostdin -y -loglevel error -i $f -vf "fps=2,scale=180:320,tile=8x1" -frames:v 1 /tmp/claude_row_$b.jpg; rows+=(-i /tmp/claude_row_$b.jpg); done
n=$(( ${#rows[@]} / 2 )); ffmpeg -nostdin -y -loglevel error "${rows[@]}" -filter_complex "vstack=inputs=$n" $out
