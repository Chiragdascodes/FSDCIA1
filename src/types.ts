// Shared TypeScript types. The data shapes are defined (with JSDoc) in the plain-JS modules in
// src/js, and re-exported here so the TSX components get full type checking.

export type Place = import('./js/api.js').Place
export type Address = import('./js/api.js').Address
export type Route = import('./js/api.js').Route
export type RouteStep = import('./js/api.js').RouteStep
export type Category = import('./js/categories.js').Category
export type ParsedQuery = import('./js/queryParser.js').ParsedQuery
export type Settings = import('./js/storage.js').Settings
export type SavedPlace = import('./js/storage.js').SavedPlace
export type OpenStatus = import('./js/hours.js').OpenStatus
export type TravelMode = 'foot' | 'bike' | 'car'

export interface LatLon {
  lat: number
  lon: number
}

/** Where a search is centred and why. */
export interface SearchAnchor extends LatLon {
  /** "me" = GPS, "city" = fallback city, "place" = a place the user named, "map" = map centre. */
  kind: 'me' | 'city' | 'place' | 'map'
  label: string
}

/** The panel stack (one sheet at a time, HIG Sheets). */
export type View =
  | { name: 'home' }
  | { name: 'disambiguate' }
  | { name: 'results' }
  | { name: 'place'; id: string }
  | { name: 'directions'; id: string }
  | { name: 'report'; id: string | null }
  | { name: 'saved' }
  | { name: 'reports' }
  | { name: 'settings' }
  | { name: 'shortcuts' }
