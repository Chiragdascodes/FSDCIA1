// Beacon service worker — makes the app shell load offline.
// Strategy:
//  - Pages (navigations): network first, so a new deploy shows up on the next load; cache when offline.
//  - Other app files (hashed assets): cache first after the first fetch.
//  - Map tiles / fonts: cache-first with a size cap, so recently viewed areas still render offline.
//  - Search, routing and geocoding APIs: always network (live data must never be stale).
const VERSION = 'beacon-v2'
const SHELL = `${VERSION}-shell`
const TILES = `${VERSION}-tiles`
const MAX_TILES = 400

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(['./', './index.html', './manifest.webmanifest', './favicon.svg'])))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

const isApi = (url) =>
  /nominatim\.openstreetmap\.org|photon\.komoot\.io|overpass|routing\.openstreetmap\.de/.test(url.hostname)
const isTile = (url) => /tiles\.openfreemap\.org|server\.arcgisonline\.com/.test(url.hostname)

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i])
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (isApi(url)) return // network only

  if (isTile(url)) {
    event.respondWith(
      caches.open(TILES).then(async (cache) => {
        const hit = await cache.match(request)
        if (hit) return hit
        const res = await fetch(request)
        if (res.ok) {
          cache.put(request, res.clone())
          trim(TILES, MAX_TILES)
        }
        return res
      }),
    )
    return
  }

  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.open(SHELL).then(async (cache) => {
        if (request.mode === 'navigate') {
          try {
            const res = await fetch(request, { cache: 'no-cache' })
            if (res.ok) cache.put('./index.html', res.clone())
            return res
          } catch {
            return (await cache.match(request, { ignoreSearch: true })) || cache.match('./index.html')
          }
        }
        const hit = await cache.match(request)
        if (hit) return hit
        const res = await fetch(request)
        if (res.ok) cache.put(request, res.clone())
        return res
      }),
    )
  }
})
