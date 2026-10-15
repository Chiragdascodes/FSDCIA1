import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import * as maplibre from 'maplibre-gl'
import type { GeoJSONSource, Map as MapLibreMap, MapLayerMouseEvent, StyleSpecification } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import type { Place, Route } from '../types'
import { addPinImages } from './pins'
import { LABEL_FONT, MAP_STYLES, type MapStyleId } from './styles'

maplibre.setWorkerUrl(workerUrl)

export interface MapPadding {
  top: number
  bottom: number
  left: number
  right: number
}

export interface BeaconMapHandle {
  flyTo(lat: number, lon: number, zoom?: number, opts?: { duration?: number }): void
  fitTo(points: { lat: number; lon: number }[], maxZoom?: number): void
  fitRoute(route: Route): void
  zoomBy(delta: number): void
  resetNorth(): void
  center(): { lat: number; lon: number }
  zoom(): number
  showWholeGlobe(): void
  /** Leave the landing view: un-tilt and fly to the app's starting point. */
  enterApp(lat: number, lon: number): void
  /** Navigation: move the follow-camera (called every animation frame). */
  navFrame(lon: number, lat: number, heading: number, zoom: number, pitch: number): void
  /** Navigation: show/move/hide the direction marker (style depends on travel mode). */
  navMarker(pos: { lon: number; lat: number } | null, heading: number, mode: 'foot' | 'bike' | 'car'): void
  /** Navigation finished: flatten the camera again. */
  exitNav(): void
}

