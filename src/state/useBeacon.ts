import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import * as api from '../js/api.js'
import { getCategory } from '../js/categories.js'
import { rankAnchors } from '../js/disambiguate.js'
import { getCurrentPosition, LocationError, onConnectivityChange, watchPosition } from '../js/events.js'
import { distanceMeters } from '../js/geo.js'
import { getOpenStatus } from '../js/hours.js'
import { parseQuery } from '../js/queryParser.js'
import {
  addRecent,
  CITIES,
  clearRecents as clearRecentsStore,
  loadRecents,
  loadReports,
  loadSaved,
  loadSettings,
  saveSettings,
  toggleSaved as toggleSavedStore,
} from '../js/storage.js'
import { validateSearch } from '../js/validation.js'
import type { BeaconMapHandle } from '../map/BeaconMap'
import type { Category, LatLon, ParsedQuery, Place, Route, SavedPlace, SearchAnchor, Settings, TravelMode, View } from '../types'

export type SearchStatus = 'idle' | 'locating' | 'loading' | 'done' | 'error'
export type EnrichStatus = 'idle' | 'loading' | 'done' | 'failed'
export type LocStatus = 'idle' | 'locating' | 'granted' | 'fallback'

export interface Filters {
  openNow: boolean
  allDay: boolean
  wheelchair: boolean
  includeUnknown: boolean
}

export interface Toast {
  id: number
  text: string
  tone: 'info' | 'success' | 'warning' | 'error'
  action?: { label: string; run: () => void }
}

const NO_FILTERS: Filters = { openNow: false, allDay: false, wheelchair: false, includeUnknown: true }

