#!/bin/bash
# Cut a vertical trailer from a list of clips: each line "<clip path> <start s> <duration s>", hard cuts, 1080x1920 at 30 fps, no sound.
#   bash Pipeline/film/trailer/build_trailer.sh <cuts.txt> <out dir>
# Writes <out dir>/TRAILER.mp4 (crf 17) and <out dir>/phone/TRAILER.mp4 (the phone copy, under 30 MB), and <out dir>/sheet.jpg (a frame every 2 s).
# ffmpeg reads stdin unless told not to: inside a "while read" loop that swallows the list, hence -nostdin.
set -e
cuts=$1; out=$2; mkdir -p "$out/cut" "$out/phone"; : > "$out/cut/list.txt"; i=0
while read -r f s d; do
  [ -z "$f" ] && continue; i=$((i+1)); o=$(printf "k%02d.mp4" $i)
  ffmpeg -nostdin -y -loglevel error -ss "$s" -i "$f" -t "$d" -an -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,format=yuv420p" -c:v libx264 -preset medium -crf 17 "$out/cut/$o"
  echo "file '$o'" >> "$out/cut/list.txt"
done < "$cuts"
ffmpeg -nostdin -y -loglevel error -f concat -safe 0 -i "$out/cut/list.txt" -c copy "$out/TRAILER.mp4"
ffmpeg -nostdin -y -loglevel error -i "$out/TRAILER.mp4" -c:v libx264 -preset slow -crf 21 -maxrate 2800k -bufsize 5600k -map_metadata -1 -movflags +faststart "$out/phone/TRAILER.mp4"
ffmpeg -nostdin -y -loglevel error -i "$out/TRAILER.mp4" -vf "select='not(mod(n,60))',scale=135:240,tile=15x2" -vsync 0 -frames:v 1 -q:v 3 "$out/sheet.jpg"
echo "cuts $i; length $(ffprobe -v error -show_entries format=duration -of csv=p=0 "$out/TRAILER.mp4") s; phone $(stat -f %z "$out/phone/TRAILER.mp4") bytes"
