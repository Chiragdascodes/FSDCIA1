// @ts-check
/**
 * Turns what a person types into a structured search.
 *
 * Benchmark problem (evidence E2): on openstreetmap.org, "pharmacy near me" is sent to the geocoder
 * as plain text, so "me" is ignored and results come from Italy. Here we understand the intent:
 *
 *   "pharmacy near me"            → { category: pharmacy, anchor: { type: 'me' } }
 *   "open atm near MG Road"       → { category: atm, anchor: { type: 'place', text: 'MG Road' }, filters.openNow }
 *   "medical shop"                → { category: pharmacy, anchor: { type: 'implicit' } }   (around you)
 *   "Starbucks near Church Street"→ { what: 'Starbucks', anchor: { type: 'place', text: 'Church Street' } }
 *   "MG Road"                     → { what: 'MG Road', anchor: { type: 'none' } }           (a place lookup)
 */

import { findCategory, normalise } from './categories.js'

/**
 * @typedef {'me' | 'place' | 'implicit' | 'none'} AnchorType
 *
 * @typedef {Object} ParsedQuery
 * @property {string} raw                 Original text, trimmed.
 * @property {string} what                The thing being looked for (original casing), may be ''.
 * @property {import('./categories.js').Category | null} category
 * @property {{ type: AnchorType, text: string }} anchor
 * @property {{ openNow: boolean, allDay: boolean, wheelchair: boolean }} filters
 * @property {'category' | 'name-near' | 'place' | 'empty'} intent
 */

const ME_WORDS = '(?:me|here|my location|current location|my place|my area|this area|us)'
const SEPARATORS = ['near by', 'nearby', 'near', 'around', 'close to', 'next to', 'beside', 'in', 'at', 'on', 'by']

