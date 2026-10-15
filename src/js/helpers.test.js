import { afterEach, describe, expect, it, vi } from 'vitest'
import { bboxAround, compassDirection, distanceMeters, formatDistance, formatDuration, isValidLatLon } from './geo.js'
import { getOpenStatus, getWeekSchedule, isValidHours } from './hours.js'
import { validateReport, validateSearch, validateSettings } from './validation.js'
import { rankAnchors } from './disambiguate.js'
import { ApiError, describeError, describeStep, fetchJSON, mergePlaces } from './api.js'
import { findCategory, categoryFromTags } from './categories.js'

const MG_ROAD_BLR = { lat: 12.9756, lon: 77.6066 }
const CUBBON_PARK = { lat: 12.9763, lon: 77.5929 }

describe('geo', () => {
  it('measures distance with haversine', () => {
    const d = distanceMeters(MG_ROAD_BLR, CUBBON_PARK)
    expect(d).toBeGreaterThan(1300)
    expect(d).toBeLessThan(1600)
  })
  it('formats distances', () => {
    expect(formatDistance(347)).toBe('350 m')
    expect(formatDistance(1234)).toBe('1.2 km')
    expect(formatDistance(15400)).toBe('15 km')
    expect(formatDistance(200, 'imperial')).toBe('660 ft')
    expect(formatDistance(500, 'imperial')).toBe('0.3 mi')
  })
  it('formats durations', () => {
    expect(formatDuration(30)).toBe('1 min')
    expect(formatDuration(4 * 60)).toBe('4 min')
    expect(formatDuration(65 * 60)).toBe('1 h 05 min')
  })
  it('bbox contains the radius', () => {
    const b = bboxAround(MG_ROAD_BLR, 1000)
    expect(b.north - b.south).toBeCloseTo(0.018, 2)
    expect(b.west).toBeLessThan(MG_ROAD_BLR.lon)
  })
  it('gives a compass direction', () => {
    expect(compassDirection({ lat: 0, lon: 0 }, { lat: 1, lon: 0 })).toBe('N')
    expect(compassDirection({ lat: 0, lon: 0 }, { lat: 0, lon: -1 })).toBe('W')
  })
  it('validates coordinates', () => {
    expect(isValidLatLon(12.9, 77.6)).toBe(true)
    expect(isValidLatLon(95, 0)).toBe(false)
    expect(isValidLatLon(null, 0)).toBe(false)
  })
})

describe('opening hours (fixes benchmark E3)', () => {
  // Thursday 15 Oct 2026, local time.
  const at = (h, m = 0) => new Date(2026, 9, 15, h, m)

  it('reads the exact tag shown raw on openstreetmap.org', () => {
    const s = getOpenStatus('PH,Mo-Su 08:00-23:30', at(10))
    expect(s.state).toBe('open')
    expect(s.label).toBe('Open · closes 23:30')
  })
  it('warns when closing soon', () => {
    const s = getOpenStatus('Mo-Su 08:00-23:30', at(23, 10))
    expect(s.closingSoon).toBe(true)
    expect(s.label).toBe('Closes soon · 23:30')
  })
  it('says when a closed place opens', () => {
    expect(getOpenStatus('Mo-Su 12:30-15:00,19:30-22:30', at(10)).label).toBe('Closed · opens 12:30')
    expect(getOpenStatus('Mo-Su 09:00-18:00', at(20)).label).toBe('Closed · opens tomorrow 09:00')
  })
  it('handles 24/7', () => {
    const s = getOpenStatus('24/7', at(3))
    expect(s.allDay).toBe(true)
    expect(s.label).toBe('Open 24 hours')
  })
  it('is honest when hours are missing or invalid', () => {
    expect(getOpenStatus(undefined).state).toBe('unknown')
    expect(getOpenStatus('call us lol').label).toBe('Hours unknown')
    expect(isValidHours('call us lol')).toBe(false)
  })
  it('builds a 7-day table starting today', () => {
    const week = getWeekSchedule('Mo-Fr 09:00-18:00; Sa 10:00-14:00', at(10))
    expect(week).toHaveLength(7)
    expect(week?.[0]).toMatchObject({ day: 'Thu', isToday: true, ranges: ['09:00–18:00'] })
    expect(week?.[2]).toMatchObject({ day: 'Sat', ranges: ['10:00–14:00'] })
    expect(week?.[3]).toMatchObject({ day: 'Sun', ranges: [] })
  })
})

describe('validation', () => {
  it('search', () => {
    expect(validateSearch('').valid).toBe(false)
    expect(validateSearch('a').errors.query).toMatch(/at least 2/)
    expect(validateSearch('???').valid).toBe(false)
    expect(validateSearch('pharmacy near me').valid).toBe(true)
  })

  const good = {
    type: 'wrong-hours',
    placeName: 'Apollo Pharmacy',
    details: 'It is open 24 hours now, the sign at the door says so.',
    contact: '',
    lat: 12.97,
    lon: 77.6,
    consent: true,
  }
  it('accepts a good report', () => {
    expect(validateReport(good)).toEqual({ valid: true, errors: {} })
  })
  it('flags every bad field with a message', () => {
    const r = validateReport({ type: 'x', placeName: '', details: 'short', contact: 'not-an-email', lat: null, lon: null, consent: false })
    expect(Object.keys(r.errors).sort()).toEqual(['consent', 'contact', 'details', 'location', 'placeName', 'type'])
  })
  it('accepts email or phone as contact', () => {
    expect(validateReport({ ...good, contact: 'me@example.com' }).valid).toBe(true)
    expect(validateReport({ ...good, contact: '+91 98450 12345' }).valid).toBe(true)
  })
  it('rejects low-effort details', () => {
    expect(validateReport({ ...good, details: 'aaaaaaaaaaaaaaaaaaaa' }).errors.details).toBeDefined()
  })
  it('settings', () => {
    const ok = { radius: 1500, units: 'metric', mode: 'foot', fallbackCity: 'bengaluru' }
    expect(validateSettings(ok, ['bengaluru']).valid).toBe(true)
    expect(validateSettings({ ...ok, radius: 50 }, ['bengaluru']).errors.radius).toBeDefined()
    expect(validateSettings({ ...ok, fallbackCity: 'atlantis' }, ['bengaluru']).errors.fallbackCity).toBeDefined()
  })
})

