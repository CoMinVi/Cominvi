export function isHomeEntryUrl(
  locationLike = typeof window !== 'undefined' ? window.location : null
) {
  if (!locationLike) return false
  try {
    const path = (locationLike.pathname || '/').replace(/\/$/, '') || '/'
    return path === '/' || path.endsWith('/index.html')
  } catch (e) {
    return false
  }
}
