// @ts-check
/**
 * Small geography helpers: distances, bounding boxes, readable distance/time labels.
 */

const EARTH_RADIUS_M = 6_371_008.8

/** Average speeds (m/min) for the quick estimates shown in result rows. */
export const SPEED_M_PER_MIN = { foot: 80, bike: 250, car: 400 }

/**
 * @typedef {{ lat: number, lon: number }} LatLon
 */

/**
 * Great-circle distance in metres (haversine formula).
 * @param {LatLon} a
 * @param {LatLon} b
 * @returns {number}
 */
export function distanceMeters(a, b) {
  const toRad = Math.PI / 180
  const dLat = (b.lat - a.lat) * toRad
  const dLon = (b.lon - a.lon) * toRad
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

/**
 * Bounding box that contains a circle of `radius` metres around `center`.
 * @param {LatLon} center
 * @param {number} radius
 * @returns {{ south: number, west: number, north: number, east: number }}
 */
export function bboxAround(center, radius) {
  const dLat = (radius / EARTH_RADIUS_M) * (180 / Math.PI)
  const dLon = dLat / Math.max(0.01, Math.cos((center.lat * Math.PI) / 180))
  return {
    south: clamp(center.lat - dLat, -90, 90),
    north: clamp(center.lat + dLat, -90, 90),
    west: clamp(center.lon - dLon, -180, 180),
    east: clamp(center.lon + dLon, -180, 180),
  }
}

/**
 * "350 m", "1.2 km", "12 km" — or miles/feet when `units` is imperial.
 * @param {number} meters
 * @param {'metric' | 'imperial'} [units]
 * @returns {string}
 */
export function formatDistance(meters, units = 'metric') {
  if (!Number.isFinite(meters)) return ''
  if (units === 'imperial') {
    const feet = meters * 3.28084
    if (feet < 1000) return `${Math.round(feet / 10) * 10} ft`
    const miles = meters / 1609.344
    return `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi`
  }
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} m`
  const km = meters / 1000
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`
}

/**
 * "4 min", "1 h 05 min".
 * @param {number} seconds
 * @returns {string}
 */
export function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return ''
  const mins = Math.max(1, Math.round(seconds / 60))
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h} h ${String(m).padStart(2, '0')} min`
}

/**
 * Rough travel time used before a real route is requested.
 * @param {number} meters
 * @param {'foot' | 'bike' | 'car'} [mode]
 * @returns {number} seconds
 */
export function estimateSeconds(meters, mode = 'foot') {
  return (meters / SPEED_M_PER_MIN[mode]) * 60
}

/**
 * Compass direction from a to b ("NE", "S", …) — helps when people are walking.
 * @param {LatLon} a
 * @param {LatLon} b
 * @returns {string}
 */
export function compassDirection(a, b) {
  const toRad = Math.PI / 180
  const y = Math.sin((b.lon - a.lon) * toRad) * Math.cos(b.lat * toRad)
  const x =
    Math.cos(a.lat * toRad) * Math.sin(b.lat * toRad) -
    Math.sin(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.cos((b.lon - a.lon) * toRad)
  const bearing = (Math.atan2(y, x) / toRad + 360) % 360
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(bearing / 45) % 8]
}

/**
 * @param {unknown} lat
 * @param {unknown} lon
 * @returns {boolean}
 */
export function isValidLatLon(lat, lon) {
  return (
    typeof lat === 'number' &&
    typeof lon === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lon) <= 180
  )
}

/**
 * @param {number} v
 * @param {number} min
 * @param {number} max
 */
function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v))
}
