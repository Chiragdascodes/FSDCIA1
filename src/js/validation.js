// @ts-check
/**
 * Form validation rules and messages (plain JavaScript, framework-independent).
 *
 * Used by:
 *  - the search form          (validateSearch)
 *  - the "Report a problem" form (validateReport)
 *  - the settings form        (validateSettings)
 *
 * Each validator returns `{ valid, errors }` where `errors` maps a field name to a message, so the
 * UI can mark the field with aria-invalid and show the message right under it.
 */

import { isValidLatLon } from './geo.js'

/**
 * @typedef {Record<string, string>} FieldErrors
 * @typedef {{ valid: boolean, errors: FieldErrors }} ValidationResult
 */

export const LIMITS = {
  searchMin: 2,
  searchMax: 120,
  placeNameMin: 2,
  placeNameMax: 80,
  detailsMin: 15,
  detailsMax: 500,
  radiusMin: 200,
  radiusMax: 10_000,
}

export const REPORT_TYPES = [
  { value: 'wrong-hours', label: 'Opening hours are wrong' },
  { value: 'closed', label: 'Place has closed permanently' },
  { value: 'missing', label: 'A place is missing from the map' },
  { value: 'wrong-location', label: 'Pin is in the wrong location' },
  { value: 'wrong-details', label: 'Phone / website / name is wrong' },
  { value: 'other', label: 'Something else' },
]

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const PHONE_RE = /^\+?[0-9][0-9\s-]{6,16}[0-9]$/
// Repeated characters like "aaaaaaaaaaaaaaa" or "..............." are not a real description.
const LOW_EFFORT_RE = /^(.)\1{9,}$/

/**
 * @param {string} query
 * @returns {ValidationResult}
 */
export function validateSearch(query) {
  const q = String(query ?? '').trim()
  /** @type {FieldErrors} */
  const errors = {}
  if (!q) errors.query = 'Type what you need, e.g. "pharmacy near me".'
  else if (q.length < LIMITS.searchMin) errors.query = `Type at least ${LIMITS.searchMin} characters.`
  else if (q.length > LIMITS.searchMax) errors.query = `Keep it under ${LIMITS.searchMax} characters.`
  else if (!/[\p{L}\p{N}]/u.test(q)) errors.query = 'Use letters or numbers in your search.'
  return { valid: Object.keys(errors).length === 0, errors }
}

/**
 * @typedef {Object} ReportValues
 * @property {string} type
 * @property {string} placeName
 * @property {string} details
 * @property {string} contact           optional email or phone
 * @property {number | null} lat
 * @property {number | null} lon
 * @property {boolean} consent
 */

/**
 * @param {ReportValues} v
 * @returns {ValidationResult}
 */
export function validateReport(v) {
  /** @type {FieldErrors} */
  const errors = {}

  if (!REPORT_TYPES.some((t) => t.value === v.type)) errors.type = 'Choose what is wrong.'

  const name = String(v.placeName ?? '').trim()
  if (!name) errors.placeName = 'Enter the place name.'
  else if (name.length < LIMITS.placeNameMin) errors.placeName = `At least ${LIMITS.placeNameMin} characters.`
  else if (name.length > LIMITS.placeNameMax) errors.placeName = `Keep it under ${LIMITS.placeNameMax} characters.`

  const details = String(v.details ?? '').trim()
  if (!details) errors.details = 'Describe the problem so mappers can fix it.'
  else if (details.length < LIMITS.detailsMin)
    errors.details = `Add a little more detail (${LIMITS.detailsMin - details.length} more characters).`
  else if (details.length > LIMITS.detailsMax) errors.details = `Keep it under ${LIMITS.detailsMax} characters.`
  else if (LOW_EFFORT_RE.test(details.replace(/\s/g, ''))) errors.details = 'Please describe the problem in words.'

  const contact = String(v.contact ?? '').trim()
  if (contact && !EMAIL_RE.test(contact) && !PHONE_RE.test(contact)) {
    errors.contact = 'Enter a valid email or phone number, or leave it empty.'
  }

  if (!isValidLatLon(v.lat, v.lon)) errors.location = 'Set the location on the map.'

  if (!v.consent) errors.consent = 'Please confirm you understand how this report is shared.'

  return { valid: Object.keys(errors).length === 0, errors }
}

/**
 * @typedef {Object} SettingsValues
 * @property {number} radius
 * @property {string} units
 * @property {string} mode
 * @property {string} fallbackCity
 */

/**
 * @param {SettingsValues} v
 * @param {string[]} cityIds
 * @returns {ValidationResult}
 */
export function validateSettings(v, cityIds) {
  /** @type {FieldErrors} */
  const errors = {}
  const r = Number(v.radius)
  if (!Number.isFinite(r)) errors.radius = 'Radius must be a number.'
  else if (r < LIMITS.radiusMin || r > LIMITS.radiusMax)
    errors.radius = `Choose between ${LIMITS.radiusMin / 1000} km and ${LIMITS.radiusMax / 1000} km.`
  if (!['metric', 'imperial'].includes(v.units)) errors.units = 'Choose metric or imperial.'
  if (!['foot', 'bike', 'car'].includes(v.mode)) errors.mode = 'Choose a travel mode.'
  if (!cityIds.includes(v.fallbackCity)) errors.fallbackCity = 'Choose a city from the list.'
  return { valid: Object.keys(errors).length === 0, errors }
}
