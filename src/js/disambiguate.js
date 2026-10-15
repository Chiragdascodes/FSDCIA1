// @ts-check
/**
 * "Which MG Road did you mean?"
 *
 * Benchmark problem (evidence E6): on openstreetmap.org, "pharmacy near MG Road" silently picked
 * MG Roads in West Bengal and Mumbai. Here every candidate is ranked by distance from the user,
 * near-duplicates (the same road split into many OSM ways) are collapsed, and we only auto-pick
 * when one option is clearly the nearest.
 */

import { distanceMeters } from './geo.js'
import { normalise } from './categories.js'

/** @typedef {import('./api.js').Place} Place */

/**
 * @typedef {Object} Disambiguation
 * @property {Place | null} auto      Chosen automatically when the nearest option is unambiguous.
 * @property {Place[]} options        All distinct options, nearest first (with `distance` set).
 */

/** Auto-pick when the nearest candidate is within this distance… */
const AUTO_PICK_MAX_M = 60_000
/** …and the next distinct candidate is at least this many times further away. */
const AUTO_PICK_RATIO = 4

/**
 * @param {Place[]} candidates
 * @param {{ lat: number, lon: number } | null} user
 * @returns {Disambiguation}
 */
export function rankAnchors(candidates, user) {
  if (!candidates.length) return { auto: null, options: [] }

  const withDistance = candidates.map((p) => ({ ...p, distance: user ? distanceMeters(user, p) : undefined }))
  const sorted = user ? [...withDistance].sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0)) : withDistance
  const options = collapseDuplicates(sorted)

  if (options.length === 1) return { auto: options[0], options }
  if (!user) return { auto: null, options }

  const [first, second] = options
  const d1 = first.distance ?? Infinity
  const d2 = second.distance ?? Infinity
  // Two similar names within the same city (e.g. two "Church Street"s 5 km apart) → ask.
  const clearlyNearest = d1 <= AUTO_PICK_MAX_M && d2 >= Math.max(d1 * AUTO_PICK_RATIO, 15_000)
  return { auto: clearlyNearest ? first : null, options }
}

/**
 * A long road is stored as many OSM ways; show it once per locality.
 * Two candidates are duplicates when they have the same name and city and are within 3 km.
 * @param {Place[]} places
 * @returns {Place[]}
 */
export function collapseDuplicates(places) {
  /** @type {Place[]} */
  const kept = []
  for (const p of places) {
    const dup = kept.find(
      (k) =>
        normalise(k.name) === normalise(p.name) &&
        normalise(k.address.city) === normalise(p.address.city) &&
        distanceMeters(k, p) < 3_000,
    )
    if (!dup) kept.push(p)
  }
  return kept
}
