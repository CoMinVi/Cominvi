export const HOME_HERO_MANIFEST_URL = '/cave-scene/scroll/manifest.json'
export const HERO_ASSET_ORIGIN = 'https://cominvi.netlify.app'

let manifestPromise = null

export function getHeroAssetOrigin() {
  return HERO_ASSET_ORIGIN
}

export function resolveHeroAssetUrl(path) {
  const raw = String(path || '').trim()
  if (!raw) return raw
  if (/^https?:\/\//i.test(raw)) return raw

  const origin = getHeroAssetOrigin()
  const normalized = raw.startsWith('/') ? raw : `/${raw}`
  return origin ? `${origin}${normalized}` : normalized
}

export function frameFilename(index, pad = 5) {
  return `frame_${Math.max(0, Math.floor(index || 0))
    .toString()
    .padStart(pad, '0')}.webp`
}

export function getScrollFrameUrl(scrollConfig, index, pad = 5) {
  if (!scrollConfig?.basePath) return ''

  const frameIndex = Math.max(0, Math.floor(index || 0))
  const filename = frameFilename(frameIndex, pad)
  const batches = scrollConfig.batches || []

  for (let i = 0; i < batches.length; i += 1) {
    const batch = batches[i]
    const start = Math.max(0, Math.floor(batch.startIndex || 0))
    const count = Math.max(0, Math.floor(batch.count || 0))
    if (frameIndex >= start && frameIndex < start + count) {
      return resolveHeroAssetUrl(
        `${scrollConfig.basePath}/${batch.id}/${filename}`
      )
    }
  }

  return ''
}

export function loadHeroManifest(url = HOME_HERO_MANIFEST_URL) {
  if (!manifestPromise) {
    manifestPromise = fetch(resolveHeroAssetUrl(url), { credentials: 'omit' })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Hero manifest HTTP ${response.status}`)
        }
        return response.json()
      })
      .catch((error) => {
        manifestPromise = null
        throw error
      })
  }

  return manifestPromise
}

export function pickHeroVariant(manifest, width = window.innerWidth) {
  const mobile = manifest?.variants?.mobile
  const desktop = manifest?.variants?.desktop
  const maxMobile = mobile?.maxWidth ?? 991

  if (width <= maxMobile && mobile) return mobile
  return desktop || mobile || null
}

export function getIntroDurationSec(manifest) {
  const intro = manifest?.intro || {}
  if (Number.isFinite(intro.durationSec) && intro.durationSec > 0) {
    return intro.durationSec
  }

  const frameCount = Number(intro.frameCount)
  const fps = Number(intro.fps)
  if (frameCount > 0 && fps > 0) {
    return frameCount / fps
  }

  return 3.6
}

export function getScrollFrameCount(variant, manifest) {
  const fromVariant = Number(variant?.scroll?.frameCount)
  if (fromVariant > 0) return fromVariant
  const fromManifest = Number(manifest?.scroll?.frameCount)
  if (fromManifest > 0) return fromManifest
  return 1
}
