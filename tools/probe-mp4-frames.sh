#!/usr/bin/env bash
# Affiche le nombre de frames, le FPS et la durée d'une vidéo.
#
# Usage :
#   ./tools/probe-mp4-frames.sh chemin/vers/video.mp4
#   ./tools/probe-mp4-frames.sh intro.mp4 intro-mobile.mp4

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage : $0 <fichier.mp4> [autre.mp4 …]" >&2
  exit 1
fi

if ! command -v ffprobe >/dev/null 2>&1; then
  echo "ffprobe est requis (paquet ffmpeg)." >&2
  exit 1
fi

probe_one() {
  local file="$1"

  if [[ ! -f "$file" ]]; then
    echo "Fichier introuvable : $file" >&2
    return 1
  fi

  local fps_raw fps duration frames

  fps_raw="$(ffprobe -v error -select_streams v:0 \
    -show_entries stream=avg_frame_rate -of csv=p=0 "$file")"
  if [[ -z "$fps_raw" || "$fps_raw" == "0/0" ]]; then
    fps_raw="$(ffprobe -v error -select_streams v:0 \
      -show_entries stream=r_frame_rate -of csv=p=0 "$file")"
  fi

  fps="$(awk -F/ '{ if ($2) printf "%.3f", $1/$2; else print "24" }' <<< "$fps_raw")"

  duration="$(ffprobe -v error -select_streams v:0 \
    -show_entries stream=duration -of csv=p=0 "$file")"

  frames="$(ffprobe -v error -select_streams v:0 -count_frames \
    -show_entries stream=nb_read_frames -of csv=p=0 "$file")"

  if [[ -z "$frames" || "$frames" == "N/A" ]]; then
    frames="$(awk "BEGIN { printf \"%d\", ($duration * $fps) + 0.5 }")"
    frames="${frames} (estimé depuis durée × fps)"
  fi

  echo "$file"
  echo "  frames   : $frames"
  echo "  fps      : $fps"
  echo "  durée    : ${duration}s"
  echo ""
}

for file in "$@"; do
  probe_one "$file"
done
