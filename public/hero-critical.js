/**
 * Must run synchronously in <head>, before webflow.js and before first paint.
 * Loaded as a classic script (not type="module").
 */
;(function injectCominviHeroCriticalStyles() {
  if (document.querySelector('style[data-cominvi-hero-critical]')) return

  const style = document.createElement('style')
  style.setAttribute('data-cominvi-hero-critical', '')
  style.textContent = `
.hero-background {
  z-index: 0;
  display: flex;
  position: absolute;
  inset: 0;
  justify-content: center;
  align-items: center;
  overflow: hidden;
}
.hero-background .background-inner {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 120%;
  height: 120%;
  flex: 0 0 auto;
}
.hero-background .is-video {
  width: 100%;
  height: 100%;
}
.hero-background .background_video {
  position: relative;
  overflow: hidden;
  width: 100%;
  height: 100%;
  background-image: none !important;
}
.hero-background .background_video > video,
.hero-background .w-background-video > video {
  position: absolute !important;
  inset: 0 !important;
  margin: 0 !important;
  display: block !important;
  width: 100% !important;
  height: 100% !important;
  object-fit: cover !important;
  object-position: 50% 50% !important;
}
`

  const head = document.head || document.getElementsByTagName('head')[0]
  if (head) head.appendChild(style)
})()
