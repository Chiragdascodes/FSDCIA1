// @ts-check
/**
 * Network layer — every external call goes through the Fetch API and returns parsed JSON.
 *
 * Services (all free, all OpenStreetMap-based):
 *  - Photon     https://photon.komoot.io        type-ahead suggestions (built for search-as-you-type)
 *  - Nominatim  https://nominatim.openstreetmap.org  geocoding, reverse geocoding, bounded category search
 *  - Overpass   https://overpass-api.de          full OSM tags (hours, phone, wheelchair) around a point
 *  - OSRM       https://routing.openstreetmap.de walking / cycling / driving routes
 *
 * Design notes:
 *  - Every request has a timeout (AbortController) and can be cancelled by the caller.
 *  - Failures are thrown as `ApiError` with a `kind`, so the UI can show the right message.
 *  - Nominatim's usage policy allows max 1 request/second → requests are queued.
 *  - Overpass is slow (29–43 s measured during benchmarking) → it's the "rich" second pass with
 *    mirror fallback; Nominatim gives a fast first answer.
 *  - Successful responses are cached in sessionStorage for 10 minutes.
 */

import { categoryFromTags } from './categories.js'
import { bboxAround, distanceMeters } from './geo.js'

export const ENDPOINTS = {
  photon: 'https://photon.komoot.io/api/',
  nominatim: 'https://nominatim.openstreetmap.org',
  overpass: ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'],
  osrm: 'https://routing.openstreetmap.de',
}

/**
 * @typedef {'timeout' | 'network' | 'http' | 'rate-limit' | 'parse' | 'aborted' | 'offline'} ApiErrorKind
 */

export class ApiError extends Error {
  /**
   * @param {ApiErrorKind} kind
   * @param {string} service
   * @param {string} message
   * @param {number} [status]
   */
  constructor(kind, service, message, status) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind
    this.service = service
    this.status = status
  }
}

/**
 * Friendly sentence for an error, used in toasts and error states.
 * @param {unknown} err
 * @returns {string}
 */
export function describeError(err) {
  if (!(err instanceof ApiError)) return 'Something went wrong. Please try again.'
  switch (err.kind) {
    case 'offline':
      return "You're offline. Reconnect to search — saved places still work."
    case 'timeout':
      return `${err.service} is taking too long to respond. Try again in a moment.`
    case 'rate-limit':
      return `${err.service} is busy (too many requests). Wait a few seconds and retry.`
    case 'network':
      return `Couldn't reach ${err.service}. Check your connection and retry.`
    case 'parse':
      return `${err.service} sent an unexpected response.`
    case 'aborted':
      return 'Search cancelled.'
    default:
      return `${err.service} returned an error${err.status ? ` (${err.status})` : ''}.`
  }
}

// ---------------------------------------------------------------------------
// fetch wrapper
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} FetchOptions
 * @property {string} service                 Human-readable service name for errors.
 * @property {'GET' | 'POST'} [method]
 * @property {BodyInit} [body]
 * @property {number} [timeoutMs]
 * @property {AbortSignal} [signal]
 * @property {number} [cacheMinutes]          0 disables caching.
 */

/**
 * GET/POST a URL and parse the JSON body.
 * @template T
 * @param {string} url
 * @param {FetchOptions} opts
 * @returns {Promise<T>}
 */
export async function fetchJSON(url, opts) {
  const { service, method = 'GET', body, timeoutMs = 12000, signal, cacheMinutes = 10 } = opts
  const cacheKey = `beacon:api:${method}:${url}:${typeof body === 'string' ? body : body ? String(body) : ''}`

  const cached = cacheMinutes > 0 ? readCache(cacheKey) : null
  if (cached !== null) return /** @type {T} */ (cached)

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new ApiError('offline', service, 'Browser is offline')
  }

  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort, { once: true })

  /** @type {Response} */
  let res
  try {
    res = await fetch(url, {
      method,
      body,
      signal: controller.signal,
      headers: { Accept: 'application/json' },
      referrerPolicy: 'strict-origin-when-cross-origin',
    })
  } catch (err) {
    if (timedOut) throw new ApiError('timeout', service, `${service} timed out after ${timeoutMs} ms`)
    if (signal?.aborted) throw new ApiError('aborted', service, 'Request aborted')
    throw new ApiError('network', service, err instanceof Error ? err.message : 'Network error')
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }

  if (res.status === 429 || res.status === 503 || res.status === 504) {
    throw new ApiError('rate-limit', service, `${service} is rate limiting`, res.status)
  }
  if (!res.ok) throw new ApiError('http', service, `${service} HTTP ${res.status}`, res.status)

  /** @type {T} */
  let data
  try {
    data = await res.json()
  } catch {
    throw new ApiError('parse', service, `${service} returned invalid JSON`)
  }
  if (cacheMinutes > 0) writeCache(cacheKey, data, cacheMinutes)
  return data
}

