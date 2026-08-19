const clamp = (min, max, value) => Math.min(max, Math.max(min, value))

export function getCylinderIndicatorHeight(viewportWidth, viewportHeight) {
  const width = Number.isFinite(viewportWidth) ? Math.max(0, viewportWidth) : 0
  const height = Number.isFinite(viewportHeight)
    ? Math.max(0, viewportHeight)
    : 0
  return Math.min(width, height) * 0.4
}

export function getFlatTickTop(index, count) {
  if (count <= 1) return 50
  const safeIndex = Number.isFinite(index) ? index : 0
  return (clamp(0, count - 1, safeIndex) / (count - 1)) * 100
}

export function getFlatTickIndex(progress, count) {
  if (count <= 1) return 0
  const safeProgress = Number.isFinite(progress) ? progress : 0
  return Math.round(clamp(0, 1, safeProgress) * (count - 1))
}
