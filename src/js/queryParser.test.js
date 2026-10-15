import { describe, expect, it } from 'vitest'
import { parseQuery, describeQuery } from './queryParser.js'

/** @param {string} q */
const p = (q) => parseQuery(q)

describe('parseQuery — "near me" (fixes benchmark E2)', () => {
  it.each([
    'pharmacy near me',
    'Pharmacy Near Me',
    'medical shop near me',
    'chemist near my location',
    'nearby pharmacy',
    'pharmacy nearby',
    'pharmacy near by',
    'find the nearest pharmacy',
    'closest chemist',
    'where is a pharmacy around here',
  ])('%s → pharmacy around the user', (q) => {
    const r = p(q)
    expect(r.category?.id).toBe('pharmacy')
    expect(['me', 'implicit']).toContain(r.anchor.type)
    expect(r.intent).toBe('category')
  })

  it('a bare category means "around me"', () => {
    const r = p('atm')
    expect(r.category?.id).toBe('atm')
    expect(r.anchor.type).toBe('implicit')
  })

  it('maps everyday words to categories', () => {
    expect(p('cash near me').category?.id).toBe('atm')
    expect(p('washroom nearby').category?.id).toBe('toilets')
    expect(p('petrol bunk near me').category?.id).toBe('fuel')
    expect(p('places to eat near me').category?.id).toBe('food')
    expect(p('coffee near me').category?.id).toBe('cafe')
  })
})

describe('parseQuery — "near <place>" (fixes benchmark E6)', () => {
  it('splits category and anchor place, keeping original casing', () => {
    const r = p('pharmacy near MG Road')
    expect(r.category?.id).toBe('pharmacy')
    expect(r.anchor).toEqual({ type: 'place', text: 'MG Road' })
  })

  it.each([
    ['atm on Church Street', 'atm', 'Church Street'],
    ['hospital in Koramangala', 'hospital', 'Koramangala'],
    ['toilets close to Cubbon Park', 'toilets', 'Cubbon Park'],
    ['food at Indiranagar 100 Feet Road', 'food', 'Indiranagar 100 Feet Road'],
  ])('%s', (q, cat, place) => {
    const r = p(q)
    expect(r.category?.id).toBe(cat)
    expect(r.anchor).toEqual({ type: 'place', text: place })
  })

  it('handles a named place near another place', () => {
    const r = p('Starbucks near Church Street')
    expect(r.category).toBeNull()
    expect(r.what).toBe('Starbucks')
    expect(r.anchor).toEqual({ type: 'place', text: 'Church Street' })
    expect(r.intent).toBe('name-near')
  })
})

describe('parseQuery — filters', () => {
  it('detects open now', () => {
    const r = p('open pharmacy near me')
    expect(r.filters.openNow).toBe(true)
    expect(r.category?.id).toBe('pharmacy')
  })
  it('detects 24/7', () => {
    const r = p('24/7 pharmacy near MG Road')
    expect(r.filters.allDay).toBe(true)
    expect(r.anchor.text).toBe('MG Road')
  })
  it('detects wheelchair accessible', () => {
    expect(p('wheelchair accessible toilets nearby').filters.wheelchair).toBe(true)
  })
})

describe('parseQuery — plain places and edge cases', () => {
  it('a plain place name is a place lookup', () => {
    const r = p('MG Road')
    expect(r.intent).toBe('place')
    expect(r.what).toBe('MG Road')
    expect(r.anchor.type).toBe('none')
  })
  it('does not match categories inside other words', () => {
    expect(p('Atmosphere Cafe Bengaluru').category?.id).toBe('cafe')
    expect(p('Batman Street').category).toBeNull()
  })
  it('empty input', () => {
    expect(p('   ').intent).toBe('empty')
  })
  it('"near me" alone has nothing to look for', () => {
    expect(p('near me').intent).toBe('empty')
  })
})

describe('describeQuery', () => {
  it('builds a readable heading', () => {
    expect(describeQuery(p('open pharmacy near me'))).toBe('Pharmacies near you · open now')
    expect(describeQuery(p('atm near MG Road'), 'MG Road, Shivajinagar')).toBe('ATMs & banks near MG Road, Shivajinagar')
  })
})