/** Direction marker per travel mode: chevron for car/bike, dot + heading beam when walking. */
function navMarkerElement(mode: 'foot' | 'bike' | 'car'): HTMLElement {
  const el = document.createElement('div')
  el.setAttribute('role', 'img')
  el.setAttribute('aria-label', 'You (navigating)')
  if (mode === 'foot') {
    el.innerHTML = `<svg width="64" height="64" viewBox="0 0 64 64" style="overflow:visible">
      <defs><radialGradient id="beam" cx="50%" cy="100%" r="100%"><stop offset="0" stop-color="#2f6fdf" stop-opacity=".55"/><stop offset="1" stop-color="#2f6fdf" stop-opacity="0"/></radialGradient></defs>
      <path d="M32 32 L14 2 A34 34 0 0 1 50 2 Z" fill="url(#beam)"/>
      <circle cx="32" cy="32" r="11" fill="#2f6fdf" stroke="#fff" stroke-width="4"/></svg>`
  } else {
    const size = mode === 'car' ? 54 : 44
    el.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 48 48" style="filter:drop-shadow(0 4px 6px rgba(0,0,0,.35))">
      <circle cx="24" cy="24" r="22" fill="#fff"/>
      <path d="M24 7 L37 37 L24 30 L11 37 Z" fill="#2f6fdf" stroke="#2459c0" stroke-width="1.5" stroke-linejoin="round"/></svg>`
  }
  return el
}

interface Props {
  styleId: MapStyleId
  globe: boolean
  places: Place[]
  selectedId: string | null
  route: Route | null
  user: { lat: number; lon: number; accuracy?: number } | null
  anchor: { lat: number; lon: number; name: string } | null
  radius: { lat: number; lon: number; meters: number } | null
  padding: MapPadding
  reducedMotion: boolean
  pickLocation: { lat: number; lon: number } | null
  onSelect(id: string): void
  onPick(lat: number, lon: number): void
  onMoveEnd(center: { lat: number; lon: number }, zoom: number, byUser: boolean): void
  onReady(): void
  onLongPress(lat: number, lon: number): void
  /** The user dragged / rotated / zoomed the map themselves (used to pause follow-mode). */
  onUserGesture?(): void
  /** First time the map has finished loading tiles (used to hide the loading screen). */
  onIdle?(): void
  /** Landing-page mode: tilted 3D city, no interaction, slow orbit, ink route with a moving dot. */
  landing: boolean
}

/** Camera for the landing page: Church Street / MG Road, Bengaluru, tilted like an isometric city. */
export const LANDING_VIEW = { center: [77.6059, 12.9736] as [number, number], zoom: 16.5, pitch: 64, bearing: -28 }

const HANDLERS = ['scrollZoom', 'boxZoom', 'dragRotate', 'dragPan', 'keyboard', 'doubleClickZoom', 'touchZoomRotate'] as const

const SRC_PLACES = 'beacon-places'
const SRC_ROUTE = 'beacon-route'
const SRC_RADIUS = 'beacon-radius'

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

function placesToGeoJSON(places: Place[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: places.map((p) => ({
      type: 'Feature',
      id: p.id,
      geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
      properties: { id: p.id, name: p.name, cat: p.categoryId ?? 'other' },
    })),
  }
}

/** Polygon approximating a circle, for the search-radius ring. */
function circle(lat: number, lon: number, meters: number, steps = 72): GeoJSON.FeatureCollection {
  const coords: [number, number][] = []
  const dLat = meters / 111_320
  const dLon = meters / (111_320 * Math.cos((lat * Math.PI) / 180))
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2
    coords.push([lon + dLon * Math.cos(t), lat + dLat * Math.sin(t)])
  }
  return {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] }, properties: {} }],
  }
}

function routeToGeoJSON(route: Route | null): GeoJSON.FeatureCollection {
  if (!route) return EMPTY
  return { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: route.geometry, properties: {} }] }
}

const BeaconMap = forwardRef<BeaconMapHandle, Props>(function BeaconMap(props, ref) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const latest = useRef(props)
  latest.current = props
  const userMarker = useRef<maplibre.Marker | null>(null)
  const anchorMarker = useRef<maplibre.Marker | null>(null)
  const pickMarker = useRef<maplibre.Marker | null>(null)
  const spinning = useRef(true)
  const programmaticMove = useRef(false)
  const handlersAttached = useRef(false)
  const styleLabels = useRef<string[]>([])
  const navMarkerRef = useRef<{ marker: maplibre.Marker; mode: 'foot' | 'bike' | 'car' } | null>(null)

  // ---- create the map once -------------------------------------------------
  useEffect(() => {
    if (!container.current) return
    const p = latest.current
    const map = new maplibre.Map({
      container: container.current,
      style: MAP_STYLES[p.styleId].style as string | StyleSpecification,
      ...(p.landing
        ? LANDING_VIEW
        : { center: [78.9, 20.6] as [number, number], zoom: window.innerWidth < 768 ? 0.9 : 1.6 }),
      attributionControl: { compact: true },
      maxPitch: 70,
      canvasContextAttributes: { antialias: true },
    })
    mapRef.current = map
    if (import.meta.env.DEV) (window as unknown as { __map: MapLibreMap }).__map = map
    if (p.landing) spinning.current = false

    // Slow globe spin until the user does something or we fly to a location.
    const stopSpin = () => {
      spinning.current = false
    }
    map.on('mousedown', stopSpin)
    map.on('touchstart', stopSpin)
    map.on('wheel', stopSpin)
    const spin = () => {
      if (!spinning.current || latest.current.reducedMotion) return
      const z = map.getZoom()
      if (z > 4) return
      const c = map.getCenter()
      map.easeTo({ center: [c.lng + 12, c.lat], duration: 1000, easing: (n) => n })
    }
    map.on('moveend', () => {
      if (spinning.current) spin()
    })

    map.on('style.load', () => {
      setupLayers(map)
      spin()
    })
    map.once('load', () => latest.current.onReady())
    map.once('idle', () => latest.current.onIdle?.())

    map.on('moveend', () => {
      const c = map.getCenter()
      latest.current.onMoveEnd({ lat: c.lat, lon: c.lng }, map.getZoom(), !programmaticMove.current && !spinning.current)
      programmaticMove.current = false
    })

    // Long-press / right-click: "What's here?" + report location.
    // Gestures started by a person (not by code) carry an originalEvent.
    for (const ev of ['dragstart', 'rotatestart', 'pitchstart', 'zoomstart'] as const) {
      map.on(ev, (e: { originalEvent?: Event }) => {
        if (e.originalEvent) latest.current.onUserGesture?.()
      })
    }

    map.on('contextmenu', (e) => latest.current.onLongPress(e.lngLat.lat, e.lngLat.lng))

    map.on('click', (e) => {
      if (latest.current.pickLocation) latest.current.onPick(e.lngLat.lat, e.lngLat.lng)
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // ---- layers (re-added after every style change) -------------------------
  function setupLayers(map: MapLibreMap) {
    const p = latest.current
    const darkStyle = MAP_STYLES[p.styleId].dark

    try {
      map.setProjection({ type: p.globe ? 'globe' : 'mercator' })
    } catch {
      /* older engines: ignore */
    }
    try {
      map.setSky(
        darkStyle
          ? {
              'sky-color': '#0b1020',
              'horizon-color': '#1d2b3a',
              'fog-color': '#0b1020',
              'sky-horizon-blend': 0.6,
              'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0],
            }
          : {
              'sky-color': '#bfe3ff',
              'horizon-color': '#f4fbff',
              'fog-color': '#ffffff',
              'sky-horizon-blend': 0.5,
              'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0],
            },
      )
    } catch {
      /* sky is decorative */
    }

    // From space the globe shows satellite imagery, which fades into the street map as you zoom in
    // (like Apple Maps). Inserted below the first label layer so place names stay readable.
    if (p.styleId !== 'satellite' && !map.getSource('globe-imagery')) {
      map.addSource('globe-imagery', {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        maxzoom: 6,
        attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
      })
      const firstSymbol = map.getStyle().layers.find((l) => l.type === 'symbol')?.id
      map.addLayer(
        {
          id: 'globe-imagery',
          type: 'raster',
          source: 'globe-imagery',
          maxzoom: 6.5,
          paint: {
            'raster-opacity': ['interpolate', ['linear'], ['zoom'], 3, 1, 6, 0],
            'raster-fade-duration': 200,
          },
        },
        firstSymbol,
      )
    }

    // Match the reference palette on the muted style: bluish-white land, soft green parks, light-blue water.
    if (p.styleId === 'muted') {
      const tint: [string, string, string][] = [
        ['background', 'background-color', '#eef1f5'],
        ['park', 'fill-color', '#d3ecc4'],
        ['landcover_wood', 'fill-color', '#dcefd0'],
        ['water', 'fill-color', '#b3d7f5'],
        ['landuse_residential', 'fill-color', '#e8ecf1'],
        ['building', 'fill-color', '#e1e6ec'],
      ]
      const paint = map as unknown as { setPaintProperty(layer: string, prop: string, value: unknown): void }
      for (const [id, prop, color] of tint) {
        if (map.getLayer(id)) paint.setPaintProperty(id, prop, color)
      }
      if (map.getLayer('park')) paint.setPaintProperty('park', 'fill-opacity', 1)
    }

    // 3D buildings (white blocks, like the reference) when the style doesn't already extrude them.
    const style = map.getStyle()
    if (p.styleId !== 'satellite' && !style.layers.some((l) => l.type === 'fill-extrusion') && style.sources.openmaptiles) {
      map.addLayer(
        {
          id: 'beacon-buildings-3d',
          type: 'fill-extrusion',
          source: 'openmaptiles',
          'source-layer': 'building',
          minzoom: 14.5,
          paint: {
            'fill-extrusion-color': darkStyle
              ? '#2a3140'
              : ['interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 8], 0, '#ffffff', 40, '#eef2f8', 120, '#dfe6f1'],
            'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 14.5, 0, 15.5, ['coalesce', ['get', 'render_height'], 8]],
            'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
            'fill-extrusion-opacity': 0.92,
            'fill-extrusion-vertical-gradient': true,
          },
        },
        style.layers.find((l) => l.type === 'symbol')?.id,
      )
    }

    // Raised green parks and soft light give the city a clean "toy model" 3D look.
    if (p.styleId !== 'satellite' && style.sources.openmaptiles && !map.getLayer('beacon-parks-3d')) {
      map.addLayer(
        {
          id: 'beacon-parks-3d',
          type: 'fill-extrusion',
          source: 'openmaptiles',
          'source-layer': 'park',
          minzoom: 14,
          paint: {
            'fill-extrusion-color': darkStyle ? '#24402c' : '#c9e8b8',
            'fill-extrusion-height': 2.5,
            'fill-extrusion-opacity': 0.9,
          },
        },
        map.getLayer('beacon-buildings-3d') ? 'beacon-buildings-3d' : style.layers.find((l) => l.type === 'symbol')?.id,
      )
    }
    try {
      map.setLight({ anchor: 'viewport', color: '#ffffff', intensity: darkStyle ? 0.25 : 0.4, position: [1.3, 210, 40] })
    } catch {
      /* lighting is decorative */
    }
    // The style's own labels; hidden on the landing hero for a clean illustration look.
    styleLabels.current = style.layers.filter((l) => l.type === 'symbol').map((l) => l.id)
    for (const id of styleLabels.current) map.setLayoutProperty(id, 'visibility', p.landing ? 'none' : 'visible')

    if (!map.getSource(SRC_RADIUS)) {
      map.addSource(SRC_RADIUS, { type: 'geojson', data: p.radius ? circle(p.radius.lat, p.radius.lon, p.radius.meters) : EMPTY })
      map.addLayer({
        id: 'radius-fill',
        type: 'fill',
        source: SRC_RADIUS,
        paint: { 'fill-color': '#5b8def', 'fill-opacity': 0.06 },
      })
      map.addLayer({
        id: 'radius-line',
        type: 'line',
        source: SRC_RADIUS,
        paint: { 'line-color': '#5b8def', 'line-width': 1.5, 'line-opacity': 0.6, 'line-dasharray': [2, 2] },
      })
    }

    if (!map.getSource(SRC_ROUTE)) {
      map.addSource(SRC_ROUTE, { type: 'geojson', data: routeToGeoJSON(p.route) })
      // Soft glow under the route so it reads clearly in tilted 3D views.
      map.addLayer({
        id: 'route-glow',
        type: 'line',
        source: SRC_ROUTE,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#5b8def',
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 10, 18, 30],
          'line-blur': ['interpolate', ['linear'], ['zoom'], 10, 4, 18, 14],
          'line-opacity': p.landing ? 0 : 0.35,
        },
      })
      map.addLayer({
        id: 'route-casing',
        type: 'line',
        source: SRC_ROUTE,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#ffffff', 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 6, 18, 14] },
      })
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: SRC_ROUTE,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': p.landing ? '#111827' : '#5b8def',
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 3.5, 18, 9],
        },
      })
      // White dashes along the ink route on the landing page (like the reference illustration).
      map.addLayer({
        id: 'route-dash',
        type: 'line',
        source: SRC_ROUTE,
        layout: { 'line-cap': 'butt', 'line-join': 'round', visibility: p.landing ? 'visible' : 'none' },
        paint: {
          'line-color': '#ffffff',
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1, 18, 2.2],
          'line-dasharray': [2, 2.5],
        },
      })
    }

    if (!map.getSource(SRC_PLACES)) {
      map.addSource(SRC_PLACES, {
        type: 'geojson',
        data: placesToGeoJSON(p.places),
        cluster: true,
        clusterRadius: 44,
        clusterMaxZoom: 15,
        promoteId: 'id',
      })
      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: SRC_PLACES,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': darkStyle ? 'rgba(30,34,33,0.88)' : 'rgba(255,255,255,0.92)',
          'circle-radius': ['step', ['get', 'point_count'], 17, 10, 21, 30, 26],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#5b8def',
        },
      })
      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: SRC_PLACES,
        filter: ['has', 'point_count'],
        layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': LABEL_FONT, 'text-size': 13 },
        paint: { 'text-color': darkStyle ? '#e6eefc' : '#2459c0' },
      })
      map.addLayer({
        id: 'pins',
        type: 'symbol',
        source: SRC_PLACES,
        filter: ['all', ['!', ['has', 'point_count']], ['!=', ['get', 'id'], p.selectedId ?? '']],
        layout: {
          'icon-image': ['concat', 'pin-', ['get', 'cat']],
          'icon-anchor': 'bottom',
          'icon-allow-overlap': true,
          'text-field': ['step', ['zoom'], '', 15.5, ['get', 'name']],
          'text-font': LABEL_FONT,
          'text-size': 11.5,
          'text-anchor': 'top',
          'text-offset': [0, 0.3],
          'text-optional': true,
          'text-max-width': 9,
        },
        paint: {
          'text-color': darkStyle ? '#f1f5f4' : '#1f2937',
          'text-halo-color': darkStyle ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.95)',
          'text-halo-width': 1.4,
        },
      })
      map.addLayer({
        id: 'pin-selected',
        type: 'symbol',
        source: SRC_PLACES,
        filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'id'], p.selectedId ?? '']],
        layout: {
          'icon-image': ['concat', 'pin-', ['get', 'cat'], '-selected'],
          'icon-anchor': 'bottom',
          'icon-allow-overlap': true,
          'symbol-z-order': 'source',
        },
      })

      // Layer listeners survive style swaps, so attach them only once.
      if (!handlersAttached.current) {
        handlersAttached.current = true
        map.on('click', 'clusters', onClusterClick)
        map.on('click', 'pins', onPinClick)
        map.on('click', 'pin-selected', onPinClick)
        for (const layer of ['clusters', 'pins', 'pin-selected']) {
          map.on('mouseenter', layer, () => (map.getCanvas().style.cursor = 'pointer'))
          map.on('mouseleave', layer, () => (map.getCanvas().style.cursor = ''))
        }
      }
    }

    void addPinImages(map)
  }

  async function onClusterClick(e: MapLayerMouseEvent) {
    const map = mapRef.current
    const feature = e.features?.[0]
    if (!map || !feature) return
    const source = map.getSource(SRC_PLACES) as GeoJSONSource
    const zoom = await source.getClusterExpansionZoom(feature.properties.cluster_id as number)
    const [lon, lat] = (feature.geometry as GeoJSON.Point).coordinates
    programmaticMove.current = true
    map.easeTo({ center: [lon, lat], zoom: zoom + 0.3, duration: latest.current.reducedMotion ? 0 : 500 })
  }

  function onPinClick(e: MapLayerMouseEvent) {
    if (latest.current.pickLocation) return
    const id = e.features?.[0]?.properties?.id
    if (typeof id === 'string') latest.current.onSelect(id)
  }

  // ---- reactive updates ----------------------------------------------------
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    map.setStyle(MAP_STYLES[props.styleId].style as string | StyleSpecification, { diff: false })
  }, [props.styleId])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    try {
      map.setProjection({ type: props.globe ? 'globe' : 'mercator' })
    } catch {
      /* ignore */
    }
  }, [props.globe])

  useEffect(() => {
    const src = mapRef.current?.getSource(SRC_PLACES) as GeoJSONSource | undefined
    src?.setData(placesToGeoJSON(props.places))
  }, [props.places])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.getLayer('pins')) return
    map.setFilter('pins', ['all', ['!', ['has', 'point_count']], ['!=', ['get', 'id'], props.selectedId ?? '']])
    map.setFilter('pin-selected', ['all', ['!', ['has', 'point_count']], ['==', ['get', 'id'], props.selectedId ?? '']])
  }, [props.selectedId])

  useEffect(() => {
    const map = mapRef.current
    const src = map?.getSource(SRC_ROUTE) as GeoJSONSource | undefined
    src?.setData(routeToGeoJSON(props.route))
    // Google-style: walking routes are dotted, cycling/driving solid.
    if (map?.getLayer('route-line') && !props.landing) {
      const walking = props.route?.mode === 'foot'
      map.setPaintProperty('route-line', 'line-dasharray', walking ? [0.01, 1.9] : [1, 0])
      map.setLayoutProperty('route-line', 'line-cap', 'round')
      map.setPaintProperty('route-casing', 'line-opacity', walking ? 0 : 1)
    }
  }, [props.route, props.landing])

  useEffect(() => {
    const src = mapRef.current?.getSource(SRC_RADIUS) as GeoJSONSource | undefined
    const r = props.radius
    src?.setData(r ? circle(r.lat, r.lon, r.meters) : EMPTY)
  }, [props.radius])

  // setPadding() cancels any camera animation in progress (it is a jumpTo), so only apply it when
  // the values really change, and if the camera is flying, wait until the flight ends.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const want = props.padding
    const apply = () => {
      const cur = map.getPadding()
      if (cur.top !== want.top || cur.bottom !== want.bottom || cur.left !== want.left || cur.right !== want.right) {
        map.setPadding(want)
      }
    }
    if (!map.isMoving()) return apply()
    map.once('moveend', apply)
    return () => {
      map.off('moveend', apply)
    }
  }, [props.padding])

  // User location dot.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (!props.user) {
      userMarker.current?.remove()
      userMarker.current = null
      return
    }
    if (!userMarker.current) {
      const el = document.createElement('div')
      el.className = 'user-dot'
      el.setAttribute('role', 'img')
      el.setAttribute('aria-label', 'Your location')
      userMarker.current = new maplibre.Marker({ element: el }).setLngLat([props.user.lon, props.user.lat]).addTo(map)
    } else {
      userMarker.current.setLngLat([props.user.lon, props.user.lat])
    }
  }, [props.user])

  // Anchor marker for "near <place>" searches.
  useEffect(() => {
    const map = mapRef.current
    anchorMarker.current?.remove()
    anchorMarker.current = null
    if (!map || !props.anchor) return
    const el = document.createElement('div')
    el.className = 'anchor-pin'
    el.title = props.anchor.name
    el.setAttribute('aria-label', `Search centre: ${props.anchor.name}`)
    anchorMarker.current = new maplibre.Marker({ element: el }).setLngLat([props.anchor.lon, props.anchor.lat]).addTo(map)
  }, [props.anchor])

  // Draggable pin for the report form.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (!props.pickLocation) {
      pickMarker.current?.remove()
      pickMarker.current = null
      return
    }
    if (!pickMarker.current) {
      pickMarker.current = new maplibre.Marker({ color: '#ef5350', draggable: true })
        .setLngLat([props.pickLocation.lon, props.pickLocation.lat])
        .addTo(map)
      pickMarker.current.on('dragend', () => {
        const ll = pickMarker.current!.getLngLat()
        latest.current.onPick(ll.lat, ll.lng)
      })
    } else {
      pickMarker.current.setLngLat([props.pickLocation.lon, props.pickLocation.lat])
    }
  }, [props.pickLocation])

  // ---- landing mode: static 3D city with a slow orbit and a dot travelling the route ---------
  const tracer = useRef<maplibre.Marker | null>(null)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    for (const h of HANDLERS) (props.landing ? map[h].disable() : map[h].enable())
    if (map.getLayer('route-line')) {
      map.setPaintProperty('route-line', 'line-color', props.landing ? '#111827' : '#5b8def')
      map.setLayoutProperty('route-dash', 'visibility', props.landing ? 'visible' : 'none')
      if (map.getLayer('route-glow')) map.setPaintProperty('route-glow', 'line-opacity', props.landing ? 0 : 0.35)
    }
    for (const id of styleLabels.current) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', props.landing ? 'none' : 'visible')
    }
    if (!props.landing) return
    spinning.current = false
    let raf = 0
    let last = performance.now()
    const orbit = (t: number) => {
      const dt = t - last
      last = t
      if (!latest.current.reducedMotion && !map.isMoving()) map.setBearing(map.getBearing() + dt * 0.0004)
      raf = requestAnimationFrame(orbit)
    }
    raf = requestAnimationFrame(orbit)
    return () => cancelAnimationFrame(raf)
  }, [props.landing])

  useEffect(() => {
    const map = mapRef.current
    tracer.current?.remove()
    tracer.current = null
    const coords = props.route?.geometry.coordinates
    if (!map || !props.landing || !coords || coords.length < 2) return
    const el = document.createElement('div')
    el.className = 'user-dot'
    tracer.current = new maplibre.Marker({ element: el }).setLngLat(coords[0]).addTo(map)
    // Cumulative lengths so the dot moves at constant speed.
    const seg: number[] = [0]
    for (let i = 1; i < coords.length; i++) {
      const [x1, y1] = coords[i - 1]
      const [x2, y2] = coords[i]
      seg.push(seg[i - 1] + Math.hypot(x2 - x1, (y2 - y1) * 1.0))
    }
    const total = seg[seg.length - 1]
    const DURATION = 24000
    let raf = 0
    const start = performance.now()
    const step = (t: number) => {
      const d = (((t - start) % DURATION) / DURATION) * total
      let i = seg.findIndex((v) => v >= d)
      if (i <= 0) i = 1
      const f = (d - seg[i - 1]) / Math.max(1e-9, seg[i] - seg[i - 1])
      const [x1, y1] = coords[i - 1]
      const [x2, y2] = coords[i]
      tracer.current?.setLngLat([x1 + (x2 - x1) * f, y1 + (y2 - y1) * f])
      if (!latest.current.reducedMotion) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(raf)
      tracer.current?.remove()
      tracer.current = null
    }
  }, [props.landing, props.route])

  // ---- imperative camera API ----------------------------------------------
  useImperativeHandle(ref, () => ({
    flyTo(lat, lon, zoom = 15, opts = {}) {
      const map = mapRef.current
      if (!map) return
      if (map.isMoving()) map.stop()
      spinning.current = false
      programmaticMove.current = true
      const duration = latest.current.reducedMotion ? 0 : opts.duration ?? 1600
      map.flyTo({ center: [lon, lat], zoom, duration, essential: true, curve: 1.6, padding: latest.current.padding })
    },
    fitTo(points, maxZoom = 16.5) {
      const map = mapRef.current
      if (!map || !points.length) return
      spinning.current = false
      programmaticMove.current = true
      const bounds = new maplibre.LngLatBounds()
      points.forEach((pt) => bounds.extend([pt.lon, pt.lat]))
      map.fitBounds(bounds, {
        padding: 60,
        maxZoom,
        duration: latest.current.reducedMotion ? 0 : 1100,
      })
    },
    fitRoute(route) {
      const map = mapRef.current
      if (!map) return
      if (map.isMoving()) map.stop()
      programmaticMove.current = true
      const bounds = new maplibre.LngLatBounds()
      route.geometry.coordinates.forEach((c) => bounds.extend(c))
      map.fitBounds(bounds, {
        padding: 70,
        maxZoom: 17,
        duration: latest.current.reducedMotion ? 0 : 1000,
      })
    },
    zoomBy(delta) {
      const map = mapRef.current
      if (!map) return
      if (map.isMoving()) map.stop()
      spinning.current = false
      map.easeTo({ zoom: map.getZoom() + delta, duration: latest.current.reducedMotion ? 0 : 300 })
    },
    resetNorth() {
      const m = mapRef.current
      if (m?.isMoving()) m.stop()
      m?.easeTo({ bearing: 0, pitch: 0, duration: latest.current.reducedMotion ? 0 : 500 })
    },
    center() {
      const c = mapRef.current?.getCenter()
      return { lat: c?.lat ?? 0, lon: c?.lng ?? 0 }
    },
    zoom() {
      return mapRef.current?.getZoom() ?? 0
    },
    navFrame(lon, lat, heading, zoom, pitch) {
      const map = mapRef.current
      if (!map) return
      spinning.current = false
      programmaticMove.current = true
      // Smoothly turn the camera towards the heading (shortest way round) and ease zoom/pitch.
      const current = map.getBearing()
      const delta = ((heading - current + 540) % 360) - 180
      const z = map.getZoom()
      const pt = map.getPitch()
      map.jumpTo({ center: [lon, lat], bearing: current + delta * 0.1, zoom: z + (zoom - z) * 0.08, pitch: pt + (pitch - pt) * 0.08 })
    },
    navMarker(pos, heading, mode) {
      const map = mapRef.current
      if (!map) return
      if (!pos) {
        navMarkerRef.current?.marker.remove()
        navMarkerRef.current = null
        return
      }
      if (!navMarkerRef.current || navMarkerRef.current.mode !== mode) {
        navMarkerRef.current?.marker.remove()
        const marker = new maplibre.Marker({
          element: navMarkerElement(mode),
          rotationAlignment: 'map',
          pitchAlignment: 'map',
        })
          .setLngLat([pos.lon, pos.lat])
          .addTo(map)
        navMarkerRef.current = { marker, mode }
      }
      navMarkerRef.current.marker.setLngLat([pos.lon, pos.lat]).setRotation(heading)
    },
    exitNav() {
      const map = mapRef.current
      if (!map) return
      if (map.isMoving()) map.stop()
      programmaticMove.current = true
      map.easeTo({ pitch: 0, bearing: 0, duration: latest.current.reducedMotion ? 0 : 800 })
    },
    enterApp(lat: number, lon: number) {
      const map = mapRef.current
      if (!map) return
      if (map.isMoving()) map.stop()
      programmaticMove.current = true
      map.flyTo({
        center: [lon, lat],
        zoom: 14.2,
        pitch: 0,
        bearing: 0,
        duration: latest.current.reducedMotion ? 0 : 2200,
        essential: true,
      })
    },
    showWholeGlobe() {
      const map = mapRef.current
      if (!map) return
      if (map.isMoving()) map.stop()
      programmaticMove.current = true
      map.flyTo({ zoom: 1.6, pitch: 0, bearing: 0, duration: latest.current.reducedMotion ? 0 : 2200 })
    },
  }))

  return (
    // MapLibre's stylesheet forces `position: relative` on the map element, so the absolute
    // positioning lives on a wrapper.
    <div className="beacon-space absolute inset-0">
      <div
        ref={container}
        className="h-full w-full"
        role="application"
        aria-label="Map. Use the search bar to find places; results are also listed in the panel."
      />
    </div>
  )
})

export default BeaconMap
