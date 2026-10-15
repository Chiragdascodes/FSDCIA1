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
}

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

  // ---- create the map once -------------------------------------------------
  useEffect(() => {
    if (!container.current) return
    const p = latest.current
    const map = new maplibre.Map({
      container: container.current,
      style: MAP_STYLES[p.styleId].style as string | StyleSpecification,
      center: [78.9, 20.6],
      zoom: window.innerWidth < 768 ? 0.9 : 1.6,
      attributionControl: { compact: true },
      maxPitch: 70,
      canvasContextAttributes: { antialias: true },
    })
    mapRef.current = map

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

    map.on('moveend', () => {
      const c = map.getCenter()
      latest.current.onMoveEnd({ lat: c.lat, lon: c.lng }, map.getZoom(), !programmaticMove.current && !spinning.current)
      programmaticMove.current = false
    })

    // Long-press / right-click: "What's here?" + report location.
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

    if (!map.getSource(SRC_RADIUS)) {
      map.addSource(SRC_RADIUS, { type: 'geojson', data: p.radius ? circle(p.radius.lat, p.radius.lon, p.radius.meters) : EMPTY })
      map.addLayer({
        id: 'radius-fill',
        type: 'fill',
        source: SRC_RADIUS,
        paint: { 'fill-color': '#10b981', 'fill-opacity': 0.06 },
      })
      map.addLayer({
        id: 'radius-line',
        type: 'line',
        source: SRC_RADIUS,
        paint: { 'line-color': '#10b981', 'line-width': 1.5, 'line-opacity': 0.6, 'line-dasharray': [2, 2] },
      })
    }

    if (!map.getSource(SRC_ROUTE)) {
      map.addSource(SRC_ROUTE, { type: 'geojson', data: routeToGeoJSON(p.route) })
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
          'line-color': '#0a84ff',
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 3.5, 18, 9],
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
          'circle-stroke-color': '#10b981',
        },
      })
      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: SRC_PLACES,
        filter: ['has', 'point_count'],
        layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': LABEL_FONT, 'text-size': 13 },
        paint: { 'text-color': darkStyle ? '#e5f5ef' : '#065f46' },
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
    const src = mapRef.current?.getSource(SRC_ROUTE) as GeoJSONSource | undefined
    src?.setData(routeToGeoJSON(props.route))
  }, [props.route])

  useEffect(() => {
    const src = mapRef.current?.getSource(SRC_RADIUS) as GeoJSONSource | undefined
    const r = props.radius
    src?.setData(r ? circle(r.lat, r.lon, r.meters) : EMPTY)
  }, [props.radius])

  useEffect(() => {
    mapRef.current?.setPadding(props.padding)
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
      pickMarker.current = new maplibre.Marker({ color: '#f97316', draggable: true })
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

  // ---- imperative camera API ----------------------------------------------
  useImperativeHandle(ref, () => ({
    flyTo(lat, lon, zoom = 15, opts = {}) {
      const map = mapRef.current
      if (!map) return
      spinning.current = false
      programmaticMove.current = true
      const duration = latest.current.reducedMotion ? 0 : opts.duration ?? 1600
      map.flyTo({ center: [lon, lat], zoom, duration, essential: true, curve: 1.6 })
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
      programmaticMove.current = true
      const bounds = new maplibre.LngLatBounds()
      route.geometry.coordinates.forEach((c) => bounds.extend(c))
      map.fitBounds(bounds, { padding: 70, maxZoom: 17, duration: latest.current.reducedMotion ? 0 : 1000 })
    },
    zoomBy(delta) {
      const map = mapRef.current
      if (!map) return
      spinning.current = false
      map.easeTo({ zoom: map.getZoom() + delta, duration: latest.current.reducedMotion ? 0 : 300 })
    },
    resetNorth() {
      mapRef.current?.easeTo({ bearing: 0, pitch: 0, duration: latest.current.reducedMotion ? 0 : 500 })
    },
    center() {
      const c = mapRef.current?.getCenter()
      return { lat: c?.lat ?? 0, lon: c?.lng ?? 0 }
    },
    zoom() {
      return mapRef.current?.getZoom() ?? 0
    },
    showWholeGlobe() {
      const map = mapRef.current
      if (!map) return
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
