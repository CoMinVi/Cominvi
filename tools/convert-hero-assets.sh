#!/usr/bin/env bash
# Phase 0 — conversion des assets hero (intro MP4 + scroll WebP par batches)
#
# Prérequis : ffmpeg, ffprobe (optionnel : jq pour mettre à jour le manifest)
#
# Usage :
#   ./tools/convert-hero-assets.sh \
#     --intro-desktop  ./source/intro-desktop.mp4 \
#     --intro-mobile   ./source/intro-mobile.mp4 \
#     --scroll-desktop ./source/scroll-desktop/ \
#     --scroll-mobile  ./source/scroll-mobile/ \
#     --out            ./public/cave-scene
#
# Scroll : 150 frames nommées frame_00000.* … frame_00149.*
# Intro  : le nombre de frames est détecté automatiquement via ffprobe (pas besoin de le connaître à l'avance).
#
# Jonction : la dernière frame de l'intro MP4 doit correspondre visuellement à frame_00000.webp.

set -euo pipefail

INTRO_FPS=24
SCROLL_FRAMES=150
BATCH_SIZE=30
DESKTOP_W=1920
DESKTOP_H=1080
MOBILE_W=1280
MOBILE_H=720

INTRO_DESKTOP=""
INTRO_MOBILE=""
SCROLL_DESKTOP=""
SCROLL_MOBILE=""
OUT_DIR="./public/cave-scene"
SKIP_WEBM=0
WEBP_QUALITY=85
INTRO_FRAMES=""
UPDATE_MANIFEST=0

usage() {
  sed -n '2,20p' "$0"
  echo ""
  echo "Options :"
  echo "  --intro-frames N   Forcer la troncature à N frames (optionnel)"
  echo "  --intro-fps N      FPS cible pour l'encodage intro (défaut : 24)"
  echo "  --update-manifest  Écrire frameCount/fps/durationSec dans manifest.json"
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --intro-desktop) INTRO_DESKTOP="$2"; shift 2 ;;
    --intro-mobile) INTRO_MOBILE="$2"; shift 2 ;;
    --scroll-desktop) SCROLL_DESKTOP="$2"; shift 2 ;;
    --scroll-mobile) SCROLL_MOBILE="$2"; shift 2 ;;
    --out) OUT_DIR="$2"; shift 2 ;;
    --skip-webm) SKIP_WEBM=1; shift ;;
    --webp-quality) WEBP_QUALITY="$2"; shift 2 ;;
    --intro-frames) INTRO_FRAMES="$2"; shift 2 ;;
    --intro-fps) INTRO_FPS="$2"; shift 2 ;;
    --update-manifest) UPDATE_MANIFEST=1; shift ;;
    -h|--help) usage ;;
    *) echo "Option inconnue : $1" >&2; usage ;;
  esac
done

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Commande requise introuvable : $1" >&2
    exit 1
  fi
}

require_cmd ffmpeg
require_cmd ffprobe

pad_index() {
  printf 'frame_%05d' "$1"
}

probe_video() {
  local file="$1"

  local fps_raw duration frame_count fps
  fps_raw="$(ffprobe -v error -select_streams v:0 -show_entries stream=avg_frame_rate -of csv=p=0 "$file")"
  if [[ -z "$fps_raw" || "$fps_raw" == "0/0" ]]; then
    fps_raw="$(ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate -of csv=p=0 "$file")"
  fi

  fps="$(python3 -c "n,d=map(int,'${fps_raw}'.split('/')); print(round(n/d, 3) if d else 24)" 2>/dev/null || echo "24")"

  duration="$(ffprobe -v error -select_streams v:0 -show_entries stream=duration -of csv=p=0 "$file")"
  frame_count="$(ffprobe -v error -select_streams v:0 -count_frames -show_entries stream=nb_read_frames -of csv=p=0 "$file")"

  if [[ -z "$frame_count" || "$frame_count" == "N/A" ]]; then
    frame_count="$(python3 -c "import math; print(max(1, round(float('${duration}') * float('${fps}'))))" 2>/dev/null || echo "unknown")"
  fi

  echo "${frame_count}|${fps}|${duration}"
}

