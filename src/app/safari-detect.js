export function isSafariBrowser() {
  if (typeof navigator === 'undefined') return false

  const ua = typeof navigator.userAgent === 'string' ? navigator.userAgent : ''
  const vendor = typeof navigator.vendor === 'string' ? navigator.vendor : ''

  const isSafariUA =
    /Safari/i.test(ua) && !/Chrome|Chromium|Edg|CriOS|FxiOS|OPR|Brave/i.test(ua)
  const isSafariVendor = /Apple/i.test(vendor)

  const supportsTouchCallout =
    typeof window !== 'undefined' &&
    window.CSS &&
    typeof window.CSS.supports === 'function' &&
    window.CSS.supports('-webkit-touch-callout', 'none')

  const isMacPlatform =
    typeof navigator.platform === 'string' &&
    navigator.platform.startsWith('Mac')

  return (
    isSafariUA || isSafariVendor || (!!supportsTouchCallout && !!isMacPlatform)
  )
}
