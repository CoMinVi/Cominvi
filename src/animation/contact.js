import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

// Contact page initializer: MapLibre GL (no API key required)

export function initContact(root = document) {
  const scope = root && root.querySelector ? root : document

  // Only run on Contact page
  const containerIsContact = !!(
    root &&
    root.matches &&
    root.matches('[data-barba-namespace="Contact"]')
  )
  const isContact =
    containerIsContact ||
    !!scope.querySelector('[data-barba-namespace="Contact"]')
  if (!isContact) return

  // Iframe support removed per request; SDK only

  const getMapContainer = () => {
    try {
      return (
        (root &&
          root.querySelector &&
          root.querySelector(
            '.is-c-map.w-widget-map, .w-widget-map.is-c-map, .is-c-map'
          )) ||
        scope.querySelector(
          '.is-c-map.w-widget-map, .w-widget-map.is-c-map, .is-c-map'
        )
      )
    } catch (e) {
      return null
    }
  }

  // Iframe reload removed

  const parseLatLng = (raw) => {
    if (!raw) return null
    try {
      const [latStr, lngStr] = String(raw).split(',')
      const lat = parseFloat((latStr || '').trim())
      const lng = parseFloat((lngStr || '').trim())
      if (!Number.isNaN(lat) && !Number.isNaN(lng)) return { lat, lng }
      return null
    } catch (e) {
      return null
    }
  }

  const ensureJsMap = async () => {
    try {
      const container = getMapContainer()
      if (!container) return false
      // Avoid re-creating the map if it already exists (prevents flash at end of transitions)
      try {
        if (
          (container.classList &&
            container.classList.contains('is-c-map-js')) ||
          container.__jsMapCreated
        ) {
          return true
        }
      } catch (e) {
        // ignore
      }

      const latlng = parseLatLng(
        container.getAttribute('data-widget-latlng')
      ) || {
        lat: 21.1716,
        lng: -101.7327,
      }

      const zoomAttr = container.getAttribute('data-widget-zoom')
      const zoom =
        zoomAttr != null && zoomAttr !== '' ? parseInt(zoomAttr, 10) : 14

      // Prepare container for JS map
      try {
        container.innerHTML = ''
      } catch (e) {
        // ignore
      }

      try {
        container.classList.add('is-c-map-js')
      } catch (e) {
        // ignore
      }

      // Create MapLibre GL map
      try {
        const map = new maplibregl.Map({
          container,
          style: 'https://tiles.openfreemap.org/styles/dark',
          center: [latlng.lng, latlng.lat],
          zoom: Number.isNaN(zoom) ? 14 : zoom,
          // scrollZoom: false,
        })

        // Disable scroll wheel zoom but enable pinch-to-zoom on touch devices
        map.scrollZoom.disable()
        map.touchZoomRotate.enable()

        // Add zoom controls
        map.addControl(new maplibregl.NavigationControl())

        // Customize road and building colors on style load
        const applyMapColors = () => {
          try {
            // Get CSS variable colors
            const rootStyles = getComputedStyle(document.documentElement)
            const buildingColor =
              rootStyles.getPropertyValue('--building-color').trim() ||
              '#E5E5E5'
            const buildingBorderColor =
              rootStyles.getPropertyValue('--building-border-color').trim() ||
              '#D1D1D1'
            const roadColor =
              rootStyles.getPropertyValue('--road-color').trim() || '#FFFFFF'
            const roadBorderColor =
              rootStyles.getPropertyValue('--road-border-color').trim() ||
              '#FFFFFF'
            const backgroundColor =
              rootStyles.getPropertyValue('--map-background-color').trim() ||
              '#F3F3F3'
            const textColor =
              rootStyles.getPropertyValue('--map-text-color').trim() ||
              '#B2B2B2'
            const textHaloColor =
              rootStyles.getPropertyValue('--map-text-halo-color').trim() ||
              '#F3F3F3'
            const waterColor =
              rootStyles.getPropertyValue('--map-water-color').trim() ||
              '#E5E5E5'
            const waterwayColor =
              rootStyles.getPropertyValue('--map-waterway-color').trim() ||
              '#E5E5E5'

            // Get all layers
            const allLayers = map.getStyle().layers || []

            // Modify background color
            try {
              if (map.getLayer('background')) {
                map.setPaintProperty(
                  'background',
                  'background-color',
                  backgroundColor
                )
              }
            } catch (e) {
              // ignore
            }

            // Hide arrow layers and modify road/building colors
            allLayers.forEach((layer) => {
              if (layer.type === 'line') {
                // Modify main road colors (inner roads)
                if (
                  layer.id.includes('highway_') ||
                  layer.id.includes('road_') ||
                  layer.id.includes('railway_')
                ) {
                  if (
                    layer.id.includes('_inner') ||
                    !layer.id.includes('_casing')
                  ) {
                    try {
                      map.setPaintProperty(layer.id, 'line-color', roadColor)
                    } catch (e) {
                      // ignore
                    }
                  }
                }
                // Modify road borders/outlines (casing layers)
                if (layer.id.includes('_casing')) {
                  try {
                    map.setPaintProperty(
                      layer.id,
                      'line-color',
                      roadBorderColor
                    )
                  } catch (e) {
                    // ignore
                  }
                }
              }
              // Hide arrow layers
              if (
                layer.id.includes('road_oneway') ||
                layer.id.includes('arrow') ||
                layer.id.includes('direction')
              ) {
                try {
                  map.setLayoutProperty(layer.id, 'visibility', 'none')
                } catch (e) {
                  // ignore
                }
              }
            })

            // Modify building colors
            try {
              if (map.getLayer('building')) {
                map.setPaintProperty('building', 'fill-color', buildingColor)
                map.setPaintProperty(
                  'building',
                  'fill-outline-color',
                  buildingBorderColor
                )
              }
            } catch (e) {
              // ignore
            }

            // Modify water colors
            try {
              if (map.getLayer('water')) {
                map.setPaintProperty('water', 'fill-color', waterColor)
              }
            } catch (e) {
              // ignore
            }

            // Modify waterway colors
            try {
              if (map.getLayer('waterway')) {
                map.setPaintProperty('waterway', 'line-color', waterwayColor)
              }
            } catch (e) {
              // ignore
            }

            // Modify text colors (symbol layers)
            allLayers.forEach((layer) => {
              if (layer.type === 'symbol') {
                try {
                  if (map.getLayer(layer.id)) {
                    map.setPaintProperty(layer.id, 'text-color', textColor)
                    map.setPaintProperty(
                      layer.id,
                      'text-halo-color',
                      textHaloColor
                    )
                    // Hide arrows but show all other text/symbol layers
                    if (
                      layer.id.includes('road_oneway') ||
                      layer.id.includes('arrow') ||
                      layer.id.includes('direction')
                    ) {
                      map.setLayoutProperty(layer.id, 'visibility', 'none')
                    } else {
                      map.setLayoutProperty(layer.id, 'visibility', 'visible')
                    }
                  }
                } catch (e) {
                  // ignore
                }
              }
            })
          } catch (e) {
            // ignore
          }
        }

        map.on('style.load', () => {
          applyMapColors()

          // Reduce minzoom for text layers to show names at lower zoom levels
          try {
            const style = map.getStyle()
            const modifiedLayers = style.layers.map((layer) => {
              if (layer.type === 'symbol' && layer.minzoom !== undefined) {
                return { ...layer, minzoom: Math.max(0, layer.minzoom - 4) }
              }
              return layer
            })
            map.setStyle({ ...style, layers: modifiedLayers })
          } catch (e) {
            // ignore
          }

          // Increase text size for labels (streets, places, etc.)
          try {
            const layers = map.getStyle().layers || []
            layers.forEach((layer) => {
              if (
                layer.type === 'symbol' &&
                (layer.id.includes('label') ||
                  layer.id.includes('street') ||
                  layer.id.includes('road_label') ||
                  layer.id.includes('place') ||
                  layer.id.includes('name'))
              ) {
                try {
                  const currentTextSize = map.getLayoutProperty(
                    layer.id,
                    'text-size'
                  )
                  if (currentTextSize) {
                    // If it's a number, multiply by 1.3
                    if (typeof currentTextSize === 'number') {
                      map.setLayoutProperty(
                        layer.id,
                        'text-size',
                        currentTextSize * 1.2
                      )
                    }
                    // If it's an expression, we need to scale the values
                    else if (
                      Array.isArray(currentTextSize) &&
                      currentTextSize[0] === 'interpolate'
                    ) {
                      const scaledExpression = currentTextSize.map(
                        (item, idx) => {
                          // Scale numeric values (sizes)
                          if (typeof item === 'number' && idx > 2) {
                            return item * 1.2
                          }
                          return item
                        }
                      )
                      map.setLayoutProperty(
                        layer.id,
                        'text-size',
                        scaledExpression
                      )
                    }
                  }
                } catch (err) {
                  // ignore
                }
              }
            })
          } catch (e) {
            // ignore
          }
        })

        map.on('styleimagemissing', (e) => {
          const canvas = document.createElement('canvas')
          canvas.width = 1
          canvas.height = 1
          const ctx = canvas.getContext('2d')
          ctx.fillStyle = 'rgba(0,0,0,0)'
          ctx.fillRect(0, 0, 1, 1)
          map.addImage(e.id, {
            width: 1,
            height: 1,
            data: ctx.getImageData(0, 0, 1, 1).data,
          })
        })

        // Add marker with accent color
        new maplibregl.Marker({ color: 'var(--accent)' })
          .setLngLat([latlng.lng, latlng.lat])
          .addTo(map)

        try {
          container.__jsMapCreated = true
          container.__jsMapInstance = map
        } catch (e) {
          // ignore
        }

        return true
      } catch (e) {
        return false
      }
    } catch (e) {
      return false
    }
  }

  // Fallback iframe removed

  // Initialize the JS Map immediately (SDK only)
  ensureJsMap()

  // On mobile, move left content inside right content after contact infos
  try {
    const isMobile =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(max-width: 767px)').matches
    if (isMobile) {
      // Prefer generic classes if present, else fallback to contact page classes
      const contentLeft =
        (root && root.querySelector && root.querySelector('.content_left')) ||
        scope.querySelector('.content_left') ||
        (root && root.querySelector && root.querySelector('.contact_map')) ||
        scope.querySelector('.contact_map')
      const contentRight =
        (root && root.querySelector && root.querySelector('.content_right')) ||
        scope.querySelector('.content_right') ||
        (root && root.querySelector && root.querySelector('.contact_right')) ||
        scope.querySelector('.contact_right')
      const contactInfos =
        (root && root.querySelector && root.querySelector('.contact_infos')) ||
        scope.querySelector('.contact_infos')
      if (
        contentLeft &&
        contentRight &&
        contactInfos &&
        !contentLeft.__mobileReparented
      ) {
        contactInfos.insertAdjacentElement('afterend', contentLeft)
        try {
          contentLeft.__mobileReparented = true
        } catch (e) {
          // ignore
        }
      }
    }
  } catch (e) {
    // ignore
  }
}

export function destroyContact(root = document) {
  try {
    const scope = root && root.querySelector ? root : document
    const maps = Array.from(
      scope.querySelectorAll(
        '.is-c-map.w-widget-map, .w-widget-map.is-c-map, .is-c-map'
      )
    )
    maps.forEach((container) => {
      try {
        if (
          container.__jsMapInstance &&
          typeof container.__jsMapInstance.remove === 'function'
        ) {
          container.__jsMapInstance.remove()
        }
      } catch (e) {
        // ignore
      }
      try {
        container.__jsMapInstance = null
        container.__jsMapCreated = false
      } catch (e) {
        // ignore
      }
    })
  } catch (e) {
    // ignore
  }
}
