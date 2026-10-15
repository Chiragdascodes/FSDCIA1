// @ts-check
/**
 * Finds a photo for a place from open sources linked in its OpenStreetMap tags:
 *   1. `image`              — a direct image URL
 *   2. `wikimedia_commons`  — a Commons file ("File:Something.jpg")
 *   3. `wikidata`           — the item's image (P18), via the Wikidata API
 *   4. `brand:wikidata`     — the brand's logo (P154), e.g. Apollo Pharmacy
 * Returns null when nothing is linked; the UI then shows an illustrated header instead.
 */

import { fetchJSON } from './api.js'

/**
 * @typedef {{ url: string, kind: 'photo' | 'logo', credit: string }} PlacePhoto
 */

/**
 * @param {string} file  "File:Name.jpg" or "Name.jpg"
 * @param {number} width
 */
export function commonsFileUrl(file, width = 640) {
  const name = file.replace(/^File:/i, '').trim()
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(name)}?width=${width}`
}

/**
 * @param {string} qid
 * @param {'P18' | 'P154'} property
 * @param {AbortSignal} [signal]
 * @returns {Promise<string | null>} Commons file name
 */
async function wikidataImage(qid, property, signal) {
  if (!/^Q\d+$/.test(qid)) return null
  const params = new URLSearchParams({ action: 'wbgetclaims', entity: qid, property, format: 'json', origin: '*' })
  /** @type {{ claims?: Record<string, { mainsnak?: { datavalue?: { value?: unknown } } }[]> }} */
  const data = await fetchJSON(`https://www.wikidata.org/w/api.php?${params}`, {
    service: 'Wikidata',
    signal,
    timeoutMs: 8000,
    cacheMinutes: 60,
  })
  const value = data.claims?.[property]?.[0]?.mainsnak?.datavalue?.value
  return typeof value === 'string' ? value : null
}

/**
 * @param {Record<string, string>} tags
 * @param {AbortSignal} [signal]
 * @returns {Promise<PlacePhoto | null>}
 */
export async function findPlacePhoto(tags, signal) {
  const image = tags.image
  if (image && /^https?:\/\/.+\.(jpe?g|png|webp)(\?.*)?$/i.test(image)) {
    return { url: image, kind: 'photo', credit: new URL(image).hostname }
  }
  if (image && /commons\.wikimedia\.org\/wiki\/File:/i.test(image)) {
    return { url: commonsFileUrl(decodeURIComponent(image.split('/wiki/')[1])), kind: 'photo', credit: 'Wikimedia Commons' }
  }
  if (tags.wikimedia_commons?.startsWith('File:')) {
    return { url: commonsFileUrl(tags.wikimedia_commons), kind: 'photo', credit: 'Wikimedia Commons' }
  }
  try {
    if (tags.wikidata) {
      const file = await wikidataImage(tags.wikidata, 'P18', signal)
      if (file) return { url: commonsFileUrl(file), kind: 'photo', credit: 'Wikimedia Commons' }
    }
    const brand = tags['brand:wikidata'] || tags['operator:wikidata']
    if (brand) {
      const logo = await wikidataImage(brand, 'P154', signal)
      if (logo) return { url: commonsFileUrl(logo, 320), kind: 'logo', credit: 'Wikimedia Commons' }
      const photo = await wikidataImage(brand, 'P18', signal)
      if (photo) return { url: commonsFileUrl(photo), kind: 'photo', credit: 'Wikimedia Commons' }
    }
  } catch {
    // Photos are decorative: any failure just falls back to the illustrated header.
  }
  return null
}
