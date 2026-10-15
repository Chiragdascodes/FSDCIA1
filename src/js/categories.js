// @ts-check
/**
 * Essential-service categories and the everyday words people use for them.
 *
 * OSM stores places as tags (e.g. `amenity=pharmacy`). Newcomers don't search in tags; they type
 * "medical shop", "chemist" or "cash". This module maps those words to OSM tags so a search like
 * "medical shop near me" becomes an `amenity=pharmacy` query around the user.
 */

/**
 * @typedef {Object} OsmTag
 * @property {string} key
 * @property {string} value
 */

/**
 * @typedef {Object} Category
 * @property {string} id          Stable id used in URLs and state.
 * @property {string} label       Singular label ("Pharmacy").
 * @property {string} plural      Plural label for result headings ("Pharmacies").
 * @property {string} icon        Lucide icon name (resolved in the UI layer).
 * @property {string} color       Pin colour (hex).
 * @property {OsmTag[]} tags      OSM tags that belong to this category.
 * @property {string} nominatim   Special phrase Nominatim understands for bounded category search.
 * @property {string[]} synonyms  Lower-case words/phrases that mean this category.
 */

/** @type {Category[]} */
export const CATEGORIES = [
  {
    id: 'pharmacy',
    label: 'Pharmacy',
    plural: 'Pharmacies',
    icon: 'Pill',
    color: '#10b981',
    tags: [
      { key: 'amenity', value: 'pharmacy' },
      { key: 'healthcare', value: 'pharmacy' },
      { key: 'shop', value: 'chemist' },
    ],
    nominatim: 'pharmacy',
    synonyms: ['pharmacy', 'pharmacies', 'chemist', 'chemists', 'medical shop', 'medical store', 'medical', 'medicals',
      'medicine', 'medicines', 'drugstore', 'drug store', 'apothecary', 'tablets'],
  },
  {
    id: 'hospital',
    label: 'Hospital',
    plural: 'Hospitals & clinics',
    icon: 'Hospital',
    color: '#ef4444',
    tags: [
      { key: 'amenity', value: 'hospital' },
      { key: 'amenity', value: 'clinic' },
      { key: 'amenity', value: 'doctors' },
      { key: 'healthcare', value: 'hospital' },
    ],
    nominatim: 'hospital',
    synonyms: ['hospital', 'hospitals', 'clinic', 'clinics', 'doctor', 'doctors', 'emergency', 'er', 'a&e', 'casualty',
      'health centre', 'health center', 'nursing home', 'urgent care'],
  },
  {
    id: 'atm',
    label: 'ATM',
    plural: 'ATMs & banks',
    icon: 'Banknote',
    color: '#0ea5e9',
    tags: [
      { key: 'amenity', value: 'atm' },
      { key: 'amenity', value: 'bank' },
    ],
    nominatim: 'atm',
    synonyms: ['atm', 'atms', 'cash', 'cash machine', 'cashpoint', 'bank', 'banks', 'money', 'withdraw', 'withdraw cash'],
  },
  {
    id: 'toilets',
    label: 'Toilet',
    plural: 'Toilets',
    icon: 'Toilet',
    color: '#8b5cf6',
    tags: [{ key: 'amenity', value: 'toilets' }],
    nominatim: 'toilets',
    synonyms: ['toilet', 'toilets', 'washroom', 'washrooms', 'restroom', 'restrooms', 'bathroom', 'loo', 'wc',
      'public toilet', 'lavatory'],
  },
  {
    id: 'food',
    label: 'Food',
    plural: 'Places to eat',
    icon: 'UtensilsCrossed',
    color: '#f97316',
    tags: [
      { key: 'amenity', value: 'restaurant' },
      { key: 'amenity', value: 'fast_food' },
      { key: 'amenity', value: 'food_court' },
    ],
    nominatim: 'restaurant',
    synonyms: ['food', 'restaurant', 'restaurants', 'eat', 'place to eat', 'places to eat', 'dinner', 'lunch',
      'breakfast', 'fast food', 'biryani', 'meal', 'meals', 'dhaba', 'hotel to eat', 'mess', 'canteen'],
  },
  {
    id: 'cafe',
    label: 'Café',
    plural: 'Cafés',
    icon: 'Coffee',
    color: '#a16207',
    tags: [{ key: 'amenity', value: 'cafe' }],
    nominatim: 'cafe',
    synonyms: ['cafe', 'cafes', 'café', 'cafés', 'coffee', 'coffee shop', 'tea', 'chai', 'tea stall', 'bakery'],
  },
  {
    id: 'grocery',
    label: 'Groceries',
    plural: 'Grocery stores',
    icon: 'ShoppingBasket',
    color: '#16a34a',
    tags: [
      { key: 'shop', value: 'supermarket' },
      { key: 'shop', value: 'convenience' },
      { key: 'shop', value: 'grocery' },
    ],
    nominatim: 'supermarket',
    synonyms: ['grocery', 'groceries', 'supermarket', 'supermarkets', 'kirana', 'convenience store', 'general store',
      'provision store', 'store', 'mart'],
  },
  {
    id: 'fuel',
    label: 'Fuel',
    plural: 'Fuel stations',
    icon: 'Fuel',
    color: '#eab308',
    tags: [{ key: 'amenity', value: 'fuel' }],
    nominatim: 'fuel',
    synonyms: ['fuel', 'petrol', 'petrol pump', 'petrol bunk', 'gas station', 'gas', 'diesel', 'filling station'],
  },
  {
    id: 'police',
    label: 'Police',
    plural: 'Police stations',
    icon: 'ShieldAlert',
    color: '#2563eb',
    tags: [{ key: 'amenity', value: 'police' }],
    nominatim: 'police',
    synonyms: ['police', 'police station', 'cops', 'thana', 'police help'],
  },
  {
    id: 'ev',
    label: 'EV charging',
    plural: 'EV chargers',
    icon: 'PlugZap',
    color: '#14b8a6',
    tags: [{ key: 'amenity', value: 'charging_station' }],
    nominatim: 'charging station',
    synonyms: ['ev', 'ev charging', 'charging', 'charging station', 'charger', 'ev charger', 'electric charging'],
  },
]

