// @ts-check
/**
 * "Which MG Road did you mean?"
 *
 * Benchmark problem (evidence E6): on openstreetmap.org, "pharmacy near MG Road" silently picked
 * MG Roads in West Bengal and Mumbai. Here every candidate is ranked by distance from the user,
 * near-duplicates (the same road split into many OSM ways) are collapsed, and we only auto-pick
 * when one option is clearly the right one.
 */

import { distanceMeters } from './geo.js'
import { normalise } from './categories.js'

/** @typedef {import('./api.js').Place} Place */

/**
 * @typedef {Object} Disambiguation
 * @property {Place | null} auto      Chosen automatically when the nearest option is unambiguous.
 * @property {Place[]} options        All distinct options, best first (with `distance` set).
 */

/** Auto-pick only when the best candidate is within this distance of the user… */
const AUTO_PICK_MAX_M = 60_000
/** Same-named places further apart than this are different places, not segments of one road. */
const SAME_PLACE_MAX_GAP_M = 3_000
/** A rival is "comparably close" when it is within 2× the best distance or best + 10 km. */
const RIVAL_EXTRA_M = 10_000

/**
 * @param {string} text
 * @returns {string[]}
 */
function tokens(text) {
  return normalise(text).split(' ').filter(Boolean)
}

/**
 * @param {Place[]} candidates
 * @param {{ lat: number, lon: number } | null} user
 * @param {string} [text]  What the user typed for the place (e.g. "MG Road").
 * @returns {Disambiguation}
 */
export function rankAnchors(candidates, user, text = '') {
  if (!candidates.length) return { auto: null, options: [] }

  const want = tokens(text)
  const wantNorm = want.join(' ')
  /** @param {Place} p */
  const containsAll = (p) => {
    const have = new Set(tokens(p.name))
    return want.every((t) => have.has(t))
  }
  /** @param {Place} p */
  const isExact = (p) => !!wantNorm && normalise(p.name) === wantNorm

  // Keep candidates whose name contains every word typed ("Anil Kumble Circle" is not "MG Road").
  const relevant = want.length && candidates.some(containsAll) ? candidates.filter(containsAll) : candidates

  const withDistance = relevant.map((p) => ({ ...p, distance: user ? distanceMeters(user, p) : undefined }))
  const sorted = [...withDistance].sort((a, b) => {
    const exact = Number(isExact(b)) - Number(isExact(a))
    if (exact) return exact
    return (a.distance ?? 0) - (b.distance ?? 0)
  })
  const options = collapseDuplicates(sorted)

  if (options.length === 1) return { auto: options[0], options }
  if (!user) return { auto: null, options }

  const best = options[0]
  const bestDist = best.distance ?? Infinity
  if (bestDist > AUTO_PICK_MAX_M) return { auto: null, options }

  // Another place with the *same* name, in a different spot but about as close to the user, makes
  // the choice genuinely ambiguous → ask. Far-away namesakes (other cities) and partial matches
  // ("MG Road Metro Station") never block the auto-pick.
  const rivalLimit = Math.max(bestDist * 2, bestDist + RIVAL_EXTRA_M)
  const conflict = options
    .slice(1)
    .some(
      (o) =>
        normalise(o.name) === normalise(best.name) &&
        distanceMeters(best, o) > SAME_PLACE_MAX_GAP_M &&
        (o.distance ?? Infinity) < rivalLimit,
    )
  return { auto: conflict ? null : best, options }
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