const RE_NEAR_ME = new RegExp(`\\b(?:near\\s*by|nearby|near|around|close to|next to|beside)\\s+${ME_WORDS}\\b`, 'i')
const RE_TRAILING_NEARBY = /\b(?:near\s*by|nearby|around(?:\s+here)?|close\s*by|near)\s*$/i
const RE_LEADING_NEARBY = /^(?:nearby|near\s*by|closest|nearest)\s+/i
const RE_OPEN_NOW = /\b(?:open\s+now|opened\s+now|currently\s+open|open)\b/i
const RE_ALL_DAY = /\b(?:24\s*\/\s*7|24\s*x\s*7|24\s*hours?|24\s*hrs?|all\s+night|late\s+night)\b/i
const RE_WHEELCHAIR = /\b(?:wheelchair(?:\s+accessible)?|accessible|step[-\s]?free)\b/i
const RE_FILLER = /^(?:please\s+)?(?:find|show|search|get|locate|where\s+is|where's|wheres|where\s+are|i\s+need|need|looking\s+for|any|the|a|an|some)\s+/i

/**
 * @param {string} input
 * @returns {ParsedQuery}
 */
export function parseQuery(input) {
  const raw = String(input ?? '').replace(/\s+/g, ' ').trim()
  /** @type {ParsedQuery['filters']} */
  const filters = { openNow: false, allDay: false, wheelchair: false }

  if (!raw) {
    return { raw, what: '', category: null, anchor: { type: 'none', text: '' }, filters, intent: 'empty' }
  }

  let text = raw

  // 1. Pull out filters ("open now", "24/7", "wheelchair accessible").
  if (RE_ALL_DAY.test(text)) {
    filters.allDay = true
    text = text.replace(RE_ALL_DAY, ' ')
  }
  if (RE_OPEN_NOW.test(text)) {
    filters.openNow = true
    text = text.replace(RE_OPEN_NOW, ' ')
  }
  if (RE_WHEELCHAIR.test(text)) {
    filters.wheelchair = true
    text = text.replace(RE_WHEELCHAIR, ' ')
  }
  text = tidy(text)

  // 2. Strip polite/filler words at the start ("find the nearest …").
  let previous
  do {
    previous = text
    text = tidy(text.replace(RE_FILLER, ''))
  } while (text !== previous)

  /** @type {{ type: AnchorType, text: string }} */
  let anchor = { type: 'none', text: '' }
  let what = text

  // 3. "… near me" / "nearby …" / "… nearby".
  if (RE_NEAR_ME.test(text)) {
    anchor = { type: 'me', text: '' }
    what = tidy(text.replace(RE_NEAR_ME, ' '))
  } else if (RE_LEADING_NEARBY.test(text)) {
    anchor = { type: 'me', text: '' }
    what = tidy(text.replace(RE_LEADING_NEARBY, ''))
  } else if (RE_TRAILING_NEARBY.test(text)) {
    anchor = { type: 'me', text: '' }
    what = tidy(text.replace(RE_TRAILING_NEARBY, ''))
  } else {
    // 4. "<what> near <place>" — split on the first separator that has text on both sides.
    const split = splitOnSeparator(text)
    if (split) {
      what = split.what
      anchor = { type: 'place', text: split.place }
    }
  }

  // "nearest pharmacy" style leading words left over after splitting.
  what = tidy(what.replace(RE_LEADING_NEARBY, ''))

  const category = findCategory(what)

  // A category with no explicit anchor means "around me" (e.g. just "pharmacy").
  if (category && anchor.type === 'none') anchor = { type: 'implicit', text: '' }

  /** @type {ParsedQuery['intent']} */
  let intent
  if (category) intent = 'category'
  else if (anchor.type === 'place' || anchor.type === 'me') intent = what ? 'name-near' : anchor.type === 'place' ? 'place' : 'empty'
  else intent = what ? 'place' : 'empty'

  // "near MG Road" with nothing before it is really just a place lookup.
  if (intent === 'place' && anchor.type === 'place' && !what) {
    what = anchor.text
    anchor = { type: 'none', text: '' }
  }

  return { raw, what, category, anchor, filters, intent }
}

/**
 * @param {string} text
 * @returns {{ what: string, place: string } | null}
 */
function splitOnSeparator(text) {
  const lower = ` ${normalise(text)} `
  let best = null
  for (const sep of SEPARATORS) {
    const idx = lower.indexOf(` ${sep} `)
    if (idx <= 0) continue
    if (best === null || idx < best.idx) best = { idx, sep }
  }
  if (!best) return null

  // Map the index in the normalised string back onto the original text by counting words.
  const wordsBefore = lower.slice(0, best.idx).trim().split(' ').filter(Boolean).length
  const sepWords = best.sep.split(' ').length
  const original = text.split(' ')
  const what = tidy(original.slice(0, wordsBefore).join(' '))
  const place = tidy(original.slice(wordsBefore + sepWords).join(' '))
  if (!what || !place) return null
  // Only treat it as "X near Y" when X looks like a thing to find (category or short name).
  if (!findCategory(what) && what.split(' ').length > 4) return null
  return { what, place }
}

/**
 * @param {string} s
 * @returns {string}
 */
function tidy(s) {
  return s.replace(/\s+/g, ' ').replace(/^[\s,.-]+|[\s,.-]+$/g, '').trim()
}

/**
 * Human-readable summary of a parsed query, used for headings and screen readers.
 * @param {ParsedQuery} q
 * @param {string} [anchorLabel]
 * @returns {string}
 */
export function describeQuery(q, anchorLabel) {
  const subject = q.category ? q.category.plural : q.what || 'Places'
  const where =
    q.anchor.type === 'place' ? ` near ${anchorLabel || q.anchor.text}` : q.anchor.type === 'none' ? '' : ' near you'
  const extras = [q.filters.openNow && 'open now', q.filters.allDay && '24/7', q.filters.wheelchair && 'wheelchair accessible']
    .filter(Boolean)
    .join(', ')
  return `${subject}${where}${extras ? ` · ${extras}` : ''}`
}