convert_intro_mp4() {
  local input="$1"
  local output="$2"
  local width="$3"
  local height="$4"

  local frames_label="auto"
  [[ -n "$INTRO_FRAMES" ]] && frames_label="$INTRO_FRAMES"

  echo "→ Intro MP4 : $output (${width}x${height}, ${INTRO_FPS} fps, frames=${frames_label})"

  local extra_args=()
  if [[ -n "$INTRO_FRAMES" ]]; then
    extra_args=(-frames:v "$INTRO_FRAMES")
  fi

  ffmpeg -y -hide_banner -loglevel error -i "$input" \
    -an \
    -vf "scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1,fps=${INTRO_FPS}" \
    "${extra_args[@]}" \
    -c:v libx264 \
    -profile:v high \
    -level:v 4.1 \
    -pix_fmt yuv420p \
    -b:v 10M \
    -maxrate 12M \
    -bufsize 20M \
    -movflags +faststart \
    "$output"
}

convert_intro_webm() {
  local input="$1"
  local output="$2"
  local width="$3"
  local height="$4"

  echo "→ Intro WebM : $output"

  local extra_args=()
  if [[ -n "$INTRO_FRAMES" ]]; then
    extra_args=(-frames:v "$INTRO_FRAMES")
  fi

  ffmpeg -y -hide_banner -loglevel error -i "$input" \
    -an \
    -vf "scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1,fps=${INTRO_FPS}" \
    "${extra_args[@]}" \
    -c:v libvpx-vp9 \
    -b:v 0 \
    -crf 32 \
    -row-mt 1 \
    -deadline good \
    -cpu-used 2 \
    -pix_fmt yuv420p \
    "$output"
}

report_intro_probe() {
  local file="$1"
  local label="$2"
  local probe
  probe="$(probe_video "$file")"
  local frames fps duration
  IFS='|' read -r frames fps duration <<< "$probe"

  echo ""
  echo "── Métadonnées intro ($label) ──"
  echo "   Fichier  : $file"
  echo "   Frames   : $frames"
  echo "   FPS      : $fps"
  echo "   Durée    : ${duration}s"
  echo "   → Vérifiez que la dernière frame correspond à scroll/frame_00000.webp"

  if [[ $UPDATE_MANIFEST -eq 1 && "$label" == "desktop" && -f "${OUT_DIR}/scroll/manifest.json" ]]; then
    if command -v jq >/dev/null 2>&1; then
      local tmp
      tmp="$(mktemp)"
      jq \
        --argjson fc "${frames}" \
        --argjson fps "${fps}" \
        --argjson dur "${duration}" \
        '.intro.frameCount = $fc | .intro.fps = $fps | .intro.durationSec = $dur | .intro.detectFromVideo = false' \
        "${OUT_DIR}/scroll/manifest.json" > "$tmp"
      mv "$tmp" "${OUT_DIR}/scroll/manifest.json"
      echo "   Manifest mis à jour (intro.*)"
    else
      echo "   jq absent — mettez à jour manifest.json manuellement :" >&2
      echo "   frameCount=$frames, fps=$fps, durationSec=$duration" >&2
    fi
  fi
}

ensure_webp_frame() {
  local src_dir="$1"
  local index="$2"
  local dest_file="$3"
  local stem
  stem="$(pad_index "$index")"

  local candidate=""
  for ext in webp png jpg jpeg avif tif tiff exr; do
    if [[ -f "${src_dir}/${stem}.${ext}" ]]; then
      candidate="${src_dir}/${stem}.${ext}"
      break
    fi
  done

  if [[ -z "$candidate" ]]; then
    echo "Frame manquante : ${src_dir}/${stem}.*" >&2
    exit 1
  fi

  if [[ "$candidate" == *.webp ]]; then
    cp "$candidate" "$dest_file"
  else
    ffmpeg -y -hide_banner -loglevel error -i "$candidate" \
      -c:v libwebp -quality "$WEBP_QUALITY" -compression_level 6 \
      "$dest_file"
  fi
}

