export function getHomeScrollProgress({
  lenisScroll,
  scrollTriggerProgress,
  viewportHeight,
  rangeVh,
} = {}) {
  const distance = Number(viewportHeight) * (Number(rangeVh) / 100)
  if (!Number.isFinite(distance) || distance <= 0) return null

  const clamp = (value) => Math.max(0, Math.min(Number(value) || 0, 1))
  if (Number.isFinite(lenisScroll)) {
    return clamp(lenisScroll / distance)
  }
  if (Number.isFinite(scrollTriggerProgress)) {
    return clamp(scrollTriggerProgress)
  }

  return null
}
