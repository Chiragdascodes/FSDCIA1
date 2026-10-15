import { describe, expect, it } from 'vitest'
import { bearing, buildRouteIndex, pointAlong, progress, snapToRoute } from './navigation.js'

// A 2-segment L-shaped route: east 0.01°, then north 0.01° (near the equator ≈ 1.1 km each).
const coords = [
  [0, 0],
  [0.01, 0],
  [0.01, 0.01],
]
const idx = buildRouteIndex(coords)
const route = {
  distance: idx.total,
  duration: 1600,
  mode: 'foot',
  geometry: { type: 'LineString', coordinates: coords },
  steps: [
    { instruction: 'Head east', distance: idx.cum[1], duration: 800, location: [0, 0], maneuver: 'depart', modifier: '' },
    { instruction: 'Turn left', distance: idx.total - idx.cum[1], duration: 800, location: [0.01, 0], maneuver: 'turn', modifier: 'left' },
    { instruction: 'Arrive', distance: 0, duration: 0, location: [0.01, 0.01], maneuver: 'arrive', modifier: '' },
  ],
}

describe('navigation', () => {
  it('measures the route', () => {
    expect(idx.total).toBeGreaterThan(2200)
    expect(idx.total).toBeLessThan(2250)
  })
  it('computes bearings', () => {
    expect(Math.round(bearing([0, 0], [0.01, 0]))).toBe(90)
    expect(Math.round(bearing([0, 0], [0, 0.01]))).toBe(0)
  })
  it('finds the point and heading along the route', () => {
    const p = pointAlong(idx, idx.cum[1] / 2)
    expect(p.lon).toBeCloseTo(0.005, 4)
    expect(Math.round(p.heading)).toBe(90)
    expect(Math.round(pointAlong(idx, idx.total - 10).heading)).toBe(0)
  })
  it('snaps a GPS fix onto the route', () => {
    const s = snapToRoute(idx, { lat: 0.0001, lon: 0.005 }) // ~11 m north of the first segment
    expect(s.along).toBeCloseTo(idx.cum[1] / 2, -1)
    expect(s.offRoute).toBeGreaterThan(5)
    expect(s.offRoute).toBeLessThan(20)
  })
  it('reports the next manoeuvre and remaining time', () => {
    const p = progress(route, idx, 100)
    expect(p.stepIndex).toBe(1)
    expect(p.toNext).toBeCloseTo(idx.cum[1] - 100, 0)
    expect(p.remainingSeconds).toBeLessThan(1600)
    expect(p.arrived).toBe(false)
    expect(progress(route, idx, idx.total - 5).arrived).toBe(true)
  })
})
