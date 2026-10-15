// @ts-check
/**
 * Small persistence layer over localStorage (saved places, recent searches, settings, reports).
 * Every read/write is wrapped in try/catch: storage can be full, disabled or unavailable
 * (private windows), and the app must keep working without it.
 */

const PREFIX = 'beacon:'

export const CITIES = [
  { id: 'bengaluru', name: 'Bengaluru', lat: 12.9716, lon: 77.5946 },
  { id: 'mumbai', name: 'Mumbai', lat: 19.076, lon: 72.8777 },
  { id: 'delhi', name: 'New Delhi', lat: 28.6139, lon: 77.209 },
  { id: 'chennai', name: 'Chennai', lat: 13.0827, lon: 80.2707 },
  { id: 'hyderabad', name: 'Hyderabad', lat: 17.385, lon: 78.4867 },
  { id: 'kolkata', name: 'Kolkata', lat: 22.5726, lon: 88.3639 },
  { id: 'pune', name: 'Pune', lat: 18.5204, lon: 73.8567 },
  { id: 'kochi', name: 'Kochi', lat: 9.9312, lon: 76.2673 },
  { id: 'dhaka', name: 'Dhaka', lat: 23.8103, lon: 90.4125 },
]

/**
 * @typedef {Object} Settings
 * @property {number} radius              metres
 * @property {'metric' | 'imperial'} units
 * @property {'foot' | 'bike' | 'car'} mode
 * @property {string} fallbackCity        id from CITIES
 * @property {'auto' | 'light' | 'dark'} theme
 * @property {'auto' | 'light' | 'dark' | 'muted' | 'satellite'} mapStyle
 * @property {boolean} globe              Show the globe when zoomed out.
 */

/** @type {Settings} */
export const DEFAULT_SETTINGS = {
  radius: 1500,
  units: 'metric',
  mode: 'foot',
  fallbackCity: 'bengaluru',
  theme: 'auto',
  mapStyle: 'auto',
  globe: true,
}

/**
 * @template T
 * @param {string} key
 * @param {T} fallback
 * @returns {T}
 */
export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw === null ? fallback : JSON.parse(raw)
  } catch {
    return fallback
  }
}

/**
 * @param {string} key
 * @param {unknown} value
 * @returns {boolean} whether it was saved
 */
export function save(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

/** @returns {Settings} */
export function loadSettings() {
  return { ...DEFAULT_SETTINGS, ...load('settings', {}) }
}

/**
 * @param {Settings} s
 */
export function saveSettings(s) {
  return save('settings', s)
}

/**
 * Recent searches, newest first, max 8, no duplicates (case-insensitive).
 * @returns {string[]}
 */
export function loadRecents() {
  const list = load('recents', /** @type {unknown[]} */ ([]))
  return Array.isArray(list) ? list.filter((s) => typeof s === 'string').slice(0, 8) : []
}

/**
 * @param {string} query
 * @returns {string[]}
 */
export function addRecent(query) {
  const q = query.trim()
  if (!q) return loadRecents()
  const next = [q, ...loadRecents().filter((r) => r.toLowerCase() !== q.toLowerCase())].slice(0, 8)
  save('recents', next)
  return next
}

export function clearRecents() {
  save('recents', [])
}

/**
 * @typedef {import('./api.js').Place & { savedAt: number }} SavedPlace
 */

/** @returns {SavedPlace[]} */
export function loadSaved() {
  const list = load('saved', /** @type {SavedPlace[]} */ ([]))
  return Array.isArray(list) ? list : []
}

/**
 * Adds or removes a place from Saved.
 * @param {import('./api.js').Place} place
 * @returns {SavedPlace[]}
 */
export function toggleSaved(place) {
  const list = loadSaved()
  const exists = list.some((p) => p.id === place.id)
  const { distance: _distance, ...rest } = place
  const next = exists ? list.filter((p) => p.id !== place.id) : [{ ...rest, savedAt: Date.now() }, ...list].slice(0, 50)
  save('saved', next)
  return next
}

/**
 * @typedef {import('./validation.js').ReportValues & { id: string, createdAt: number, placeId: string | null }} Report
 */

/** @returns {Report[]} */
export function loadReports() {
  const list = load('reports', /** @type {Report[]} */ ([]))
  return Array.isArray(list) ? list : []
}

/**
 * @param {Omit<Report, 'id' | 'createdAt'>} report
 * @returns {Report}
 */
export function addReport(report) {
  const full = { ...report, id: `r-${Date.now().toString(36)}`, createdAt: Date.now() }
  save('reports', [full, ...loadReports()].slice(0, 100))
  return full
}