/**
 * @param {string} key
 * @returns {unknown | null}
 */
function readCache(key) {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const { expires, data } = JSON.parse(raw)
    if (Date.now() > expires) {
      sessionStorage.removeItem(key)
      return null
    }
    return data
  } catch {
    return null
  }
}

/**
 * @param {string} key
 * @param {unknown} data
 * @param {number} minutes
 */
function writeCache(key, data, minutes) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ expires: Date.now() + minutes * 60_000, data }))
  } catch {
    // Storage full or blocked — caching is an optimisation only.
  }
}

// Nominatim: at most one request per second (usage policy).
let nominatimChain = Promise.resolve()
let lastNominatimAt = 0
/**
 * @template T
 * @param {() => Promise<T>} task
 * @returns {Promise<T>}
 */
function nominatimQueue(task) {
  const run = nominatimChain.then(async () => {
    const wait = Math.max(0, lastNominatimAt + 1100 - Date.now())
    if (wait) await new Promise((r) => setTimeout(r, wait))
    lastNominatimAt = Date.now()
    return task()
  })
  nominatimChain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

// ---------------------------------------------------------------------------
// Place model
// ---------------------------------------------------------------------------

/**
 * One shape for every place, whichever service it came from.
 * @typedef {Object} Place
 * @property {string} id                'node/123'
 * @property {'node' | 'way' | 'relation'} osmType
 * @property {number} osmId
 * @property {string} name
 * @property {number} lat
 * @property {number} lon
 * @property {string | null} categoryId
 * @property {string} kind              Readable type, e.g. "Pharmacy", "Bus stop", "City".
 * @property {Record<string, string>} tags
 * @property {Address} address
 * @property {'photon' | 'nominatim' | 'overpass'} source
 * @property {[number, number, number, number] | null} bbox   [west, south, east, north]
 * @property {number} [distance]        Metres from the search anchor.
 *
 * @typedef {Object} Address
 * @property {string} street   "12, Church Street"
 * @property {string} area     Neighbourhood / suburb
 * @property {string} city
 * @property {string} state
 * @property {string} postcode
 * @property {string} country
 */

/** @type {Record<string, 'node' | 'way' | 'relation'>} */
const OSM_TYPE = { N: 'node', W: 'way', R: 'relation', node: 'node', way: 'way', relation: 'relation' }

/**
 * @param {string} key
 * @param {string} value
 */
function readableKind(key, value) {
  const fromTags = categoryFromTags({ [key]: value })
  if (fromTags) return fromTags.label
  if (!value || value === 'yes') return capitalise(key)
  return capitalise(value.replace(/_/g, ' '))
}

/**
 * @param {string} s
 */
function capitalise(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

/**
 * Short one-line address: "12, Church Street, Shanthala Nagar".
 * @param {Address} a
 */
export function shortAddress(a) {
  return [a.street, a.area].filter(Boolean).join(', ') || [a.city, a.state].filter(Boolean).join(', ')
}

/**
 * Sub-address for "which one did you mean?" cards: "Shivajinagar · Bengaluru · Karnataka".
 * @param {Address} a
 */
export function localityLine(a) {
  return [a.area, a.city, a.state].filter((v, i, arr) => v && arr.indexOf(v) === i).join(' · ')
}

/**
 * Full address for copying.
 * @param {Address} a
 */
export function fullAddress(a) {
  return [a.street, a.area, a.city, a.state, a.postcode, a.country].filter(Boolean).join(', ')
}

/**
 * @param {Record<string, any>} p  Photon feature properties
 * @param {[number, number]} coords
 * @returns {Place}
 */
function placeFromPhoton(p, coords) {
  const osmType = OSM_TYPE[p.osm_type] ?? 'node'
  const tags = { [p.osm_key]: p.osm_value }
  return {
    id: `${osmType}/${p.osm_id}`,
    osmType,
    osmId: Number(p.osm_id),
    name: p.name || [p.housenumber, p.street].filter(Boolean).join(' ') || p.city || 'Unnamed place',
    lat: coords[1],
    lon: coords[0],
    categoryId: categoryFromTags(tags)?.id ?? null,
    kind: readableKind(p.osm_key, p.osm_value),
    tags,
    address: {
      street: [p.housenumber, p.street].filter(Boolean).join(', ') || (p.name !== p.street ? '' : ''),
      area: p.district || p.locality || '',
      city: p.city || p.county || '',
      state: p.state || '',
      postcode: p.postcode || '',
      country: p.country || '',
    },
    source: 'photon',
    bbox: Array.isArray(p.extent) ? [p.extent[0], p.extent[3], p.extent[2], p.extent[1]] : null,
  }
}

/**
 * @param {Record<string, any>} r  Nominatim jsonv2 result
 * @returns {Place}
 */
function placeFromNominatim(r) {
  const a = r.address ?? {}
  const tags = { [r.category]: r.type, ...(r.extratags ?? {}) }
  if (r.namedetails?.name) tags.name = r.namedetails.name
  if (r.namedetails?.['name:en']) tags['name:en'] = r.namedetails['name:en']
  const osmType = OSM_TYPE[r.osm_type] ?? 'node'
  const bb = Array.isArray(r.boundingbox) ? r.boundingbox.map(Number) : null
  return {
    id: `${osmType}/${r.osm_id}`,
    osmType,
    osmId: Number(r.osm_id),
    name: r.namedetails?.['name:en'] || r.name || String(r.display_name ?? '').split(',')[0] || 'Unnamed place',
    lat: Number(r.lat),
    lon: Number(r.lon),
    categoryId: categoryFromTags(tags)?.id ?? null,
    kind: readableKind(r.category, r.type),
    tags,
    address: {
      street: [a.house_number, a.road].filter(Boolean).join(', '),
      area: a.neighbourhood || a.suburb || a.quarter || a.city_district || '',
      city: a.city || a.town || a.village || a.municipality || a.state_district || '',
      state: a.state || '',
      postcode: a.postcode || '',
      country: a.country || '',
    },
    source: 'nominatim',
    bbox: bb && bb.length === 4 ? [bb[2], bb[0], bb[3], bb[1]] : null,
  }
}

/**
 * @param {Record<string, any>} e  Overpass element
 * @returns {Place | null}
 */
function placeFromOverpass(e) {
  const lat = e.lat ?? e.center?.lat
  const lon = e.lon ?? e.center?.lon
  if (typeof lat !== 'number' || typeof lon !== 'number') return null
  const t = /** @type {Record<string, string>} */ (e.tags ?? {})
  const category = categoryFromTags(t)
  const primaryKey = ['amenity', 'shop', 'healthcare', 'tourism'].find((k) => t[k]) ?? 'amenity'
  return {
    id: `${e.type}/${e.id}`,
    osmType: e.type,
    osmId: e.id,
    name: t['name:en'] || t.name || t.brand || t.operator || '',
    lat,
    lon,
    categoryId: category?.id ?? null,
    kind: readableKind(primaryKey, t[primaryKey] ?? ''),
    tags: t,
    address: {
      street: [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(', '),
      area: t['addr:suburb'] || t['addr:neighbourhood'] || t['addr:place'] || '',
      city: t['addr:city'] || '',
      state: t['addr:state'] || '',
      postcode: t['addr:postcode'] || '',
      country: t['addr:country'] || '',
    },
    source: 'overpass',
    bbox: null,
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Type-ahead suggestions biased to a location (Photon is designed for this; Nominatim is not).
 * @param {string} q
 * @param {{ near?: { lat: number, lon: number } | null, limit?: number, signal?: AbortSignal }} [opts]
 * @returns {Promise<Place[]>}
 */
export async function suggest(q, opts = {}) {
  const params = new URLSearchParams({ q, limit: String(opts.limit ?? 7), lang: 'en' })
  if (opts.near) {
    params.set('lat', opts.near.lat.toFixed(4))
    params.set('lon', opts.near.lon.toFixed(4))
    params.set('location_bias_scale', '0.3')
  }
  /** @type {{ features: { properties: Record<string, any>, geometry: { coordinates: [number, number] } }[] }} */
  const data = await fetchJSON(`${ENDPOINTS.photon}?${params}`, { service: 'Photon', signal: opts.signal, timeoutMs: 8000 })
  if (!data || !Array.isArray(data.features)) throw new ApiError('parse', 'Photon', 'Missing features')
  return dedupe(data.features.map((f) => placeFromPhoton(f.properties, f.geometry.coordinates)))
}

/**
 * Free-text geocoding with Nominatim.
 * @param {string} q
 * @param {{ near?: { lat: number, lon: number } | null, radius?: number, bounded?: boolean, limit?: number, signal?: AbortSignal, countryCodes?: string }} [opts]
 * @returns {Promise<Place[]>}
 */
export async function geocode(q, opts = {}) {
  const params = new URLSearchParams({
    q,
    format: 'jsonv2',
    addressdetails: '1',
    extratags: '1',
    namedetails: '1',
    limit: String(opts.limit ?? 10),
    'accept-language': 'en',
  })
  if (opts.near && opts.radius) {
    const b = bboxAround(opts.near, opts.radius)
    params.set('viewbox', `${b.west},${b.north},${b.east},${b.south}`)
    if (opts.bounded) params.set('bounded', '1')
  }
  if (opts.countryCodes) params.set('countrycodes', opts.countryCodes)
  /** @type {Record<string, any>[]} */
  const data = await nominatimQueue(() =>
    fetchJSON(`${ENDPOINTS.nominatim}/search?${params}`, { service: 'Nominatim', signal: opts.signal }),
  )
  if (!Array.isArray(data)) throw new ApiError('parse', 'Nominatim', 'Expected an array')
  return dedupe(data.map(placeFromNominatim))
}

/**
 * Address of a coordinate ("Where am I?").
 * @param {number} lat
 * @param {number} lon
 * @param {{ zoom?: number, signal?: AbortSignal }} [opts]
 * @returns {Promise<Place | null>}
 */
export async function reverseGeocode(lat, lon, opts = {}) {
  const params = new URLSearchParams({
    lat: lat.toFixed(6),
    lon: lon.toFixed(6),
    format: 'jsonv2',
    zoom: String(opts.zoom ?? 17),
    addressdetails: '1',
    'accept-language': 'en',
  })
  /** @type {Record<string, any>} */
  const data = await nominatimQueue(() =>
    fetchJSON(`${ENDPOINTS.nominatim}/reverse?${params}`, { service: 'Nominatim', signal: opts.signal }),
  )
  if (!data || data.error) return null
  return placeFromNominatim(data)
}

/**
 * Look up places by OSM id (used for shared links): ["node/123"] → Place[].
 * @param {string[]} ids
 * @param {AbortSignal} [signal]
 * @returns {Promise<Place[]>}
 */
export async function lookupByIds(ids, signal) {
  const osmIds = ids
    .map((id) => {
      const [type, num] = id.split('/')
      return `${type.charAt(0).toUpperCase()}${num}`
    })
    .join(',')
  const params = new URLSearchParams({
    osm_ids: osmIds,
    format: 'jsonv2',
    addressdetails: '1',
    extratags: '1',
    namedetails: '1',
    'accept-language': 'en',
  })
  /** @type {Record<string, any>[]} */
  const data = await nominatimQueue(() =>
    fetchJSON(`${ENDPOINTS.nominatim}/lookup?${params}`, { service: 'Nominatim', signal }),
  )
  return Array.isArray(data) ? data.map(placeFromNominatim) : []
}

/**
 * FAST pass: bounded Nominatim category search (~1.5 s per phrase). Results include `extratags`
 * (opening_hours, phone, wheelchair, website…), so they are complete enough to show immediately.
 * Categories with sub-types ("hospital" + "clinic") run one query per phrase; the Nominatim queue
 * keeps them to 1 request/second.
 * @param {import('./categories.js').Category} category
 * @param {{ lat: number, lon: number }} center
 * @param {number} radius metres
 * @param {AbortSignal} [signal]
 * @returns {Promise<Place[]>}
 */
export async function searchCategoryFast(category, center, radius, signal) {
  const settled = await Promise.allSettled(
    category.nominatim.map((phrase) => geocode(phrase, { near: center, radius, bounded: true, limit: 40, signal })),
  )
  const ok = settled.filter((s) => s.status === 'fulfilled')
  if (!ok.length) throw /** @type {PromiseRejectedResult} */ (settled[0]).reason
  const places = dedupe(ok.flatMap((s) => /** @type {PromiseFulfilledResult<Place[]>} */ (s).value))
  return withinRadius(
    places.filter((p) => p.categoryId === category.id),
    center,
    radius,
  )
}

/**
 * RICH pass: Overpass returns every matching OSM object with all its tags. Slow on the public
 * servers, so it runs in the background and tries mirrors one after another.
 * @param {import('./categories.js').Category} category
 * @param {{ lat: number, lon: number }} center
 * @param {number} radius metres
 * @param {AbortSignal} [signal]
 * @returns {Promise<Place[]>}
 */
export async function searchCategoryRich(category, center, radius, signal) {
  const around = `(around:${Math.round(radius)},${center.lat.toFixed(6)},${center.lon.toFixed(6)})`
  const parts = category.tags.map((t) => `nwr["${t.key}"="${t.value}"]${around};`).join('')
  const query = `[out:json][timeout:25];(${parts});out center tags 120;`

  /** @type {unknown} */
  let lastError = null
  for (const url of ENDPOINTS.overpass) {
    try {
      /** @type {{ elements: Record<string, any>[] }} */
      const data = await fetchJSON(url, {
        service: 'Overpass',
        method: 'POST',
        body: new URLSearchParams({ data: query }),
        timeoutMs: 28000,
        signal,
      })
      if (!data || !Array.isArray(data.elements)) throw new ApiError('parse', 'Overpass', 'Missing elements')
      const places = /** @type {Place[]} */ (data.elements.map(placeFromOverpass).filter(Boolean))
      return withinRadius(places, center, radius)
    } catch (err) {
      if (err instanceof ApiError && err.kind === 'aborted') throw err
      lastError = err
    }
  }
  throw lastError ?? new ApiError('network', 'Overpass', 'All Overpass servers failed')
}

/**
 * Find a named place ("Starbucks") near a point.
 * @param {string} name
 * @param {{ lat: number, lon: number }} center
 * @param {number} radius
 * @param {AbortSignal} [signal]
 * @returns {Promise<Place[]>}
 */
export async function searchNameNear(name, center, radius, signal) {
  const places = await geocode(name, { near: center, radius, bounded: true, limit: 30, signal })
  return withinRadius(places, center, radius)
}

/**
 * Merge fast (Nominatim) and rich (Overpass) results: same OSM id → combine tags, keep the better
 * address; places only Overpass knows about are added.
 * @param {Place[]} fast
 * @param {Place[]} rich
 * @returns {Place[]}
 */
export function mergePlaces(fast, rich) {
  /** @type {Map<string, Place>} */
  const byId = new Map(fast.map((p) => [p.id, p]))
  for (const r of rich) {
    const existing = byId.get(r.id)
    if (existing) {
      byId.set(r.id, {
        ...existing,
        tags: { ...existing.tags, ...r.tags },
        name: existing.name || r.name,
        address: {
          street: existing.address.street || r.address.street,
          area: existing.address.area || r.address.area,
          city: existing.address.city || r.address.city,
          state: existing.address.state || r.address.state,
          postcode: existing.address.postcode || r.address.postcode,
          country: existing.address.country || r.address.country,
        },
      })
    } else {
      byId.set(r.id, r)
    }
  }
  return [...byId.values()]
}

/**
 * @typedef {Object} RouteStep
 * @property {string} instruction
 * @property {number} distance
 * @property {number} duration
 * @property {[number, number]} location  [lon, lat]
 * @property {string} maneuver            OSRM maneuver type
 * @property {string} modifier
 *
 * @typedef {Object} Route
 * @property {number} distance  metres
 * @property {number} duration  seconds
 * @property {{ type: 'LineString', coordinates: [number, number][] }} geometry
 * @property {RouteStep[]} steps
 * @property {'foot' | 'bike' | 'car'} mode
 */

const OSRM_PROFILE = { foot: 'routed-foot', bike: 'routed-bike', car: 'routed-car' }

/**
 * Turn-by-turn route between two points using the FOSSGIS OSRM servers (same as openstreetmap.org).
 * @param {'foot' | 'bike' | 'car'} mode
 * @param {{ lat: number, lon: number }} from
 * @param {{ lat: number, lon: number }} to
 * @param {AbortSignal} [signal]
 * @returns {Promise<Route>}
 */
export async function getRoute(mode, from, to, signal) {
  const coords = `${from.lon.toFixed(6)},${from.lat.toFixed(6)};${to.lon.toFixed(6)},${to.lat.toFixed(6)}`
  const url = `${ENDPOINTS.osrm}/${OSRM_PROFILE[mode]}/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true`
  /** @type {Record<string, any>} */
  const data = await fetchJSON(url, { service: 'OSRM routing', signal, timeoutMs: 15000 })
  if (data.code !== 'Ok' || !data.routes?.length) {
    throw new ApiError('http', 'OSRM routing', data.message || 'No route found')
  }
  const r = data.routes[0]
  /** @type {RouteStep[]} */
  const steps = r.legs.flatMap((/** @type {any} */ leg) =>
    leg.steps.map((/** @type {any} */ s) => ({
      instruction: describeStep(s),
      distance: s.distance,
      duration: s.duration,
      location: s.maneuver.location,
      maneuver: s.maneuver.type,
      modifier: s.maneuver.modifier ?? '',
    })),
  )
  return { distance: r.distance, duration: r.duration, geometry: r.geometry, steps, mode }
}

/**
 * OSRM step → "Turn left onto Church Street".
 * @param {any} s
 * @returns {string}
 */
export function describeStep(s) {
  const type = s.maneuver?.type ?? ''
  const mod = s.maneuver?.modifier ?? ''
  const road = s.name ? ` onto ${s.name}` : ''
  const dir = mod ? mod.replace('uturn', 'U-turn') : ''
  switch (type) {
    case 'depart':
      return `Head ${bearingWord(s.maneuver?.bearing_after)}${s.name ? ` on ${s.name}` : ''}`
    case 'arrive':
      return mod && mod !== 'straight' ? `Arrive — destination on the ${mod.replace('slight ', '')}` : 'Arrive at destination'
    case 'turn':
    case 'end of road':
      return dir === 'straight' ? `Continue straight${road}` : `Turn ${dir}${road}`
    case 'new name':
    case 'continue':
      return `Continue${dir && dir !== 'straight' ? ` ${dir}` : ''}${road || ' straight'}`
    case 'merge':
      return `Merge ${dir}${road}`
    case 'on ramp':
      return `Take the ramp ${dir}${road}`
    case 'off ramp':
      return `Take the exit ${dir}${road}`
    case 'fork':
      return `Keep ${dir} at the fork${road}`
    case 'roundabout':
    case 'rotary':
      return `At the roundabout, take exit ${s.maneuver?.exit ?? ''}${road}`.replace('exit  ', 'the exit ')
    case 'exit roundabout':
    case 'exit rotary':
      return `Exit the roundabout${road}`
    default:
      return `${capitalise(type || 'continue')}${dir ? ` ${dir}` : ''}${road}`
  }
}

/**
 * @param {number | undefined} deg
 */
function bearingWord(deg) {
  if (typeof deg !== 'number') return 'out'
  return ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'][Math.round(deg / 45) % 8]
}

/**
 * @param {Place[]} places
 * @param {{ lat: number, lon: number }} center
 * @param {number} radius
 * @returns {Place[]}
 */
function withinRadius(places, center, radius) {
  return places
    .map((p) => ({ ...p, distance: distanceMeters(center, p) }))
    .filter((p) => (p.distance ?? 0) <= radius * 1.05)
}

/**
 * @param {Place[]} places
 * @returns {Place[]}
 */
function dedupe(places) {
  const seen = new Set()
  return places.filter((p) => {
    if (seen.has(p.id)) return false
    seen.add(p.id)
    return true
  })
}
