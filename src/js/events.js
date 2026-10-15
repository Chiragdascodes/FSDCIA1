// @ts-check
/**
 * Browser event helpers: keyboard shortcuts, connectivity, geolocation, debouncing.
 * Each `on…` function attaches listeners with addEventListener and returns a cleanup function,
 * so React components can register them in an effect and remove them on unmount.
 */

/**
 * @template {(...args: any[]) => void} F
 * @param {F} fn
 * @param {number} wait ms
 * @returns {F & { cancel: () => void }}
 */
export function debounce(fn, wait) {
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let t
  const debounced = /** @type {F & { cancel: () => void }} */ (
    (/** @type {any[]} */ ...args) => {
      clearTimeout(t)
      t = setTimeout(() => fn(...args), wait)
    }
  )
  debounced.cancel = () => clearTimeout(t)
  return debounced
}

/**
 * @typedef {Object} Shortcut
 * @property {string} key            KeyboardEvent.key, e.g. '/', 'Escape', 'l'
 * @property {string} description    Shown in the shortcuts help sheet.
 * @property {(e: KeyboardEvent) => void} run
 * @property {boolean} [allowInInputs]  Fire even while typing (e.g. Escape).
 */

/**
 * Global keyboard shortcuts (keydown on window).
 * Shortcuts are ignored while the user is typing in a field, unless `allowInInputs` is set.
 * @param {Shortcut[]} shortcuts
 * @returns {() => void} cleanup
 */
export function onShortcuts(shortcuts) {
  /** @param {KeyboardEvent} e */
  const handler = (e) => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return
    const target = /** @type {HTMLElement | null} */ (e.target)
    const typing =
      !!target &&
      (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
    const shortcut = shortcuts.find((s) => s.key.toLowerCase() === e.key.toLowerCase())
    if (!shortcut) return
    if (typing && !shortcut.allowInInputs) return
    e.preventDefault()
    shortcut.run(e)
  }
  window.addEventListener('keydown', handler)
  return () => window.removeEventListener('keydown', handler)
}

/**
 * Calls `cb(isOnline)` whenever the browser goes online/offline.
 * @param {(online: boolean) => void} cb
 * @returns {() => void}
 */
export function onConnectivityChange(cb) {
  const up = () => cb(true)
  const down = () => cb(false)
  window.addEventListener('online', up)
  window.addEventListener('offline', down)
  return () => {
    window.removeEventListener('online', up)
    window.removeEventListener('offline', down)
  }
}

/**
 * Calls `cb(dark)` when the system colour scheme changes.
 * @param {(dark: boolean) => void} cb
 * @returns {() => void}
 */
export function onColorSchemeChange(cb) {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  /** @param {MediaQueryListEvent} e */
  const listener = (e) => cb(e.matches)
  mq.addEventListener('change', listener)
  return () => mq.removeEventListener('change', listener)
}

/**
 * @typedef {Object} Position
 * @property {number} lat
 * @property {number} lon
 * @property {number} accuracy   metres
 */

export class LocationError extends Error {
  /**
   * @param {'denied' | 'unavailable' | 'timeout' | 'unsupported' | 'insecure'} reason
   * @param {string} message
   */
  constructor(reason, message) {
    super(message)
    this.name = 'LocationError'
    this.reason = reason
  }
}

/**
 * Promise wrapper around navigator.geolocation with human-friendly errors.
 * @param {{ timeoutMs?: number, highAccuracy?: boolean }} [opts]
 * @returns {Promise<Position>}
 */
export function getCurrentPosition(opts = {}) {
  return new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      reject(new LocationError('insecure', 'Location needs a secure (https) page.'))
      return
    }
    if (!('geolocation' in navigator)) {
      reject(new LocationError('unsupported', "This browser can't share your location."))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED)
          reject(new LocationError('denied', 'Location permission was denied. Using your chosen city instead.'))
        else if (err.code === err.TIMEOUT)
          reject(new LocationError('timeout', 'Finding your location took too long. Using your chosen city instead.'))
        else reject(new LocationError('unavailable', "Your location isn't available right now. Using your chosen city."))
      },
      { enableHighAccuracy: opts.highAccuracy ?? true, timeout: opts.timeoutMs ?? 10000, maximumAge: 60_000 },
    )
  })
}

/**
 * Keeps the user's position updated while they move (e.g. walking to a pharmacy).
 * @param {(p: Position) => void} cb
 * @returns {() => void}
 */
export function watchPosition(cb) {
  if (!('geolocation' in navigator)) return () => {}
  const id = navigator.geolocation.watchPosition(
    (pos) => cb({ lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: pos.coords.accuracy }),
    () => {},
    { enableHighAccuracy: true, maximumAge: 15_000 },
  )
  return () => navigator.geolocation.clearWatch(id)
}

/**
 * Copies text with the async Clipboard API, falling back to a hidden textarea.
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      ta.remove()
      return ok
    } catch {
      return false
    }
  }
}
