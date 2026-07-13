export const MINERALS_IMAGE_BASE_URL =
  'https://cominvi.netlify.app/minerals'

export function buildMineralsLocalUrls(totalFrames = 600) {
  const total = Math.max(1, Math.floor(totalFrames || 0))
  const urls = []

  for (let frame = 1; frame <= total; frame += 1) {
    urls.push(
      `${MINERALS_IMAGE_BASE_URL}/minerals-000${String(frame)}.avif`
    )
  }

  return urls
}
