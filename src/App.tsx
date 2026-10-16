import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { X } from '@phosphor-icons/react'
import BeaconMap, { type BeaconMapHandle } from './map/BeaconMap'
import { resolveStyle } from './map/styles'
import { useBeacon } from './state/useBeacon'
import * as api from './js/api.js'
import { CATEGORIES } from './js/categories.js'
import { onShortcuts } from './js/events.js'
import { useIsDesktop, useReducedMotion, useSystemDark } from './ui/hooks'
import LiquidFilter from './ui/LiquidFilter'
import { cx, Glass } from './ui/Glass'
import MapControls from './components/MapControls'
import SearchBar, { type SearchBarHandle } from './components/SearchBar'
import CategoryChips from './components/CategoryChips'
import BottomNav, { type Tab } from './components/BottomNav'
import RouteCard from './components/RouteCard'
import Sheet, { type Detent } from './components/Sheet'
import Landing from './components/Landing'
import Navigation from './components/Navigation'
import Splash from './components/Splash'
import { OfflineBanner, SearchAreaButton, Toasts } from './components/Overlays'
import HomeView from './components/views/HomeView'
import ResultsView from './components/views/ResultsView'
import DisambiguateView from './components/views/DisambiguateView'
import PlaceView from './components/views/PlaceView'
import DirectionsView from './components/views/DirectionsView'
import ReportView from './components/views/ReportView'
import SavedView from './components/views/SavedView'
import ReportsView from './components/views/ReportsView'
import SettingsView from './components/views/SettingsView'
import ShortcutsView from './components/views/ShortcutsView'
import type { Place, Route, View } from './types'

const PANEL_W = 400
const NAV_H = 72

/** Preferred sheet height for each view on phones (HIG: progressive disclosure via detents). */
const DETENT_FOR: Record<View['name'], Detent> = {
  home: 'peek',
  disambiguate: 'half',
  results: 'half',
  place: 'half',
  directions: 'peek',
  report: 'full',
  saved: 'half',
  reports: 'half',
  settings: 'full',
  shortcuts: 'half',
}

/** Views that keep the bottom tab bar visible (place / directions / report take the whole bottom). */
const NAV_VIEWS: View['name'][] = ['home', 'results', 'disambiguate', 'saved', 'reports', 'settings', 'shortcuts']

const TAB_OF: Record<View['name'], Tab> = {
  home: 'explore',
  results: 'explore',
  disambiguate: 'explore',
  place: 'explore',
  directions: 'explore',
  report: 'explore',
  saved: 'saved',
  reports: 'reports',
  settings: 'settings',
  shortcuts: 'settings',
}

// Landing-page demo: a real walking route from MG Road metro to a pharmacy near Church Street.
const DEMO_FROM = { lat: 12.97566, lon: 77.60664 }
const DEMO_PHARMACY: Place = {
  id: 'demo/pharmacy',
  osmType: 'node',
  osmId: 0,
  name: 'Pharmacy',
  lat: 12.97278,
  lon: 77.60521,
  categoryId: 'pharmacy',
  kind: 'Pharmacy',
  tags: { amenity: 'pharmacy' },
  address: { street: '', area: '', city: '', state: '', postcode: '', country: '' },
  source: 'nominatim',
  bbox: null,
}

