import type { StyleSpecification } from 'maplibre-gl'

export type MapStyleId = 'light' | 'muted' | 'dark' | 'satellite'
export type MapStyleSetting = MapStyleId | 'auto'

/**
 * Vector styles from OpenFreeMap (free, no API key, OpenStreetMap data, includes 3D buildings).
 * Satellite imagery from Esri World Imagery (attribution required, shown in the map corner).
 */
const OPENFREEMAP = 'https://tiles.openfreemap.org/styles'

const SATELLITE: StyleSpecification = {
  version: 8,
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: {
    imagery: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      maxzoom: 19,
      attribution:
        'Imagery © <a href="https://www.esri.com/" target="_blank" rel="noopener">Esri</a>, Maxar, Earthstar Geographics · Data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
    },
  },
  layers: [{ id: 'imagery', type: 'raster', source: 'imagery' }],
}

export const MAP_STYLES: Record<MapStyleId, { label: string; style: string | StyleSpecification; dark: boolean }> = {
  dark: { label: 'Dark', style: `${OPENFREEMAP}/dark`, dark: true },
  muted: { label: 'Light', style: `${OPENFREEMAP}/positron`, dark: false },
  light: { label: 'Basic', style: `${OPENFREEMAP}/liberty`, dark: false },
  satellite: { label: 'Satellite', style: SATELLITE, dark: true },
}

/**
 * "auto" follows the app theme. HIG (Maps): a muted style lets information-rich content stand out,
 * which suits a results-heavy app, so light mode defaults to the muted style.
 */
export function resolveStyle(setting: MapStyleSetting, darkTheme: boolean): MapStyleId {
  if (setting === 'auto') return darkTheme ? 'dark' : 'muted'
  return setting
}

/** Font stack available on OpenFreeMap's glyph server. */
export const LABEL_FONT = ['Noto Sans Bold']