export function useBeacon(mapRef: RefObject<BeaconMapHandle | null>) {
  // ---- persistent state ----------------------------------------------------
  const [settings, setSettingsState] = useState<Settings>(() => loadSettings() as Settings)
  const [saved, setSaved] = useState<SavedPlace[]>(() => loadSaved() as SavedPlace[])
  const [recents, setRecents] = useState<string[]>(() => loadRecents())

  // ---- session state ------------------------------------------------------
  const [online, setOnline] = useState(() => navigator.onLine)
  const [user, setUser] = useState<{ lat: number; lon: number; accuracy: number } | null>(null)
  const [locStatus, setLocStatus] = useState<LocStatus>('idle')
  const [query, setQuery] = useState('')
  const [queryError, setQueryError] = useState<string | null>(null)
  const [parsed, setParsed] = useState<ParsedQuery | null>(null)
  const [anchor, setAnchor] = useState<SearchAnchor | null>(null)
  const [anchorOptions, setAnchorOptions] = useState<Place[]>([])
  const [category, setCategory] = useState<Category | null>(null)
  const [radius, setRadius] = useState<number>(settings.radius)
  const [results, setResults] = useState<Place[]>([])
  const [status, setStatus] = useState<SearchStatus>('idle')
  const [enrich, setEnrich] = useState<EnrichStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  const [views, setViews] = useState<View[]>([{ name: 'home' }])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [extraPlaces, setExtraPlaces] = useState<Record<string, Place>>({})
  const [route, setRoute] = useState<Route | null>(null)
  const [routeStatus, setRouteStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [routeError, setRouteError] = useState<string | null>(null)
  const [mode, setMode] = useState<TravelMode>(settings.mode)
  const [routeReversed, setRouteReversed] = useState(false)
  const [reports, setReports] = useState(() => loadReports())
  const [toasts, setToasts] = useState<Toast[]>([])
  const [searchAreaAt, setSearchAreaAt] = useState<LatLon | null>(null)
  const [pickLocation, setPickLocation] = useState<LatLon | null>(null)

  const searchId = useRef(0)
  const controller = useRef<AbortController | null>(null)
  const routeController = useRef<AbortController | null>(null)
  const pendingQuery = useRef<ParsedQuery | null>(null)
  const userRef = useRef(user)
  userRef.current = user

  const view = views[views.length - 1]
  const fallbackCity = CITIES.find((c) => c.id === settings.fallbackCity) ?? CITIES[0]

  // ---- toasts ---------------------------------------------------------------
  const toast = useCallback((text: string, tone: Toast['tone'] = 'info', action?: Toast['action']) => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t.slice(-2), { id, text, tone, action }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), action ? 7000 : 4200)
  }, [])
  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  // ---- settings -------------------------------------------------------------
  const setSettings = useCallback((next: Settings) => {
    setSettingsState(next)
    saveSettings(next)
  }, [])
  const updateSetting = useCallback(
    <K extends keyof Settings>(key: K, value: Settings[K]) => {
      setSettingsState((s) => {
        const next = { ...s, [key]: value }
        saveSettings(next)
        return next
      })
    },
    [],
  )

  // ---- connectivity (online/offline events) --------------------------------
  useEffect(
    () =>
      onConnectivityChange((isOnline) => {
        setOnline(isOnline)
        toast(isOnline ? 'Back online.' : "You're offline — saved places still work.", isOnline ? 'success' : 'warning')
      }),
    [toast],
  )

  // Keep the blue dot following the user once we have permission.
  useEffect(() => {
    if (locStatus !== 'granted') return
    return watchPosition((p) => setUser(p))
  }, [locStatus])

  // ---- view stack -----------------------------------------------------------
  const push = useCallback((v: View) => setViews((s) => [...s.filter((x) => x.name !== v.name), v]), [])
  const back = useCallback(() => {
    setViews((s) => (s.length > 1 ? s.slice(0, -1) : s))
  }, [])
  /** Bottom-tab navigation: Saved / Reports / You open on top of the Explore stack. */
  const showTab = useCallback((tab: 'explore' | 'saved' | 'reports' | 'settings') => {
    const TAB_VIEWS = ['saved', 'reports', 'settings', 'shortcuts']
    setViews((s) => {
      const explore = s.filter((v) => !TAB_VIEWS.includes(v.name))
      const base = explore.length ? explore : [{ name: 'home' } as View]
      return tab === 'explore' ? base : [...base, { name: tab } as View]
    })
  }, [])

  const goHome = useCallback(() => {
    controller.current?.abort()
    setViews([{ name: 'home' }])
    setSelectedId(null)
    setRoute(null)
    setResults([])
    setStatus('idle')
    setEnrich('idle')
    setCategory(null)
    setParsed(null)
    setAnchorOptions([])
    setSearchAreaAt(null)
    setPickLocation(null)
  }, [])

  // ---- places lookup --------------------------------------------------------
  const placesById = useMemo(() => {
    const m = new Map<string, Place>()
    for (const p of saved) m.set(p.id, p)
    for (const p of Object.values(extraPlaces)) m.set(p.id, p)
    for (const p of results) m.set(p.id, p)
    for (const p of anchorOptions) if (!m.has(p.id)) m.set(p.id, p)
    return m
  }, [saved, extraPlaces, results, anchorOptions])

  const remember = useCallback((p: Place) => setExtraPlaces((x) => ({ ...x, [p.id]: p })), [])

  // ---- location -------------------------------------------------------------
  /** Gets the user's position; falls back to the chosen city with a clear message. */
  const locate = useCallback(
    async (opts: { fly?: boolean; quiet?: boolean } = {}): Promise<SearchAnchor> => {
      setLocStatus('locating')
      try {
        const pos = await getCurrentPosition({ timeoutMs: 9000 })
        setUser(pos)
        setLocStatus('granted')
        if (opts.fly) mapRef.current?.flyTo(pos.lat, pos.lon, 15.5, { duration: 2600 })
        return { lat: pos.lat, lon: pos.lon, kind: 'me', label: 'your location' }
      } catch (err) {
        setLocStatus('fallback')
        const message = err instanceof LocationError ? err.message : 'Location unavailable.'
        if (!opts.quiet) toast(`${message} (${fallbackCity.name})`, 'warning')
        if (opts.fly) mapRef.current?.flyTo(fallbackCity.lat, fallbackCity.lon, 13.5, { duration: 2600 })
        return { lat: fallbackCity.lat, lon: fallbackCity.lon, kind: 'city', label: fallbackCity.name }
      }
    },
    [fallbackCity, mapRef, toast],
  )

  /** Best known reference point: GPS → current anchor → fallback city. */
  const basePoint = useCallback((): SearchAnchor => {
    const u = userRef.current
    if (u) return { lat: u.lat, lon: u.lon, kind: 'me', label: 'your location' }
    return { lat: fallbackCity.lat, lon: fallbackCity.lon, kind: 'city', label: fallbackCity.name }
  }, [fallbackCity])

  // ---- searching ------------------------------------------------------------
  const newSearch = () => {
    controller.current?.abort()
    controller.current = new AbortController()
    searchId.current += 1
    return { id: searchId.current, signal: controller.current.signal }
  }
  const isCurrent = (id: number) => id === searchId.current

  const fitResults = useCallback(
    (center: LatLon, places: Place[]) => {
      const nearest = [...places].sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0)).slice(0, 8)
      mapRef.current?.fitTo([center, ...nearest], 16.5)
    },
    [mapRef],
  )

  /** Fast Nominatim pass shown immediately, Overpass details merged in when they arrive. */
  const runCategory = useCallback(
    async (cat: Category, at: SearchAnchor, r: number) => {
      const { id, signal } = newSearch()
      setCategory(cat)
      setAnchor(at)
      setRadius(r)
      setResults([])
      setError(null)
      setStatus('loading')
      setEnrich('loading')
      setSelectedId(null)
      setRoute(null)
      setSearchAreaAt(null)
      setViews((s) => [...s.filter((v) => v.name === 'home'), { name: 'results' }])
      mapRef.current?.flyTo(at.lat, at.lon, r > 3000 ? 13 : r > 1500 ? 14 : 15, { duration: 1400 })

      let fast: Place[] = []
      let fastError: unknown = null
      let firstFit = true

      const fastTask = api
        .searchCategoryFast(cat, at, r, signal)
        .then((places) => {
          if (!isCurrent(id)) return
          fast = places
          if (places.length) {
            setResults(places)
            setStatus('done')
            fitResults(at, places)
            firstFit = false
          }
        })
        .catch((e) => {
          fastError = e
        })

      const richTask = api
        .searchCategoryRich(cat, at, r, signal)
        .then(async (rich) => {
          await fastTask
          if (!isCurrent(id)) return
          const merged = api.mergePlaces(fast, rich)
          setResults(merged)
          setEnrich('done')
          setStatus('done')
          if (firstFit && merged.length) fitResults(at, merged)
        })
        .catch(async (e) => {
          await fastTask
          if (!isCurrent(id) || (e instanceof api.ApiError && e.kind === 'aborted')) return
          setEnrich('failed')
          if (fast.length) return setStatus('done')
          if (fastError) {
            setError(api.describeError(fastError))
            setStatus('error')
          } else {
            setStatus('done') // genuinely nothing nearby → empty state
          }
        })

      await Promise.allSettled([fastTask, richTask])
    },
    [fitResults, mapRef],
  )

  const runNameNear = useCallback(
    async (name: string, at: SearchAnchor, r: number) => {
      const { id, signal } = newSearch()
      setCategory(null)
      setAnchor(at)
      setRadius(r)
      setResults([])
      setError(null)
      setStatus('loading')
      setEnrich('idle')
      setViews((s) => [...s.filter((v) => v.name === 'home'), { name: 'results' }])
      try {
        const places = await api.searchNameNear(name, at, r, signal)
        if (!isCurrent(id)) return
        setResults(places)
        setStatus('done')
        if (places.length) fitResults(at, places)
      } catch (e) {
        if (!isCurrent(id) || (e instanceof api.ApiError && e.kind === 'aborted')) return
        setError(api.describeError(e))
        setStatus('error')
      }
    },
    [fitResults],
  )

  const runPlaceLookup = useCallback(
    async (text: string) => {
      const { id, signal } = newSearch()
      const base = basePoint()
      setCategory(null)
      setAnchor(null)
      setResults([])
      setError(null)
      setStatus('loading')
      setEnrich('idle')
      setViews((s) => [...s.filter((v) => v.name === 'home'), { name: 'results' }])
      try {
        const found = await api.suggest(text, { near: base, limit: 10, signal })
        if (!isCurrent(id)) return
        const ranked = found
          .map((p) => ({ ...p, distance: distanceMeters(base, p) }))
          .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0))
        setResults(ranked)
        setStatus('done')
        if (ranked.length === 1) {
          setSelectedId(ranked[0].id)
          push({ name: 'place', id: ranked[0].id })
          mapRef.current?.flyTo(ranked[0].lat, ranked[0].lon, 16)
        } else if (ranked.length) {
          mapRef.current?.flyTo(ranked[0].lat, ranked[0].lon, 14)
        }
      } catch (e) {
        if (!isCurrent(id) || (e instanceof api.ApiError && e.kind === 'aborted')) return
        setError(api.describeError(e))
        setStatus('error')
      }
    },
    [basePoint, mapRef, push],
  )

  /** Continue a "X near <place>" search once the place is known. */
  const continueWithAnchor = useCallback(
    (q: ParsedQuery, place: Place) => {
      const at: SearchAnchor = {
        lat: place.lat,
        lon: place.lon,
        kind: 'place',
        label: [place.name, place.address.area || place.address.city].filter(Boolean).join(', '),
      }
      if (q.category) void runCategory(q.category as Category, at, radius)
      else void runNameNear(q.what, at, Math.max(radius, 3000))
    },
    [radius, runCategory, runNameNear],
  )

  /** Main entry point: called on form submit, chip tap, recent tap, or shared link. */
  const search = useCallback(
    async (text: string) => {
      const check = validateSearch(text)
      if (!check.valid) {
        setQueryError(check.errors.query)
        return false
      }
      setQueryError(null)
      setQuery(text)
      setRecents(addRecent(text))

      const q = parseQuery(text) as ParsedQuery
      setParsed(q)
      setFilters((f) => ({
        ...f,
        openNow: q.filters.openNow,
        allDay: q.filters.allDay,
        wheelchair: q.filters.wheelchair,
        includeUnknown: true,
      }))
      setAnchorOptions([])
      history.replaceState(null, '', `#q=${encodeURIComponent(text)}`)

      if (q.intent === 'empty') {
        setQueryError('What are you looking for? Try "pharmacy near me".')
        return false
      }
      if (q.intent === 'place') {
        void runPlaceLookup(q.what)
        return true
      }

      // Resolve where to search.
      if (q.anchor.type === 'me' || q.anchor.type === 'implicit') {
        let at: SearchAnchor
        if (userRef.current) at = basePoint()
        else {
          setStatus('locating')
          setViews((s) => [...s.filter((v) => v.name === 'home'), { name: 'results' }])
          at = await locate({ quiet: false })
        }
        if (q.category) void runCategory(q.category as Category, at, radius)
        else void runNameNear(q.what, at, Math.max(radius, 3000))
        return true
      }

      // "near <place>": find candidates and disambiguate (fixes benchmark E6).
      const { id, signal } = newSearch()
      setStatus('loading')
      setResults([])
      setError(null)
      setViews((s) => [...s.filter((v) => v.name === 'home'), { name: 'results' }])
      try {
        const base = userRef.current ? basePoint() : await locate({ quiet: true })
        const candidates = await api.suggest(q.anchor.text, { near: base, limit: 12, signal })
        if (!isCurrent(id)) return true
        const { auto, options } = rankAnchors(candidates, base, q.anchor.text)
        setAnchorOptions(options)
        if (!options.length) {
          setError(`Couldn't find "${q.anchor.text}". Check the spelling or try a nearby landmark.`)
          setStatus('error')
          return true
        }
        if (auto) {
          continueWithAnchor(q, auto)
          if (options.length > 1) {
            toast(`Using ${auto.name}, ${auto.address.city || auto.address.state} — the nearest match.`, 'info', {
              label: 'Change',
              run: () => push({ name: 'disambiguate' }),
            })
          }
        } else {
          pendingQuery.current = q
          setStatus('idle')
          setViews((s) => [...s.filter((v) => v.name === 'home'), { name: 'disambiguate' }])
          mapRef.current?.fitTo(options.slice(0, 6), 14)
        }
      } catch (e) {
        if (!isCurrent(id) || (e instanceof api.ApiError && e.kind === 'aborted')) return true
        setError(api.describeError(e))
        setStatus('error')
      }
      return true
    },
    [basePoint, continueWithAnchor, locate, mapRef, push, radius, runCategory, runNameNear, runPlaceLookup, toast],
  )

  /** User picked one of the "Which one did you mean?" cards. */
  const chooseAnchor = useCallback(
    (place: Place) => {
      const q = pendingQuery.current ?? parsed
      if (!q) return
      pendingQuery.current = null
      continueWithAnchor(q, place)
    },
    [continueWithAnchor, parsed],
  )

  /** Category chip: search that category around the current anchor (or the user). */
  const searchCategory = useCallback(
    async (catId: string) => {
      const cat = getCategory(catId) as Category | undefined
      if (!cat) return
      const text = `${cat.label} near me`
      setQuery(cat.label)
      setQueryError(null)
      setParsed(parseQuery(text) as ParsedQuery)
      setFilters(NO_FILTERS)
      history.replaceState(null, '', `#q=${encodeURIComponent(text)}`)
      let at: SearchAnchor
      if (anchor && anchor.kind !== 'me' && views.some((v) => v.name === 'results')) at = anchor
      else if (userRef.current) at = basePoint()
      else {
        setStatus('locating')
        setViews((s) => [...s.filter((v) => v.name === 'home'), { name: 'results' }])
        at = await locate({ quiet: false })
      }
      void runCategory(cat, at, radius)
    },
    [anchor, basePoint, locate, radius, runCategory, views],
  )

  /** "Search this area" after the user pans the map. */
  const searchHere = useCallback(() => {
    const c = mapRef.current?.center()
    if (!c) return
    const at: SearchAnchor = { ...c, kind: 'map', label: 'this area' }
    setSearchAreaAt(null)
    if (category) void runCategory(category, at, radius)
    else if (parsed?.what) void runNameNear(parsed.what, at, Math.max(radius, 3000))
  }, [category, mapRef, parsed, radius, runCategory, runNameNear])

  const expandRadiusTo = useCallback(
    async (next: number) => {
      if (category && anchor) await runCategory(category, anchor, next)
      else if (parsed?.what && anchor) await runNameNear(parsed.what, anchor, next)
      else setRadius(next)
    },
    [anchor, category, parsed, runCategory, runNameNear],
  )
  const expandRadius = useCallback(() => void expandRadiusTo(Math.min(radius * 2, 10_000)), [expandRadiusTo, radius])

  const retry = useCallback(() => {
    if (category && anchor) void runCategory(category, anchor, radius)
    else if (query) void search(query)
  }, [anchor, category, query, radius, runCategory, search])

  // Offer "Search this area" when the user pans away from the searched area.
  const onMapMoved = useCallback(
    (center: LatLon, zoom: number, byUser: boolean) => {
      if (!byUser || !anchor || zoom < 12) return
      if (!views.some((v) => v.name === 'results')) return
      const moved = distanceMeters(anchor, center)
      setSearchAreaAt(moved > radius * 0.6 ? center : null)
    },
    [anchor, radius, views],
  )

  // ---- derived results (filters + sorting) ---------------------------------
  const visibleResults = useMemo(() => {
    const now = new Date()
    const withStatus = results
      .filter((p) => p.name)
      .map((p) => ({ place: p, status: getOpenStatus(p.tags.opening_hours, now) }))
    const filtered = withStatus.filter(({ place, status: s }) => {
      if (filters.openNow && s.state !== 'open' && !(filters.includeUnknown && s.state === 'unknown')) return false
      if (filters.allDay && !s.allDay) return false
      if (filters.wheelchair && !['yes', 'limited', 'designated'].includes(place.tags.wheelchair ?? '')) return false
      return true
    })
    // With "Open now", confirmed-open places come first, then places with unknown hours.
    const rank = (s: { state: string }) => (filters.openNow ? (s.state === 'open' ? 0 : 1) : 0)
    return filtered.sort(
      (a, b) => rank(a.status) - rank(b.status) || (a.place.distance ?? 0) - (b.place.distance ?? 0),
    )
  }, [results, filters])

  const hiddenCount = results.filter((p) => p.name).length - visibleResults.length

  // ---- place selection -------------------------------------------------------
  const selectPlace = useCallback(
    (id: string, opts: { fly?: boolean } = {}) => {
      const p = placesById.get(id)
      setSelectedId(id)
      setRoute(null)
      push({ name: 'place', id })
      history.replaceState(null, '', `#place=${id}`)
      if (p && opts.fly !== false) mapRef.current?.flyTo(p.lat, p.lon, Math.max(mapRef.current.zoom(), 16.5), { duration: 900 })
    },
    [mapRef, placesById, push],
  )

  /** Load a place from a shared link (#place=node/123). */
  const openSharedPlace = useCallback(
    async (id: string) => {
      try {
        const [p] = await api.lookupByIds([id])
        if (!p) return toast("That shared place couldn't be found.", 'warning')
        const base = userRef.current
        const withDist = base ? { ...p, distance: distanceMeters(base, p) } : p
        remember(withDist)
        setSelectedId(p.id)
        setViews([{ name: 'home' }, { name: 'place', id: p.id }])
        mapRef.current?.flyTo(p.lat, p.lon, 17, { duration: 2400 })
      } catch (e) {
        toast(api.describeError(e), 'error')
      }
    },
    [mapRef, remember, toast],
  )

  /** Right-click / long-press on the map: "What's here?" via reverse geocoding. */
  const whatsHere = useCallback(
    async (lat: number, lon: number) => {
      try {
        const p = await api.reverseGeocode(lat, lon, { zoom: 18 })
        if (!p) return toast('No address found here.', 'info')
        const base = userRef.current
        const place = { ...p, lat, lon, distance: base ? distanceMeters(base, { lat, lon }) : undefined }
        remember(place)
        setSelectedId(place.id)
        setRoute(null)
        push({ name: 'place', id: place.id })
      } catch (e) {
        toast(api.describeError(e), 'error')
      }
    },
    [push, remember, toast],
  )

  const mapCenter = useCallback((): LatLon => mapRef.current?.center() ?? basePoint(), [basePoint, mapRef])

  // ---- directions -------------------------------------------------------------
  const directions = useCallback(
    async (id: string, travel: TravelMode = mode, reversed = false) => {
      const dest = placesById.get(id)
      if (!dest) return
      setMode(travel)
      setRouteReversed(reversed)
      push({ name: 'directions', id })
      setRouteStatus('loading')
      setRouteError(null)
      routeController.current?.abort()
      routeController.current = new AbortController()
      let from: LatLon | null = userRef.current
      if (!from) {
        const at = await locate({ quiet: true })
        from = at.kind === 'me' ? at : anchor ?? at
        if (at.kind !== 'me') toast(`Route starts from ${anchor?.label ?? at.label} (your location is unavailable).`, 'info')
      }
      try {
        const [a, z] = reversed ? [dest, from] : [from, dest]
        const r = (await api.getRoute(travel, a, z, routeController.current.signal)) as Route
        setRoute(r)
        setRouteStatus('done')
        mapRef.current?.fitRoute(r)
      } catch (e) {
        if (e instanceof api.ApiError && e.kind === 'aborted') return
        setRouteError(api.describeError(e))
        setRouteStatus('error')
      }
    },
    [anchor, locate, mapRef, mode, placesById, push, toast],
  )

  const closeDirections = useCallback(() => {
    routeController.current?.abort()
    setRoute(null)
    setRouteStatus('idle')
    back()
  }, [back])

  // ---- saved & recents ------------------------------------------------------
  const toggleSaved = useCallback(
    (p: Place) => {
      const next = toggleSavedStore(p) as SavedPlace[]
      setSaved(next)
      const nowSaved = next.some((s) => s.id === p.id)
      toast(nowSaved ? `Saved ${p.name}.` : `Removed ${p.name} from Saved.`, nowSaved ? 'success' : 'info')
    },
    [toast],
  )
  const refreshReports = useCallback(() => setReports(loadReports()), [])

  const clearRecents = useCallback(() => {
    clearRecentsStore()
    setRecents([])
  }, [])

  return {
    // state
    settings,
    saved,
    recents,
    online,
    user,
    locStatus,
    query,
    queryError,
    parsed,
    anchor,
    anchorOptions,
    category,
    radius,
    results,
    visibleResults,
    hiddenCount,
    status,
    enrich,
    error,
    filters,
    view,
    views,
    selectedId,
    placesById,
    route,
    routeReversed,
    reports,
    refreshReports,
    routeStatus,
    routeError,
    mode,
    toasts,
    searchAreaAt,
    pickLocation,
    fallbackCity,
    // actions
    setQuery,
    setQueryError,
    setFilters,
    setSettings,
    updateSetting,
    search,
    searchCategory,
    chooseAnchor,
    searchHere,
    expandRadius,
    expandRadiusTo,
    retry,
    onMapMoved,
    selectPlace,
    openSharedPlace,
    whatsHere,
    mapCenter,
    directions,
    closeDirections,
    toggleSaved,
    clearRecents,
    locate,
    push,
    back,
    goHome,
    showTab,
    toast,
    dismissToast,
    setPickLocation,
    setSelectedId,
    remember,
  }
}

export type Beacon = ReturnType<typeof useBeacon>
