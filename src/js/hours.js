// @ts-check
/**
 * Opening hours, in plain language.
 *
 * Benchmark problem (evidence E3): OSM shows the raw tag `PH,Mo-Su 08:00-23:30` and never says whether
 * a place is open right now. We parse the tag with the `opening_hours` library (the reference parser
 * used across the OSM ecosystem) and turn it into "Open · closes 23:30" plus a weekly table.
 */

import OpeningHours from 'opening_hours'

/**
 * @typedef {'open' | 'closed' | 'unknown'} OpenState
 *
 * @typedef {Object} OpenStatus
 * @property {OpenState} state
 * @property {string} label           Short badge text, e.g. "Open · closes 23:30".
 * @property {boolean} closingSoon    Closes within 30 minutes.
 * @property {boolean} allDay         Open 24/7.
 * @property {Date | null} nextChange When the state flips next.
 * @property {string | null} comment  Comment from the tag (e.g. "by appointment").
 *
 * @typedef {Object} DaySchedule
 * @property {string} day      "Mon"
 * @property {Date} date
 * @property {boolean} isToday
 * @property {string[]} ranges "08:00–23:30"
 */

const SOON_MS = 30 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

/** @type {Map<string, any>} */
const cache = new Map()

/**
 * Parse once and cache; returns null when the value is missing or invalid.
 * Holiday rules (PH) are evaluated without a country, because the library has no
 * public-holiday data for India; "PH" rules are simply ignored instead of crashing.
 * @param {string | undefined | null} value
 */
function parse(value) {
  const v = String(value ?? '').trim()
  if (!v) return null
  if (cache.has(v)) return cache.get(v)
  let parsed = null
  try {
    parsed = new OpeningHours(v, null, 0) // mode 0 = time ranges only (no points in time)
  } catch {
    parsed = null
  }
  cache.set(v, parsed)
  return parsed
}

/**
 * @param {string | undefined | null} value  raw `opening_hours` tag
 * @param {Date} [now]
 * @returns {OpenStatus}
 */
export function getOpenStatus(value, now = new Date()) {
  const oh = parse(value)
  if (!oh) {
    return { state: 'unknown', label: 'Hours unknown', closingSoon: false, allDay: false, nextChange: null, comment: null }
  }
  try {
    const raw = oh.getStateString(now, true)
    /** @type {OpenState} */
    const state = raw === 'open' ? 'open' : raw === 'closed' ? 'closed' : 'unknown'
    const next = oh.getNextChange(now, new Date(now.getTime() + 8 * DAY_MS)) ?? null
    const comment = oh.getComment(now) ?? null
    const allDay = state === 'open' && !next

    let label
    let closingSoon = false
    if (allDay) label = 'Open 24 hours'
    else if (state === 'open') {
      closingSoon = !!next && next.getTime() - now.getTime() <= SOON_MS
      label = closingSoon ? `Closes soon · ${formatTime(next)}` : `Open · closes ${formatTime(next)}`
    } else if (state === 'closed') {
      label = next ? `Closed · opens ${formatWhen(next, now)}` : 'Closed'
    } else {
      label = comment ? `Check hours · ${comment}` : 'Hours uncertain'
    }
    return { state, label, closingSoon, allDay, nextChange: next, comment }
  } catch {
    return { state: 'unknown', label: 'Hours unknown', closingSoon: false, allDay: false, nextChange: null, comment: null }
  }
}

/**
 * Seven-day schedule starting today.
 * @param {string | undefined | null} value
 * @param {Date} [now]
 * @returns {DaySchedule[] | null}
 */
export function getWeekSchedule(value, now = new Date()) {
  const oh = parse(value)
  if (!oh) return null
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  /** @type {DaySchedule[]} */
  const days = []
  try {
    for (let i = 0; i < 7; i++) {
      const from = new Date(start.getTime() + i * DAY_MS)
      const to = new Date(from.getTime() + DAY_MS)
      const intervals = oh.getOpenIntervals(from, to)
      const ranges = intervals.map((/** @type {[Date, Date, boolean, string | undefined]} */ iv) => {
        const [a, b] = iv
        const fullDay = a.getTime() <= from.getTime() && b.getTime() >= to.getTime()
        if (fullDay) return 'Open 24 hours'
        const end = b.getTime() >= to.getTime() ? '24:00' : formatTime(b)
        return `${formatTime(a)}–${end}`
      })
      days.push({
        day: from.toLocaleDateString('en-GB', { weekday: 'short' }),
        date: from,
        isToday: i === 0,
        ranges,
      })
    }
    return days
  } catch {
    return null
  }
}

/**
 * @param {string | undefined | null} value
 * @returns {boolean}
 */
export function isValidHours(value) {
  return parse(value) !== null
}

/**
 * @param {Date | null} d
 * @returns {string}
 */
export function formatTime(d) {
  if (!d) return ''
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/**
 * "12:30", "tomorrow 09:00", "Mon 09:00".
 * @param {Date} d
 * @param {Date} now
 */
function formatWhen(d, now) {
  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)
  const dayDiff = Math.floor((d.getTime() - startOfToday.getTime()) / DAY_MS)
  if (dayDiff <= 0) return formatTime(d)
  if (dayDiff === 1) return `tomorrow ${formatTime(d)}`
  return `${d.toLocaleDateString('en-GB', { weekday: 'short' })} ${formatTime(d)}`
}
