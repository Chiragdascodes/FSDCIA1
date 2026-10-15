import { createElement, type ReactElement } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import type { Map as MapLibreMap } from 'maplibre-gl'
import { CATEGORIES } from '../js/categories.js'
import { iconFor } from '../ui/icons'

const PIXEL_RATIO = 2

/** Renders a React element to an HTML string with the client renderer (avoids shipping react-dom/server). */
function toMarkup(el: ReactElement): string {
  const host = document.createElement('div')
  const root = createRoot(host)
  flushSync(() => root.render(el))
  const html = host.innerHTML
  root.unmount()
  return html
}

/**
 * Builds a teardrop pin as an SVG string: category colour, white rim, white Phosphor glyph (fill weight).
 * `selected` pins are larger and get a soft halo (HIG Maps: clearly identify the selection).
 */
function pinSvg(color: string, iconName: string | undefined, selected: boolean): { svg: string; w: number; h: number } {
  const w = selected ? 52 : 38
  const h = selected ? 66 : 48
  const r = w / 2 - 3
  const glyph = toMarkup(
    createElement(iconFor(iconName), { color: '#ffffff', size: selected ? 22 : 17, weight: 'fill' }),
  )
  const cx = w / 2
  const cy = r + 3
  const g = selected ? 22 : 17
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w * PIXEL_RATIO}" height="${h * PIXEL_RATIO}" viewBox="0 0 ${w} ${h}">
  <defs><filter id="s" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="2" stdDeviation="1.6" flood-opacity=".35"/></filter></defs>
  ${selected ? `<circle cx="${cx}" cy="${cy}" r="${r + 2}" fill="${color}" opacity=".25"/>` : ''}
  <path filter="url(#s)" d="M${cx} ${h - 2} C ${cx - 4} ${h - 10}, 3 ${cy + r * 0.55}, 3 ${cy} A ${r} ${r} 0 1 1 ${w - 3} ${cy} C ${w - 3} ${cy + r * 0.55}, ${cx + 4} ${h - 10}, ${cx} ${h - 2} Z" fill="${color}" stroke="#fff" stroke-width="2.5"/>
  <g transform="translate(${cx - g / 2} ${cy - g / 2})">${glyph
    .replace(/\s(width|height)="[^"]*"/g, '')
    .replace('<svg', `<svg width="${g}" height="${g}"`)}</g>
</svg>`
  return { svg, w, h }
}

function loadImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  })
}

const cache = new Map<string, Promise<HTMLImageElement>>()

function image(id: string, color: string, iconName: string | undefined, selected: boolean) {
  if (!cache.has(id)) cache.set(id, loadImage(pinSvg(color, iconName, selected).svg))
  return cache.get(id)!
}

const GENERIC = { id: 'other', color: '#64748b', icon: 'MapPin' }

/** Registers `pin-<category>` and `pin-<category>-selected` images on the map (idempotent). */
export async function addPinImages(map: MapLibreMap): Promise<void> {
  const all = [...CATEGORIES.map((c) => ({ id: c.id, color: c.color, icon: c.icon })), GENERIC]
  await Promise.all(
    all.flatMap((c) =>
      [false, true].map(async (selected) => {
        const name = `pin-${c.id}${selected ? '-selected' : ''}`
        const img = await image(name, c.color, c.icon, selected)
        if (!map.hasImage(name)) map.addImage(name, img, { pixelRatio: PIXEL_RATIO })
      }),
    ),
  )
}