/** @type {Map<string, Category>} */
const BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]))

/**
 * @param {string} id
 * @returns {Category | undefined}
 */
export function getCategory(id) {
  return BY_ID.get(id)
}

/**
 * Synonyms sorted longest-first so "medical shop" wins over "medical".
 * @type {{ phrase: string, category: Category }[]}
 */
const PHRASES = CATEGORIES.flatMap((category) => category.synonyms.map((phrase) => ({ phrase, category }))).sort(
  (a, b) => b.phrase.length - a.phrase.length,
)

/**
 * Finds the category a piece of text refers to, if any.
 * Matches whole words only, so "atm" does not match inside "Atmosphere Café".
 *
 * @param {string} text
 * @returns {Category | null}
 */
export function findCategory(text) {
  const clean = normalise(text)
  if (!clean) return null
  for (const { phrase, category } of PHRASES) {
    if (clean === phrase) return category
  }
  for (const { phrase, category } of PHRASES) {
    if (new RegExp(`(^|\\s)${escapeRegExp(phrase)}(\\s|$)`).test(clean)) return category
  }
  return null
}

/**
 * Which category does a set of OSM tags belong to?
 * @param {Record<string, string> | undefined} tags
 * @returns {Category | null}
 */
export function categoryFromTags(tags) {
  if (!tags) return null
  for (const category of CATEGORIES) {
    if (category.tags.some((t) => tags[t.key] === t.value)) return category
  }
  return null
}

/**
 * @param {string} text
 * @returns {string}
 */
export function normalise(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}&\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * @param {string} s
 * @returns {string}
 */
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