/** @param {string} id @param {string} name @param {string} city @param {number} lat @param {number} lon */
const place = (id, name, city, lat, lon) => ({
  id, osmType: 'way', osmId: 1, name, lat, lon, categoryId: null, kind: 'Road', tags: {},
  address: { street: '', area: '', city, state: '', postcode: '', country: 'India' }, source: 'photon', bbox: null,
})

describe('disambiguation (fixes benchmark E6)', () => {
  const user = { lat: 12.9716, lon: 77.5946 } // Bengaluru
  const blr = place('way/1', 'MG Road', 'Bengaluru', 12.9756, 77.6066)
  const blr2 = place('way/2', 'MG Road', 'Bengaluru', 12.9752, 77.6101) // another segment of the same road
  const kolkata = place('way/3', 'MG Road', 'Kolkata', 22.578, 88.36)
  const mumbai = place('way/4', 'MG Road', 'Mumbai', 18.94, 72.83)
  const kochi = place('way/5', 'MG Road', 'Kochi', 9.97, 76.28)

  it('ranks the nearest first and auto-picks the clear winner', () => {
    const r = rankAnchors([kolkata, mumbai, blr, blr2, kochi], user)
    expect(r.options.map((o) => o.address.city)).toEqual(['Bengaluru', 'Kochi', 'Mumbai', 'Kolkata'])
    expect(r.auto?.address.city).toBe('Bengaluru')
  })
  it('asks when two candidates are similarly close', () => {
    const near1 = place('way/6', 'Church Street', 'Bengaluru', 12.975, 77.605)
    const near2 = place('way/7', 'Church Street', 'Bengaluru', 12.93, 77.62)
    const r = rankAnchors([near1, near2], user)
    expect(r.auto).toBeNull()
    expect(r.options).toHaveLength(2)
  })
  it('asks when the user location is unknown', () => {
    expect(rankAnchors([kolkata, mumbai], null).auto).toBeNull()
  })
})

describe('categories', () => {
  it('finds categories by synonym, longest first', () => {
    expect(findCategory('medical shop')?.id).toBe('pharmacy')
    expect(findCategory('Atmosphere')).toBeNull()
  })
  it('maps OSM tags back to categories', () => {
    expect(categoryFromTags({ amenity: 'clinic' })?.id).toBe('hospital')
    expect(categoryFromTags({ shop: 'supermarket' })?.id).toBe('grocery')
    expect(categoryFromTags({ amenity: 'waste_basket' })).toBeNull()
  })
})

describe('api', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('parses JSON responses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: 1 }), { status: 200 })))
    await expect(fetchJSON('https://x.test/a', { service: 'Test', cacheMinutes: 0 })).resolves.toEqual({ ok: 1 })
  })
  it('maps 429 to a rate-limit error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('busy', { status: 429 })))
    const err = await fetchJSON('https://x.test/b', { service: 'Test', cacheMinutes: 0 }).catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.kind).toBe('rate-limit')
    expect(describeError(err)).toMatch(/busy/)
  })
  it('maps invalid JSON to a parse error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<xml/>', { status: 200 })))
    const err = await fetchJSON('https://x.test/c', { service: 'Test', cacheMinutes: 0 }).catch((e) => e)
    expect(err.kind).toBe('parse')
  })
  it('times out slow requests', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_url, init) => new Promise((_res, rej) => init.signal.addEventListener('abort', () => rej(new Error('aborted'))))),
    )
    const err = await fetchJSON('https://x.test/d', { service: 'Slow', timeoutMs: 20, cacheMinutes: 0 }).catch((e) => e)
    expect(err.kind).toBe('timeout')
  })
  it('maps network failures', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))))
    const err = await fetchJSON('https://x.test/e', { service: 'Net', cacheMinutes: 0 }).catch((e) => e)
    expect(err.kind).toBe('network')
  })
  it('merges fast and rich results by OSM id', () => {
    const a = { ...place('node/1', 'Apollo', 'Bengaluru', 1, 1), tags: { amenity: 'pharmacy' } }
    const b = { ...place('node/1', '', '', 1, 1), tags: { opening_hours: '24/7' } }
    const c = place('node/2', 'Only in Overpass', '', 1, 1)
    const merged = mergePlaces([a], [b, c])
    expect(merged).toHaveLength(2)
    expect(merged[0].tags).toEqual({ amenity: 'pharmacy', opening_hours: '24/7' })
    expect(merged[0].name).toBe('Apollo')
  })
  it('describes OSRM steps in plain English', () => {
    expect(describeStep({ name: 'Church Street', maneuver: { type: 'turn', modifier: 'left' } })).toBe('Turn left onto Church Street')
    expect(describeStep({ name: '', maneuver: { type: 'arrive' } })).toBe('Arrive at destination')
    expect(describeStep({ name: 'MG Road', maneuver: { type: 'depart', bearing_after: 90 } })).toBe('Head east on MG Road')
  })
})
