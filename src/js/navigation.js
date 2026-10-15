// @ts-check
/**
 * Turn-by-turn navigation maths (used by the live "Start" view).
 *
 *  - buildRouteIndex: cumulative distance along the route polyline
 *  - pointAlong:      position + heading at a given distance (used for simulated trips)
 *  - snapToRoute:     project a GPS fix onto the route → distance travelled + off-route distance
 *  - progress:        next manoeuvre, distance to it, remaining distance/time, arrival
 */

import { distanceMeters } from './geo.js'

/**
 * @typedef {{ coords: [number, number][], cum: number[], total: number }} RouteIndex
 * @typedef {import('./api.js').Route} Route
 */

/**
 * @param {[number, number][]} coords  [lon, lat] pairs
 * @returns {RouteIndex}
 */
export function buildRouteIndex(coords) {
  const cum = [0]
  for (let i = 1; i < coords.length; i++) {
    const [lon1, lat1] = coords[i - 1]
    const [lon2, lat2] = coords[i]
    cum.push(cum[i - 1] + distanceMeters({ lat: lat1, lon: lon1 }, { lat: lat2, lon: lon2 }))
  }
  return { coords, cum, total: cum[cum.length - 1] ?? 0 }
}

/**
 * Initial bearing (degrees from north) from a to b.
 * @param {[number, number]} a  [lon, lat]
 * @param {[number, number]} b  [lon, lat]
 */
export function bearing(a, b) {
  const toRad = Math.PI / 180
  const y = Math.sin((b[0] - a[0]) * toRad) * Math.cos(b[1] * toRad)
  const x =
    Math.cos(a[1] * toRad) * Math.sin(b[1] * toRad) -
    Math.sin(a[1] * toRad) * Math.cos(b[1] * toRad) * Math.cos((b[0] - a[0]) * toRad)
  return ((Math.atan2(y, x) / toRad) + 360) % 360
}

/**
 * Point and heading at `d` metres along the route.
 * @param {RouteIndex} idx
 * @param {number} d
 * @returns {{ lon: number, lat: number, heading: number }}
 */
export function pointAlong(idx, d) {
  const { coords, cum, total } = idx
  const dist = Math.max(0, Math.min(total, d))
  let i = 1
  while (i < cum.length - 1 && cum[i] < dist) i++
  const seg = cum[i] - cum[i - 1] || 1
  const f = (dist - cum[i - 1]) / seg
  const [lon1, lat1] = coords[i - 1]
  const [lon2, lat2] = coords[i]
  return { lon: lon1 + (lon2 - lon1) * f, lat: lat1 + (lat2 - lat1) * f, heading: bearing(coords[i - 1], coords[i]) }
}

/**
 * Projects a position onto the route (local equirectangular projection per segment).
 * @param {RouteIndex} idx
 * @param {{ lat: number, lon: number }} p
 * @returns {{ along: number, offRoute: number, heading: number }}
 */
export function snapToRoute(idx, p) {
  const { coords, cum } = idx
  const kx = 111_320 * Math.cos((p.lat * Math.PI) / 180)
  const ky = 110_540
  let best = { along: 0, offRoute: Infinity, heading: 0 }
  for (let i = 1; i < coords.length; i++) {
    const ax = coords[i - 1][0] * kx
    const ay = coords[i - 1][1] * ky
    const bx = coords[i][0] * kx
    const by = coords[i][1] * ky
    const px = p.lon * kx
    const py = p.lat * ky
    const dx = bx - ax
    const dy = by - ay
    const len2 = dx * dx + dy * dy || 1
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2))
    const qx = ax + t * dx
    const qy = ay + t * dy
    const off = Math.hypot(px - qx, py - qy)
    if (off < best.offRoute) {
      best = { along: cum[i - 1] + t * (cum[i] - cum[i - 1]), offRoute: off, heading: bearing(coords[i - 1], coords[i]) }
    }
  }
  return best
}

/**
 * @typedef {Object} NavProgress
 * @property {number} stepIndex          index of the next manoeuvre in route.steps
 * @property {number} toNext             metres to the next manoeuvre
 * @property {number} remaining          metres left
 * @property {number} remainingSeconds   seconds left (scaled from the route estimate)
 * @property {boolean} arrived
 */

/**
 * @param {Route} route
 * @param {RouteIndex} idx
 * @param {number} along  metres travelled along the route
 * @returns {NavProgress}
 */
export function progress(route, idx, along) {
  const remaining = Math.max(0, idx.total - along)
  // Each step starts where the previous ones end.
  let start = 0
  let stepIndex = route.steps.length - 1
  let toNext = remaining
  for (let i = 0; i < route.steps.length; i++) {
    if (start > along + 1) {
      stepIndex = i
      toNext = start - along
      break
    }
    start += route.steps[i].distance
  }
  const ratio = idx.total ? remaining / idx.total : 0
  return {
    stepIndex,
    toNext,
    remaining,
    remainingSeconds: route.duration * ratio,
    arrived: remaining < 12,
  }
}

/** Typical speeds (m/s) for the simulated trip, sped up 6× so a demo finishes quickly. */
export const SIM_SPEED = { foot: 1.4 * 6, bike: 4.5 * 6, moto: 8 * 6, car: 9 * 6 }

/** Camera per travel mode (Google-Maps-like: closer and flatter when walking, further when driving). */
export const NAV_CAMERA = {
  foot: { zoom: 18.2, pitch: 60 },
  moto: { zoom: 17.1, pitch: 67 },
  bike: { zoom: 17.5, pitch: 65 },
  car: { zoom: 16.8, pitch: 70 },
}
