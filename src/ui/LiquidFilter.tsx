import { useEffect, useState } from 'react'

/**
 * Builds a displacement map that bends the backdrop near the edges of a glass surface and leaves
 * the centre undistorted — the "lensing" look of Liquid Glass. Red/green channels encode the x/y
 * offset (128 = no offset).
 */
function buildLensMap(size = 128, band = 0.22): string {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  const img = ctx.createImageData(size, size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size
      const v = (y + 0.5) / size
      const edge = Math.min(u, 1 - u, v, 1 - v)
      let r = 128
      let g = 128
      if (edge < band) {
        const strength = (1 - edge / band) ** 2.2
        const dx = 0.5 - u
        const dy = 0.5 - v
        const len = Math.hypot(dx, dy) || 1
        r = 128 + (dx / len) * strength * 127
        g = 128 + (dy / len) * strength * 127
      }
      const i = (y * size + x) * 4
      img.data[i] = r
      img.data[i + 1] = g
      img.data[i + 2] = 128
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return canvas.toDataURL('image/png')
}

function supportsBackdropUrlFilter(): boolean {
  // Only Chromium renders SVG filters inside backdrop-filter; Safari/Firefox fall back to plain blur.
  const brands = (navigator as Navigator & { userAgentData?: { brands: { brand: string }[] } }).userAgentData?.brands
  const chromium = !!brands?.some((b) => /Chromium|Google Chrome|Microsoft Edge/.test(b.brand))
  const reduced = window.matchMedia('(prefers-reduced-transparency: reduce)').matches
  return chromium && !reduced
}

/** Hidden SVG with the #liquid-lens filter; enables `.lg-refract` on <html> where supported. */
export default function LiquidFilter() {
  const [map, setMap] = useState('')

  useEffect(() => {
    if (!supportsBackdropUrlFilter()) return
    setMap(buildLensMap())
    document.documentElement.classList.add('lg-refract')
    return () => document.documentElement.classList.remove('lg-refract')
  }, [])

  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: 'absolute' }}>
      <filter
        id="liquid-lens"
        x="0"
        y="0"
        width="1"
        height="1"
        filterUnits="objectBoundingBox"
        primitiveUnits="objectBoundingBox"
        colorInterpolationFilters="sRGB"
      >
        {map && <feImage href={map} x="0" y="0" width="1" height="1" preserveAspectRatio="none" result="lens" />}
        <feDisplacementMap in="SourceGraphic" in2="lens" scale="0.07" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  )
}
