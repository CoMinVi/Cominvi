#!/usr/bin/env bash
# Phase 0 — conversion des assets hero (intro MP4 + scroll WebP par batches)
#
# Prérequis : ffmpeg (optionnel : libaom-av1 pour poster AVIF)
#
# Usage :
#   ./tools/convert-hero-assets.sh \
#     --intro-desktop  ./source/intro-desktop.mp4 \
#     --intro-mobile   ./source/intro-mobile.mp4 \
#     --scroll-desktop ./source/scroll-desktop/ \
#     --scroll-mobile  ./source/scroll-mobile/ \
#     --out            ./public/cave-scene
#
# Les dossiers scroll-* doivent contenir 170 images nommées frame_00000.* … frame_00169.*
# (master frames 126→295). Si vous avez déjà des WebP, le script les recopie/renomme.
#
# Jonction : la dernière frame de l'intro (master 125) doit correspondre visuellement
# à frame_00000.webp (master 126).

set -euo pipefail

INTRO_FRAMES=126
INTRO_FPS=24
SCROLL_FRAMES=170
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

usage() {
  sed -n '2,18p' "$0"
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

pad_index() {
  printf 'frame_%05d' "$1"
}

convert_intro_mp4() {
  local input="$1"
  local output="$2"
  local width="$3"
  local height="$4"

  echo "→ Intro MP4 : $output (${width}x${height}, ${INTRO_FPS} fps, ${INTRO_FRAMES} frames)"

  ffmpeg -y -hide_banner -loglevel error -i "$input" \
    -an \
    -vf "scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1,fps=${INTRO_FPS}" \
    -frames:v "$INTRO_FRAMES" \
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

  ffmpeg -y -hide_banner -loglevel error -i "$input" \
    -an \
    -vf "scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1,fps=${INTRO_FPS}" \
    -frames:v "$INTRO_FRAMES" \
    -c:v libvpx-vp9 \
    -b:v 0 \
    -crf 32 \
    -row-mt 1 \
    -deadline good \
    -cpu-used 2 \
    -pix_fmt yuv420p \
    "$output"
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

  echo "→ Scroll WebP ($variant) depuis $src_dir"

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
  if [[ $SKIP_WEBM -eq 0 ]]; then
    convert_intro_webm "$INTRO_DESKTOP" "${OUT_DIR}/intro.webm" "$DESKTOP_W" "$DESKTOP_H"
  fi
fi

if [[ -n "$INTRO_MOBILE" ]]; then
  [[ -f "$INTRO_MOBILE" ]] || { echo "Fichier introuvable : $INTRO_MOBILE" >&2; exit 1; }
  convert_intro_mp4 "$INTRO_MOBILE" "${OUT_DIR}/intro-mobile.mp4" "$MOBILE_W" "$MOBILE_H"
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
echo "Terminé. Vérifiez :"
echo "  - ${OUT_DIR}/intro.mp4 (5,25 s, ${INTRO_FRAMES} frames @ ${INTRO_FPS} fps)"
echo "  - ${OUT_DIR}/scroll/manifest.json (déjà versionné dans le repo)"
echo "  - Jonction : dernière frame intro ≈ ${OUT_DIR}/scroll/*/batch-0/frame_00000.webp"
