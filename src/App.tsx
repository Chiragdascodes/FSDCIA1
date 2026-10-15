import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Bookmark, Keyboard, Settings as SettingsIcon } from 'lucide-react'
import BeaconMap, { type BeaconMapHandle } from './map/BeaconMap'
import { resolveStyle } from './map/styles'
import { useBeacon } from './state/useBeacon'
import { CATEGORIES } from './js/categories.js'
import { onShortcuts } from './js/events.js'
import { useIsDesktop, useReducedMotion, useSystemDark } from './ui/hooks'
import LiquidFilter from './ui/LiquidFilter'
import { cx, Glass } from './ui/Glass'
import MapControls from './components/MapControls'
import SearchBar, { type SearchBarHandle } from './components/SearchBar'
import CategoryChips from './components/CategoryChips'
import Sheet, { type Detent } from './components/Sheet'
import { Logo, OfflineBanner, SearchAreaButton, Toasts } from './components/Overlays'
import HomeView from './components/views/HomeView'
import ResultsView from './components/views/ResultsView'
import DisambiguateView from './components/views/DisambiguateView'
import PlaceView from './components/views/PlaceView'
import DirectionsView from './components/views/DirectionsView'
import ReportView from './components/views/ReportView'
import SavedView from './components/views/SavedView'
import SettingsView from './components/views/SettingsView'
import ShortcutsView from './components/views/ShortcutsView'
import type { View } from './types'

const PANEL_W = 412

/** Preferred sheet height for each view on phones (HIG: progressive disclosure via detents). */
const DETENT_FOR: Record<View['name'], Detent> = {
  home: 'half',
  disambiguate: 'half',
  results: 'half',
  place: 'half',
  directions: 'half',
  report: 'full',
  saved: 'half',
  settings: 'full',
  shortcuts: 'half',
}