export default function App() {
  const mapRef = useRef<BeaconMapHandle>(null)
  const searchRef = useRef<SearchBarHandle>(null)
  const b = useBeacon(mapRef)
  const isDesktop = useIsDesktop()
  const reducedMotion = useReducedMotion()
  const systemDark = useSystemDark()
  const [landing, setLanding] = useState(() => !/(^|[#&])(q|place)=/.test(location.hash))
  const [demoRoute, setDemoRoute] = useState<Route | null>(null)
  const [stylesOpen, setStylesOpen] = useState(false)
  const [zoom, setZoom] = useState(16)
  const [detent, setDetent] = useState<Detent>('peek')
  const [searchFocused, setSearchFocused] = useState(false)
  const [vh, setVh] = useState(() => window.innerHeight)
  const [navigating, setNavigating] = useState(false)
  const [navFollow, setNavFollow] = useState(true)
  // Loading screen: hide once the map has drawn its tiles (min ~1 s so it never flashes, max 9 s).
  const [mapIdle, setMapIdle] = useState(false)
  const [minTimePassed, setMinTimePassed] = useState(false)
  const [splashTimedOut, setSplashTimedOut] = useState(false)
  useEffect(() => {
    const a = window.setTimeout(() => setMinTimePassed(true), 1100)
    const b2 = window.setTimeout(() => setSplashTimedOut(true), 9000)
    return () => {
      window.clearTimeout(a)
      window.clearTimeout(b2)
    }
  }, [])
  useEffect(() => {
    new Image().src = `${import.meta.env.BASE_URL}landing/car.svg`
  }, [])
  const showSplash = !splashTimedOut && !(mapIdle && minTimePassed)
  // Height of the floating top bar on phones, so the bottom sheet can stop just below it.
  const headerRef = useRef<HTMLElement>(null)
  const [headerH, setHeaderH] = useState(130)
  useEffect(() => {
    const el = headerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setHeaderH(Math.round(el.getBoundingClientRect().bottom)))
    ro.observe(el)
    return () => ro.disconnect()
  })

  const dark = b.settings.theme === 'dark' || (b.settings.theme === 'auto' && systemDark)
  const styleId = landing ? 'muted' : resolveStyle(b.settings.mapStyle, dark)
  const onImagery = !landing && (styleId === 'satellite' || zoom < 4.5)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0b0e14' : '#f4f6fa')
  }, [dark])

  useEffect(() => {
    const onResize = () => setVh(window.innerHeight)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    setDetent(DETENT_FOR[b.view.name])
    if (b.view.name !== 'directions') setNavigating(false)
  }, [b.view])

  // Landing page: fetch a real walking route for the hero animation.
  useEffect(() => {
    if (!landing || demoRoute) return
    const ctrl = new AbortController()
    api
      .getRoute('foot', DEMO_FROM, DEMO_PHARMACY, ctrl.signal)
      .then((r) => setDemoRoute(r as Route))
      .catch(() => {
        /* the hero still works without the route */
      })
    return () => ctrl.abort()
  }, [landing, demoRoute])

  /** Starts the app: shared links first, otherwise fly to the user (if allowed) or the default city. */
  const startApp = useCallback(
    async (fromLanding: boolean) => {
      const hash = new URLSearchParams(location.hash.slice(1))
      const q = hash.get('q')
      const place = hash.get('place')
      if (place) return void b.openSharedPlace(place)
      let granted = false
      try {
        granted = (await navigator.permissions?.query({ name: 'geolocation' }))?.state === 'granted'
      } catch {
        /* Permissions API not available */
      }
      if (q) {
        if (granted) await b.locate({ quiet: true })
        return void b.search(q)
      }
      if (granted) void b.locate({ fly: true })
      else if (fromLanding) mapRef.current?.enterApp(b.fallbackCity.lat, b.fallbackCity.lon)
      else mapRef.current?.flyTo(b.fallbackCity.lat, b.fallbackCity.lon, 13, { duration: 3200 })
    },
    [b],
  )

  const started = useRef(false)
  const onReady = useCallback(() => {
    if (started.current || landing) return
    started.current = true
    window.setTimeout(() => void startApp(false), reducedMotion ? 0 : 1800)
  }, [landing, reducedMotion, startApp])

  const explore = useCallback(() => {
    setLanding(false)
    started.current = true
    void startApp(true)
  }, [startApp])

  // ---- keyboard shortcuts (keydown events) ---------------------------------
  useEffect(() => {
    if (landing) return onShortcuts([{ key: 'Enter', description: 'Explore', run: explore }])
    return onShortcuts([
      { key: '/', description: 'Focus search', run: () => searchRef.current?.focus() },
      {
        key: 'Escape',
        description: 'Close',
        run: () => {
          if (stylesOpen) setStylesOpen(false)
          else if (b.view.name === 'directions') b.closeDirections()
          else if (b.views.length > 1) b.back()
        },
      },
      { key: 'l', description: 'Locate', run: () => void b.locate({ fly: true }) },
      { key: 's', description: 'Styles', run: () => setStylesOpen((o) => !o) },
      { key: 'g', description: 'Globe', run: () => b.updateSetting('globe', !b.settings.globe) },
      { key: '+', description: 'Zoom in', run: () => mapRef.current?.zoomBy(1) },
      { key: '=', description: 'Zoom in', run: () => mapRef.current?.zoomBy(1) },
      { key: '-', description: 'Zoom out', run: () => mapRef.current?.zoomBy(-1) },
      { key: '?', description: 'Help', run: () => b.push({ name: 'shortcuts' }) },
      ...CATEGORIES.slice(0, 9).map((c, i) => ({
        key: String(i + 1),
        description: c.label,
        run: () => void b.searchCategory(c.id),
      })),
    ])
  }, [b, stylesOpen, landing, explore])

  const mapPlaces = useMemo(() => {
    if (landing) return [DEMO_PHARMACY]
    if (b.view.name === 'disambiguate') return b.anchorOptions.map((p) => ({ ...p, categoryId: null }))
    const list = b.visibleResults.map((r) => r.place)
    if (b.selectedId && !list.some((p) => p.id === b.selectedId)) {
      const sel = b.placesById.get(b.selectedId)
      if (sel) list.push(sel)
    }
    return list
  }, [landing, b.visibleResults, b.selectedId, b.placesById, b.view.name, b.anchorOptions])

  const view = b.view
  const showNav = NAV_VIEWS.includes(view.name)
  const showSheet = view.name !== 'home'
  const sheetBottom = showNav ? NAV_H : 0
  const sheetTop = headerH + 10
  const sheetFull = Math.max(200, vh - sheetBottom - sheetTop)
  const sheetHeight = !showSheet ? 0 : detent === 'peek' ? 132 : detent === 'half' ? Math.min(sheetFull, vh * 0.48) : sheetFull
  const mobileBottom = sheetBottom + sheetHeight

  const padding = useMemo(() => {
    if (landing) return { top: Math.round(vh * 0.4), bottom: 0, left: 0, right: 0 }
    // Navigation: keep the arrow in the lower third, like Google Maps.
    if (navigating) return { top: Math.round(vh * 0.42), bottom: 110, left: 0, right: 0 }
    if (isDesktop) return { top: 24, bottom: 24, left: PANEL_W + 24, right: 80 }
    return { top: view.name === 'directions' ? 230 : 130, bottom: Math.min(mobileBottom, vh * 0.62) + 8, left: 12, right: 64 }
  }, [landing, navigating, isDesktop, mobileBottom, vh, view.name])

  const showRadius = (view.name === 'results' || view.name === 'place') && b.anchor && b.category

  const content = (() => {
    switch (view.name) {
      case 'home':
        return <HomeView b={b} />
      case 'results':
        return <ResultsView b={b} />
      case 'disambiguate':
        return <DisambiguateView b={b} />
      case 'place':
        return <PlaceView b={b} id={view.id} />
      case 'directions':
        return <DirectionsView b={b} id={view.id} onStart={() => {
              setNavFollow(true)
              setNavigating(true)
            }} />
      case 'report':
        return <ReportView b={b} id={view.id} />
      case 'saved':
        return <SavedView b={b} />
      case 'reports':
        return <ReportsView b={b} />
      case 'settings':
        return <SettingsView b={b} />
      case 'shortcuts':
        return <ShortcutsView b={b} />
    }
  })()

  const viewKey = view.name + ('id' in view ? view.id : '')
  const animated = (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={viewKey}
        initial={reducedMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, transition: { duration: 0.06 } }}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      >
        {content}
      </motion.div>
    </AnimatePresence>
  )

  const searchBar = (
    <SearchBar
      ref={searchRef}
      value={b.query}
      error={b.queryError}
      near={b.user ?? b.anchor ?? b.fallbackCity}
      units={b.settings.units}
      recents={b.recents}
      busy={b.status === 'loading' || b.status === 'locating'}
      onChange={b.setQuery}
      onSubmit={(t) => void b.search(t)}
      onPickPlace={(p) => {
        b.remember(p)
        b.selectPlace(p.id)
      }}
      onClearRecents={b.clearRecents}
      onClearError={() => b.setQueryError(null)}
      onVoiceError={(m) => b.toast(m, 'warning')}
      onFocusChange={setSearchFocused}
    />
  )

  const placeName = view.name === 'place' ? b.placesById.get(view.id)?.name : null
  const placeBar = (
    <Glass variant="strong" className="flex h-14 items-center gap-3 rounded-full pr-2 pl-5">
      <span className="font-display min-w-0 flex-1 truncate text-[18px] font-semibold">{placeName}</span>
      <button
        type="button"
        aria-label="Close place"
        onClick={b.back}
        className="grid size-10 place-items-center rounded-full text-[var(--label-2)] hover:bg-[var(--fill)]"
      >
        <X size={22} weight="bold" />
      </button>
    </Glass>
  )

  const top =
    view.name === 'directions' ? (
      <RouteCard b={b} id={view.id} />
    ) : view.name === 'place' && !isDesktop ? (
      placeBar
    ) : (
      <>
        {searchBar}
        {!searchFocused && view.name !== 'place' && view.name !== 'report' && (
          <div className="mt-2.5">
            <CategoryChips glass={!isDesktop} active={b.category?.id ?? null} onPick={(id) => void b.searchCategory(id)} />
          </div>
        )}
      </>
    )

  const topCenter = (
    <div className="flex flex-col items-center gap-2">
      {!b.online && <OfflineBanner />}
      {b.searchAreaAt && <SearchAreaButton onClick={b.searchHere} />}
    </div>
  )

  const controls = (
    <MapControls
      compact={!isDesktop}
      styleSetting={b.settings.mapStyle}
      activeStyle={styleId}
      globe={b.settings.globe}
      locating={b.locStatus === 'locating'}
      onImagery={onImagery}
      onStyle={(s) => b.updateSetting('mapStyle', s)}
      onToggleGlobe={() => b.updateSetting('globe', !b.settings.globe)}
      onLocate={() => void b.locate({ fly: true })}
      onZoom={(d) => mapRef.current?.zoomBy(d)}
      onResetNorth={() => mapRef.current?.resetNorth()}
      stylesOpen={stylesOpen}
      setStylesOpen={setStylesOpen}
    />
  )

  return (
    <div className={cx('relative h-full w-full overflow-hidden', onImagery && 'on-imagery')}>
      <LiquidFilter />
      {!landing && (
        <a
          href="#beacon-search"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-full focus:bg-accent-600 focus:px-4 focus:py-2 focus:text-white"
        >
          Skip to search
        </a>
      )}

      <BeaconMap
        ref={mapRef}
        landing={landing}
        styleId={styleId}
        globe={b.settings.globe}
        places={mapPlaces}
        selectedId={landing ? DEMO_PHARMACY.id : b.selectedId}
        route={landing ? demoRoute : view.name === 'directions' ? b.route : null}
        user={landing || navigating ? null : b.user}
        anchor={!landing && b.anchor && b.anchor.kind !== 'me' && view.name !== 'home' ? { ...b.anchor, name: b.anchor.label } : null}
        radius={!landing && showRadius ? { lat: b.anchor!.lat, lon: b.anchor!.lon, meters: b.radius } : null}
        padding={padding}
        reducedMotion={reducedMotion}
        pickLocation={b.pickLocation}
        onSelect={(id) => {
          if (landing) return
          if (view.name === 'disambiguate') {
            const option = b.anchorOptions.find((o) => o.id === id)
            if (option) return b.chooseAnchor(option)
          }
          b.selectPlace(id, { fly: false })
        }}
        onPick={(lat, lon) => b.setPickLocation({ lat, lon })}
        onMoveEnd={(c, z, byUser) => {
          setZoom(z)
          if (!landing) b.onMapMoved(c, z, byUser)
        }}
        onReady={onReady}
        onIdle={() => setMapIdle(true)}
        onUserGesture={() => navigating && setNavFollow(false)}
        onLongPress={(lat, lon) => {
          if (!landing) void b.whatsHere(lat, lon)
        }}
      />

      <AnimatePresence>{landing && !showSplash && <Landing key="landing" route={demoRoute} reducedMotion={reducedMotion} onExplore={explore} />}</AnimatePresence>

      {navigating && view.name === 'directions' && b.route && (
        <Navigation
          route={b.route}
          mode={b.mode}
          destination={b.placesById.get(view.id)?.name ?? 'your destination'}
          user={b.user}
          units={b.settings.units}
          reducedMotion={reducedMotion}
          mapRef={mapRef}
          following={navFollow}
          onFollowChange={setNavFollow}
          onExit={() => {
            setNavigating(false)
            if (b.route) window.setTimeout(() => mapRef.current?.fitRoute(b.route!), 850)
          }}
        />
      )}

      {!landing &&
        !navigating &&
        (isDesktop ? (
          <>
            <aside
              className="pointer-events-none absolute inset-y-0 left-0 z-20 flex flex-col gap-3 p-4"
              style={{ width: PANEL_W + 32 }}
              aria-label="Search and results"
            >
              <div className="pointer-events-auto">{top}</div>
              <Glass
                variant="strong"
                as="section"
                aria-label={view.name === 'home' ? 'Explore' : 'Details'}
                className="thin-scrollbar pointer-events-auto min-h-0 shrink overflow-y-auto overscroll-contain rounded-[28px] pt-4"
              >
                {animated}
              </Glass>
              <div className="mt-auto">
                <BottomNav floating active={TAB_OF[view.name]} onChange={(t) => b.showTab(t)} badge={b.reports.length} />
              </div>
            </aside>
            <div
              className="absolute top-4 z-10"
              style={{ left: `calc(${PANEL_W + 32}px + (100% - ${PANEL_W + 32}px) / 2)`, transform: 'translateX(-50%)' }}
            >
              {topCenter}
            </div>
            <div className="absolute top-4 right-4 z-10">{controls}</div>
          </>
        ) : (
          <>
            <header ref={headerRef} className="pointer-events-none absolute inset-x-0 top-0 z-30 px-3 pt-[calc(env(safe-area-inset-top)+12px)]">
              <div className="pointer-events-auto">{top}</div>
              <div className="pointer-events-auto mt-2 flex justify-center">{topCenter}</div>
            </header>
            <div
              className="absolute right-3 z-10 transition-[bottom] duration-500 ease-[var(--ease-spring)]"
              style={{ bottom: Math.min(mobileBottom, vh * 0.62) + 14 }}
            >
              {controls}
            </div>
            {showSheet && (
              <Sheet detent={detent} onDetent={setDetent} bottom={sheetBottom} top={sheetTop} label="Search results and place details">
                {animated}
              </Sheet>
            )}
            {showNav && (
              <div className="absolute inset-x-0 bottom-0 z-30">
                <BottomNav active={TAB_OF[view.name]} onChange={(t) => b.showTab(t)} badge={b.reports.length} />
              </div>
            )}
          </>
        ))}

      <AnimatePresence>
        {showSplash && <Splash key="splash" message={landing ? 'Loading the city in 3D…' : 'Loading the map…'} />}
      </AnimatePresence>

      <Toasts toasts={b.toasts} onDismiss={b.dismissToast} reducedMotion={reducedMotion} />
    </div>
  )
}
