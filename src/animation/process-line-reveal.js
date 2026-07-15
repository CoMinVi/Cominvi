const MIN_OPACITY = 0.2
const FADE_PORTION = 0.25
const LINE_STAGGER = 0.02
const MAX_STAGGER_WINDOW = 0.12

const clamp01 = (value) => Math.max(0, Math.min(1, value))

export function shouldUseProcessLineReveal(viewportWidth) {
  return Number.isFinite(viewportWidth) && viewportWidth <= 767
}

export function getProcessLineRevealOpacity(
  progress,
  lineIndex = 0,
  lineCount = 1
) {
  const p = clamp01(Number.isFinite(progress) ? progress : 0)
  const count = Math.max(1, Math.floor(lineCount || 1))
  const index = Math.max(0, Math.min(count - 1, Math.floor(lineIndex || 0)))
  const staggerWindow = Math.min(
    MAX_STAGGER_WINDOW,
    Math.max(0, count - 1) * LINE_STAGGER
  )
  const fadeDuration = Math.max(0.01, FADE_PORTION - staggerWindow)

  if (p < FADE_PORTION) {
    const local = clamp01((p - index * LINE_STAGGER) / fadeDuration)
    return MIN_OPACITY + (1 - MIN_OPACITY) * local
  }

  if (p > 1 - FADE_PORTION) {
    const reverseIndex = count - 1 - index
    const local = clamp01(
      (p - (1 - FADE_PORTION) - reverseIndex * LINE_STAGGER) / fadeDuration
    )
    return 1 - (1 - MIN_OPACITY) * local
  }

  return 1
}