export default function App() {
  const mapRef = useRef<BeaconMapHandle>(null)
  const searchRef = useRef<SearchBarHandle>(null)
  const b = useBeacon(mapRef)
  const isDesktop = useIsDesktop()
  const reducedMotion = useReducedMotion()
  const systemDark = useSystemDark()
  const [stylesOpen, setStylesOpen] = useState(false)
  const [zoom, setZoom] = useState(1.6)
  const [detent, setDetent] = useState<Detent>('peek')
  const [searchFocused, setSearchFocused] = useState(false)

  const dark = b.settings.theme === 'auto' ? systemDark : b.settings.theme === 'dark'
  const styleId = resolveStyle(b.settings.mapStyle, dark)
  const onImagery = styleId === 'satellite' || zoom < 4.5

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    document.querySelector('meta[name="theme-color"]:not([media])')?.setAttribute('content', dark ? '#0b0f0e' : '#f2f4f3')
  }, [dark])

  // Move the sheet to a sensible height whenever the view changes.
  useEffect(() => {
    setDetent(DETENT_FOR[b.view.name])
  }, [b.view])

  // ---- first load: shared links, then a gentle fly-in from the globe ------
  const started = useRef(false)
  const onReady = useCallback(() => {
    if (started.current) return
    started.current = true
    const hash = new URLSearchParams(location.hash.slice(1))
    const q = hash.get('q')
    const place = hash.get('place')
    window.setTimeout(
      async () => {
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
        else mapRef.current?.flyTo(b.fallbackCity.lat, b.fallbackCity.lon, 12.6, { duration: 3200 })
      },
      reducedMotion ? 0 : 2200,
    )
  }, [b, reducedMotion])

  // ---- keyboard shortcuts (keydown events) ---------------------------------
  useEffect(
    () =>
      onShortcuts([
        { key: '/', description: 'Focus search', run: () => searchRef.current?.focus() },
        {
          key: 'Escape',
          description: 'Close',
          allowInInputs: false,
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
      ]),
    [b, stylesOpen],
  )

  // ---- what the map shows ---------------------------------------------------
  const mapPlaces = useMemo(() => {
    const list = b.visibleResults.map((r) => r.place)
    if (b.selectedId && !list.some((p) => p.id === b.selectedId)) {
      const sel = b.placesById.get(b.selectedId)
      if (sel) list.push(sel)
    }
    return b.view.name === 'disambiguate' ? [] : list
  }, [b.visibleResults, b.selectedId, b.placesById, b.view.name])

  const sheetHeight = detent === 'peek' ? 148 : detent === 'half' ? window.innerHeight * 0.5 : window.innerHeight - 104
  const padding = useMemo(
    () =>
      isDesktop
        ? { top: 24, bottom: 24, left: PANEL_W + 16, right: 72 }
        : { top: 128, bottom: Math.min(sheetHeight, window.innerHeight * 0.6) + 8, left: 12, right: 60 },
    [isDesktop, sheetHeight],
  )

  const showRadius = (b.view.name === 'results' || b.view.name === 'place') && b.anchor && b.category

  const content = (() => {
    const v = b.view
    switch (v.name) {
      case 'home':
        return <HomeView b={b} compact={!isDesktop} />
      case 'results':
        return <ResultsView b={b} />
      case 'disambiguate':
        return <DisambiguateView b={b} />
      case 'place':
        return <PlaceView b={b} id={v.id} />
      case 'directions':
        return <DirectionsView b={b} id={v.id} />
      case 'report':
        return <ReportView b={b} id={v.id} />
      case 'saved':
        return <SavedView b={b} />
      case 'settings':
        return <SettingsView b={b} />
      case 'shortcuts':
        return <ShortcutsView b={b} />
    }
  })()

  const viewKey = b.view.name + ('id' in b.view ? b.view.id : '')
  const animated = (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={viewKey}
        initial={reducedMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
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
      onFocusChange={setSearchFocused}
    />
  )

  const topCenter = (
    <div className="flex flex-col items-center gap-2">
      {!b.online && <OfflineBanner />}
      {b.searchAreaAt && <SearchAreaButton onClick={b.searchHere} />}
    </div>
  )

  return (
    <div className={cx('relative h-full w-full overflow-hidden', onImagery && 'on-imagery')}>
      <LiquidFilter />
      <a
        href="#beacon-search"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-full focus:bg-accent-600 focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to search
      </a>

      <BeaconMap
        ref={mapRef}
        styleId={styleId}
        globe={b.settings.globe}
        places={mapPlaces}
        selectedId={b.selectedId}
        route={b.view.name === 'directions' ? b.route : null}
        user={b.user}
        anchor={b.anchor && b.anchor.kind !== 'me' && b.view.name !== 'home' ? { ...b.anchor, name: b.anchor.label } : null}
        radius={showRadius ? { lat: b.anchor!.lat, lon: b.anchor!.lon, meters: b.radius } : null}
        padding={padding}
        reducedMotion={reducedMotion}
        pickLocation={b.pickLocation}
        onSelect={(id) => b.selectPlace(id, { fly: false })}
        onPick={(lat, lon) => b.setPickLocation({ lat, lon })}
        onMoveEnd={(c, z, byUser) => {
          setZoom(z)
          b.onMapMoved(c, z, byUser)
        }}
        onReady={onReady}
        onLongPress={(lat, lon) => void b.whatsHere(lat, lon)}
      />

      {isDesktop ? (
        <>
          <aside
            className="pointer-events-none absolute inset-y-0 left-0 z-20 flex flex-col p-4"
            style={{ width: PANEL_W + 16 }}
            aria-label="Search and results"
          >
            <Glass variant="strong" as="section" className="pointer-events-auto flex max-h-full min-h-0 flex-col rounded-[30px]">
              <div className="space-y-3 p-3.5 pb-2">
                <div className="flex items-center justify-between px-1">
                  <button type="button" onClick={b.goHome} aria-label="Beacon home" className="rounded-xl">
                    <Logo />
                  </button>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      aria-label="Saved places"
                      title="Saved places"
                      onClick={() => b.push({ name: 'saved' })}
                      className="label-2 grid size-9 place-items-center rounded-full hover:bg-[var(--fill)]"
                    >
                      <Bookmark className="size-[18px]" />
                    </button>
                    <button
                      type="button"
                      aria-label="Keyboard shortcuts"
                      title="Keyboard shortcuts (?)"
                      onClick={() => b.push({ name: 'shortcuts' })}
                      className="label-2 grid size-9 place-items-center rounded-full hover:bg-[var(--fill)]"
                    >
                      <Keyboard className="size-[18px]" />
                    </button>
                    <button
                      type="button"
                      aria-label="Settings"
                      title="Settings"
                      onClick={() => b.push({ name: 'settings' })}
                      className="label-2 grid size-9 place-items-center rounded-full hover:bg-[var(--fill)]"
                    >
                      <SettingsIcon className="size-[18px]" />
                    </button>
                  </div>
                </div>
                {searchBar}
                {b.view.name !== 'home' && <CategoryChips active={b.category?.id ?? null} onPick={(id) => void b.searchCategory(id)} />}
              </div>
              <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain pt-1">{animated}</div>
            </Glass>
          </aside>
          <div className="absolute top-4 z-10" style={{ left: `calc(${PANEL_W + 16}px + (100% - ${PANEL_W + 16}px) / 2)`, transform: 'translateX(-50%)' }}>
            {topCenter}
          </div>
          <div className="absolute top-4 right-4 z-10">
            <MapControls
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
          </div>
        </>
      ) : (
        <>
          <header className="pointer-events-none absolute inset-x-0 top-0 z-30 space-y-2 px-3 pt-[calc(env(safe-area-inset-top)+12px)]">
            <div className="pointer-events-auto">{searchBar}</div>
            {!searchFocused && (
              <div className="pointer-events-auto">
                <CategoryChips glass active={b.category?.id ?? null} onPick={(id) => void b.searchCategory(id)} />
              </div>
            )}
            <div className="pointer-events-auto flex justify-center">{topCenter}</div>
          </header>
          <div
            className="absolute right-3 z-10 transition-[bottom] duration-500"
            style={{ bottom: Math.min(sheetHeight, window.innerHeight * 0.6) + 12 }}
          >
            <MapControls
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
          </div>
          <Sheet
            detent={detent}
            onDetent={setDetent}
            label="Search results and place details"
            header={
              b.view.name === 'home' ? (
                <div className="flex items-center justify-between px-4 pb-2">
                  <Logo />
                  <div className="flex gap-1">
                    <button
                      type="button"
                      aria-label="Saved places"
                      onClick={() => b.push({ name: 'saved' })}
                      className="label-2 grid size-9 place-items-center rounded-full hover:bg-[var(--fill)]"
                    >
                      <Bookmark className="size-[18px]" />
                    </button>
                    <button
                      type="button"
                      aria-label="Settings"
                      onClick={() => b.push({ name: 'settings' })}
                      className="label-2 grid size-9 place-items-center rounded-full hover:bg-[var(--fill)]"
                    >
                      <SettingsIcon className="size-[18px]" />
                    </button>
                  </div>
                </div>
              ) : null
            }
          >
            {animated}
          </Sheet>
        </>
      )}

      <Toasts toasts={b.toasts} onDismiss={b.dismissToast} reducedMotion={reducedMotion} />
    </div>
  )
}