pack_scroll_batches() {
  local src_dir="$1"
  local dest_root="$2"
  local variant="$3"

  echo "→ Scroll WebP ($variant) : ${SCROLL_FRAMES} frames depuis $src_dir"

  local batch_index=0
  local frame_index=0

  while [[ $frame_index -lt $SCROLL_FRAMES ]]; do
    local remaining=$((SCROLL_FRAMES - frame_index))
    local count=$BATCH_SIZE
    if [[ $remaining -lt $BATCH_SIZE ]]; then
      count=$remaining
    fi

    local batch_dir="${dest_root}/scroll/${variant}/batch-${batch_index}"
    mkdir -p "$batch_dir"

    local i=0
    while [[ $i -lt $count ]]; do
      local idx=$((frame_index + i))
      ensure_webp_frame "$src_dir" "$idx" "${batch_dir}/$(pad_index "$idx").webp"
      i=$((i + 1))
    done

    echo "   batch-${batch_index} : $(pad_index "$frame_index") … $(pad_index "$((frame_index + count - 1)))"
    frame_index=$((frame_index + count))
    batch_index=$((batch_index + 1))
  done
}

make_poster_avif() {
  local scroll_dir="$1"
  local poster_file="$2"

  mkdir -p "$(dirname "$poster_file")"
  local first_frame="${scroll_dir}/frame_00000.webp"

  if [[ ! -f "$first_frame" ]]; then
    echo "Poster ignoré : $first_frame introuvable" >&2
    return
  fi

  echo "→ Poster AVIF : $poster_file"

  if ffmpeg -hide_banner -loglevel error -y -i "$first_frame" \
    -c:v libaom-av1 -still-picture 1 -crf 30 -b:v 0 \
    "$poster_file" 2>/dev/null; then
    return
  fi

  echo "   libaom-av1 indisponible, fallback WebP poster" >&2
  cp "$first_frame" "${poster_file%.avif}.webp"
}

mkdir -p "$OUT_DIR"

if [[ -n "$INTRO_DESKTOP" ]]; then
  [[ -f "$INTRO_DESKTOP" ]] || { echo "Fichier introuvable : $INTRO_DESKTOP" >&2; exit 1; }
  convert_intro_mp4 "$INTRO_DESKTOP" "${OUT_DIR}/intro.mp4" "$DESKTOP_W" "$DESKTOP_H"
  report_intro_probe "${OUT_DIR}/intro.mp4" "desktop"
  if [[ $SKIP_WEBM -eq 0 ]]; then
    convert_intro_webm "$INTRO_DESKTOP" "${OUT_DIR}/intro.webm" "$DESKTOP_W" "$DESKTOP_H"
  fi
fi

if [[ -n "$INTRO_MOBILE" ]]; then
  [[ -f "$INTRO_MOBILE" ]] || { echo "Fichier introuvable : $INTRO_MOBILE" >&2; exit 1; }
  convert_intro_mp4 "$INTRO_MOBILE" "${OUT_DIR}/intro-mobile.mp4" "$MOBILE_W" "$MOBILE_H"
  report_intro_probe "${OUT_DIR}/intro-mobile.mp4" "mobile"
  if [[ $SKIP_WEBM -eq 0 ]]; then
    convert_intro_webm "$INTRO_MOBILE" "${OUT_DIR}/intro-mobile.webm" "$MOBILE_W" "$MOBILE_H"
  fi
fi

if [[ -n "$SCROLL_DESKTOP" ]]; then
  [[ -d "$SCROLL_DESKTOP" ]] || { echo "Dossier introuvable : $SCROLL_DESKTOP" >&2; exit 1; }
  pack_scroll_batches "$SCROLL_DESKTOP" "$OUT_DIR" "desktop"
fi

if [[ -n "$SCROLL_MOBILE" ]]; then
  [[ -d "$SCROLL_MOBILE" ]] || { echo "Dossier introuvable : $SCROLL_MOBILE" >&2; exit 1; }
  pack_scroll_batches "$SCROLL_MOBILE" "$OUT_DIR" "mobile"
fi

if [[ -n "$SCROLL_DESKTOP" ]]; then
  make_poster_avif "${OUT_DIR}/scroll/desktop/batch-0" "${OUT_DIR}/poster/frame_00000.avif"
fi

echo ""
echo "Terminé."
echo "  Scroll : ${SCROLL_FRAMES} frames (frame_00000 … $(pad_index $((SCROLL_FRAMES - 1))))"
echo "  Intro  : nombre de frames affiché ci-dessus (ou relancez avec --update-manifest)"
