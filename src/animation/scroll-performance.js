export function isNearViewport(rect, viewportHeight, marginRatio = 0.5) {
  if (!rect || !Number.isFinite(viewportHeight) || viewportHeight <= 0) {
    return false
  }
  const margin = viewportHeight * Math.max(0, marginRatio)
  return rect.bottom >= -margin && rect.top <= viewportHeight + margin
}

export function readMarkerRects(entries, padding = 0) {
  const safePadding = Number.isFinite(padding) ? padding : 0
  return entries.map(({ marker, button }) => {
    const rect = marker.getBoundingClientRect()
    return {
      button,
      left: rect.left - safePadding,
      top: rect.top - safePadding,
      width: rect.width + safePadding * 2,
      height: rect.height + safePadding * 2,
    }
  })
}

export function getCanvasPixelRatio(devicePixelRatio, isMobile) {
  const ratio =
    Number.isFinite(devicePixelRatio) && devicePixelRatio > 0
      ? devicePixelRatio
      : 1
  return isMobile ? Math.min(ratio, 2) : ratio
}
