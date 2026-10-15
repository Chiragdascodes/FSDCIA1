# Design Spec — "Beacon" (working name)

> **Status:** DRAFT, waiting for approval. No code written yet.
> **Assignment:** see [QUESTION_PAPER.md](QUESTION_PAPER.md). **Benchmark research:** see [OpenStreetMap-Analysis.md](OpenStreetMap-Analysis.md).
> **Evidence screenshots:** [docs/evidence/](docs/evidence/) (all taken on openstreetmap.org, 2026-10-15).

**One line:** a location-aware "find essentials near me" web app built on OpenStreetMap data. You type
"pharmacy near me" or "ATM near MG Road", and you get the right place in *your* city: sorted by
distance, with Open-now badges, readable place cards and walking directions. It all sits on a 3D globe
that flattens into a 2D map, styled with Apple-style Liquid Glass.

---

## 1. Target users

| | |
|---|---|
| **Primary group** | Newcomers to a city: students who just moved (hostels, PGs), interns, travellers. |
| **Persona** | *Ananya, 19, first-year student, moved to Bengaluru 2 weeks ago.* Doesn't know the area names yet, uses her phone, has a fever late at night and needs **the nearest open pharmacy** and a way to walk there. |
| **Their jobs-to-be-done** | Find the nearest {pharmacy, hospital, ATM, toilet, food, police, fuel…}; know if it's open **now**; know how far it is; get there. |
| **Context** | Mostly mobile, often in a hurry, sometimes on slow data, unfamiliar with local place names. |

## 2. Benchmark analysis (Part I-i)

**Workflow chosen:** OSM's *Search → Place details → Directions* flow for everyday places.

**Existing OSM features in this workflow:** Nominatim search box, "Where is this?", results list,
element page (tag table), Query Features (?), Directions (OSRM/Valhalla/GraphHopper), right-click
"Directions from/to here", Share, Layers. (Full feature inventory: OpenStreetMap-Analysis.md §5.)

### Observations (own testing, with evidence)

| # | Observation | Evidence |
|---|---|---|
| **E1** | Searching "pharmacy near MG Road, Bengaluru" works, but each result is a **~25-word address chain** ("…Bengaluru Central City Corporation, Bengaluru, Bangalore North, Bengaluru Urban, Karnataka, 560025, India"). No **distance**, no **open/closed** status, no sorting by nearness, no filters. The map jumps to zoom 19 on the first result. | `E1-search-results-long-addresses.jpg` |
| **E2** | **"pharmacy near me" ignores where you are.** With the map centred on Bengaluru (the URL even includes the Bengaluru bounding box), results came from **Sicily, Italy and Venezuela**. "near me" is treated as text, not as your location. | `E2-near-me-returns-italy.jpg` |
| **E3** | Place pages show **raw OSM tags**. Opening hours appear as `PH,Mo-Su 08:00-23:30`, which a non-mapper can't read, and nothing tells you whether the place is open *right now*. | `E3-raw-opening-hours-tag.jpg` |
| **E4** | A place page's only actions are **"Download XML"** and **"History"**. There's no Directions, Call, Website or Share button. To route there you must use the right-click menu or retype the place in the Directions form. | `E4-place-page-no-actions.jpg` |
| **E5** | "Query features" mixes useful places with noise: **"Waste Basket #11117253952"**, footpaths, admin boundaries, unnamed IDs. There are no category filters. | `E5-query-features-noise.jpg` |
| **E6** | *(Observed by the student, reproduced.)* **Ambiguous place names resolve to the wrong city.** From an India-wide view, "pharmacy near MG Road" returned pharmacies in **Serampore (West Bengal)** and **Mumbai**, and none in Bengaluru. Several results weren't even on an "MG Road". There's no "which MG Road did you mean?" step, and no ranking by distance from the user. | `E6-ambiguous-mg-road-wrong-cities.jpg` |

### Measured data (supports the problem)
- **Data completeness:** of 233 amenities around MG Road/Church Street, Bengaluru, only **17 (7%) have `opening_hours`**, 24 have a phone and 20 have wheelchair info. So the app must show "Hours unknown" honestly and must not guess.
- **Service speed:** Nominatim answered a bounded category search in **~1.5 s**, while the public Overpass API took **29–43 s** and sometimes failed. This drives the progressive-loading design in §4.6.

## 3. Problem statement (Part I-ii)

> **Newcomers to an unfamiliar city cannot reliably find the nearest essential service that is open
> right now using OpenStreetMap.** The search doesn't understand "near me" (E2), resolves ambiguous
> street names to the wrong city (E6), lists results without distance or opening status (E1, E3), and
> doesn't offer directions from a place (E4). The user ends up checking several results, scrolling raw
> tags and re-entering the destination. In urgent cases (medicine at night, cash, a toilet) that costs
> time and can send them to a closed shop or the wrong city.

**Impact:** wasted time, wrong trips, lower trust in OSM. Non-mappers abandon OSM for proprietary maps
even though OSM has the data.

## 4. Proposed solution (Part I-iii)

### 4.1 Core features (each solves an observation)

| ID | Feature | Solves |
|---|---|---|
| **F1** | **Smart query understanding.** A parser understands `"<what> near me"`, `"<what> nearby"`, `"<what> near <place>"`, `"<what> in <area>"` and plain `"<place>"`. A synonyms dictionary maps everyday words to OSM tags: *chemist / medical / medicine* → `amenity=pharmacy`, *cash* → `atm`, *washroom* → `toilets`, *petrol* → `fuel`, and so on. | E2, E6 |
| **F2** | **Location-anchored search.** "near me" uses browser geolocation; if location is denied, it uses a chosen city (default **Bengaluru**). Every search is biased toward, and bounded around, the user's location, never the whole world. | E2, E6 |
| **F3** | **"Which one did you mean?" cards.** When `<place>` is ambiguous (e.g. "MG Road"), show Google-Maps-style cards: **name, sub-address (locality · city · state), distance from you**, nearest first. Tapping one runs the category search around *that* point. If one match is clearly nearest, it's chosen automatically and a chip lets you switch. | E6 |
| **F4** | **Category quick chips + results list.** Chips for Pharmacy, Hospital, ATM, Toilets, Food, Fuel, Police… The results show **name, short address, distance, walk time, and an Open-now / Closes 23:30 / Hours unknown badge**, sorted by distance, with filters for *Open now*, *Wheelchair*, *24/7* and a *Radius* slider. | E1, E5 |
| **F5** | **Readable place card** (a bottom sheet on mobile, a floating panel on desktop): plain-language hours table (today highlighted), **Directions · Call · Website · Share · Copy address**, accessibility info, "Last updated on OSM", and "View / fix on OpenStreetMap". | E3, E4 |
| **F6** | **One-tap directions:** walking, driving or cycling route via OSRM drawn on the map, with ETA, distance and a step list. You can start from your location or from the picked place. | E4 |
| **F7** | **Report wrong / missing info form** (validated): category, description, optional contact, and a "pin location" drag. It's saved locally, and the user can open a pre-filled OSM Note in a new tab. It never writes to the live OSM map silently. | Closes the loop back to OSM |
| **F8** | **Saved places + recent searches** (localStorage), with a "Clear history" control (privacy, per Apple HIG). | Repeat use |

### 4.2 "Wow" layer (presentation, the user's priority)
- **3D globe → 2D map** (MapLibre GL v5 globe projection). The app opens on a slowly rotating globe, then **flies to your location** and flattens into a street map. There are 3D buildings when zoomed in and the camera can be tilted.
- **Map styles picker** (like the reference design): **Light · Dark · Muted · Satellite**, with thumbnails. The style follows the system light/dark setting by default.
- **Clustered markers** that expand as you zoom (HIG Maps guidance). Category-coloured pins; the selected pin gets an outline and an animated pulse.
- **Liquid Glass UI** on the functional layer only (search bar, chips, sheet, controls), described in §6.
- **Smooth, purposeful motion:** sheet detents (peek / half / full), spring animations, skeleton loaders. All motion is turned off when the system's reduce-motion setting is on.
- **Keyboard shortcuts:** `/` focuses search, `Esc` closes, `↑↓ Enter` move through results, `L` locates me. Shown in a "?" shortcuts sheet.
- **Installable PWA** (stretch goal): app icon, offline shell, last results cached.

### 4.3 How it differs from the benchmark

| Benchmark (openstreetmap.org) | Beacon |
|---|---|
| "near me" = text; results worldwide (E2) | "near me" = your GPS location; results within your radius |
| Ambiguous names silently resolve to any city (E6) | Disambiguation cards with sub-address + distance, nearest first |
| No distance, no sorting (E1) | Distance + walk time, sorted nearest-first |
| Raw `opening_hours` syntax (E3) | "Open now · closes 23:30", weekly table, "Hours unknown" when missing |
| Place actions: Download XML / History (E4) | Directions · Call · Website · Share · Copy |
| Query features: unfiltered list incl. waste baskets (E5) | Category chips + filters (Open now, Wheelchair, 24/7, Radius) |
| Mapper-oriented sidebar UI | Consumer-oriented, mobile-first bottom sheet, globe, Liquid Glass |

### 4.4 Feature → technology mapping (Part I-iii / Part III-2)

| Feature | HTML5 | Tailwind CSS | JavaScript / TS |
|---|---|---|---|
| Search bar + suggestions | `<form role="search">`, `<input type="search">`, `<datalist>`-style listbox with ARIA `combobox` | glass utilities, `focus-visible:` rings, responsive widths `sm:`/`md:` | debounced `input` event, query parser, Photon fetch, keyboard navigation |
| "Which one?" cards | `<ul role="listbox">`, `<button>` per card | card grid, `hover:`/`active:` states | Nominatim fetch, distance (Haversine), sorting |
| Category chips | `<fieldset>` + `<input type="radio">` chips | `peer-checked:` styles, horizontal scroll snap | `change` event triggers search |
| Results list | `<ol>`, `<article>` per result, `<time>` | skeleton `animate-pulse`, badges | opening-hours parsing, filter/sort, empty state |
| Map | `<div role="application" aria-label>` | full-bleed, safe-area insets | MapLibre GL (globe, styles, clusters), `click`/`moveend` events |
| Place sheet | `<dialog>` / `<section aria-modal="false">` | detent heights, `backdrop-blur`, transitions | pointer drag events, focus management |
| Directions | `<ol>` of steps, `<meter>`/`<data>` for distance | route summary card | OSRM fetch, GeoJSON line layer |
| Report form | `<form novalidate>`, `required`, `minlength`, `pattern`, `<select>`, `<textarea>`, `aria-invalid`, `aria-describedby` | error/success styles, toasts | custom validation module, `submit`/`blur` events, localStorage save |
| Settings | `<input type="range">` radius, `<select>` units | toggles | persisted preferences |
| Geolocation | — | permission banner | `navigator.geolocation.watchPosition`, error handling |
| Offline banner | `<output aria-live>` | banner styles | `online`/`offline` window events |

### 4.5 Part II requirement mapping

| Requirement (marks) | Where it's met |
|---|---|
| **≥3 meaningful JS events (5)** | (1) `input` (debounced) → live suggestions; (2) `submit` → parse and search; (3) map `click` on a pin → open place card; (4) map `moveend` → "Search this area" button; (5) `keydown` shortcuts; (6) `pointerdown/move/up` sheet drag; (7) `online`/`offline`; (8) geolocation success/error callbacks. |
| **Form with validation + feedback (5)** | F7 Report form (required fields, length, phone/email pattern, location must be set) with inline errors, `aria-invalid`, success toast. The search form validates empty/too-short queries; the settings form validates the radius range. |
| **Fetch API + JSON (5)** | Photon (suggestions), Nominatim (geocode / reverse / bounded category), Overpass (POIs + tags), OSRM (routes). All use `fetch` + `response.json()`, typed parsing, and normalisation into one `Place` JSON shape. |
| **Errors, loading, empty states (5)** | Skeleton loaders; "Getting your location…"; progressive "Found 8 quickly, loading more details…"; empty: "No pharmacies within 1 km — expand to 3 km?"; errors: location denied → choose a city; API timeout → automatic fallback + Retry; offline banner; rate-limit message. |
| **Must solve the problem** | F1–F6 directly fix E1–E6 (§4.3). It isn't a reskin. |

### 4.6 Data flow & resilience (the engineering story)

```
user query ──► parseQuery() ──► {category, anchor: "me" | "<place>" | none}
                                     │
       anchor = me ─► geolocation (fallback city) ─┐
       anchor = place ─► Nominatim/Photon biased to user ─► ambiguous? ─► "Which one?" cards
                                                   ▼
                            search around anchor (radius r)
            ┌──────────────────────────────┴───────────────────────────┐
   FAST: Nominatim bounded category (~1.5 s)       RICH: Overpass (tags: hours, phone, wheelchair)
   → show results immediately                      → enrich/merge when it arrives (can take 30 s+)
            └──────────────► normalise to Place[] ◄────────────────────┘
                     → distance sort → opening-hours status → filters → list + pins
```
- `AbortController` timeouts on every request; races Overpass mirrors; falls back gracefully.
- Results cached per (category, rounded location, radius) in `sessionStorage`.
- Usage-policy compliant: no keystroke autocomplete on Nominatim (**Photon** is used for type-ahead), at most 1 Nominatim request/second, debounced inputs, attribution always visible.

## 5. Information architecture & layout

**Mobile (primary, ≤ 768 px)**
```
┌─────────────────────────────┐
│ ◉ Beacon   [🔍 Search…   ⌘] │  ← glass search bar (top, safe-area aware)
│ [💊][🏥][🏧][🚻][🍽][⛽] →    │  ← glass category chips (scroll)
│                             │
│        MAP / GLOBE          │      [◐ styles]
│     (clusters, pins)        │      [➤ locate]
│                             │      [+][−]
│ ┌─────────────────────────┐ │
│ │ ── grabber ──           │ │  ← glass bottom sheet: peek / half / full
│ │ 8 pharmacies · 1 km  ⚙︎ │ │     results → place card → directions
│ │ Apollo · 350 m · Open   │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```
**Desktop (≥ 1024 px):** floating glass sidebar on the left (results / place card / directions),
search bar at the top of the sidebar, chips under it, map controls on the right, style picker as a
popover (like the reference design), avatar slot replaced by a "Saved" button (no auth).

**Screens/states:** Onboarding (globe + "Use my location" / "Choose a city") → Home (chips) →
Suggestions → Which-one cards → Results (loading / list / empty / error) → Place card → Directions →
Report form → Saved & recent → Settings (units, radius, theme, map style) → Shortcuts help.

## 6. Visual design system — Liquid Glass (from Apple HIG, read 2026-10-15)

Rules taken from developer.apple.com/design (Materials, Color, Maps, Sheets, Motion, Typography, Accessibility):

| HIG guidance | How we apply it |
|---|---|
| Liquid Glass is a **functional layer floating above content**; **don't use it in the content layer** | Glass only on search bar, chips, sheet/panel, map controls, style popover. Lists *inside* the sheet use plain/standard materials. |
| **Use it sparingly**; limit it to the most important controls | At most ~5 glass surfaces on screen. |
| **Regular** variant (blur + luminosity) where text is heavy; **Clear** variant over rich backgrounds, with a **35 % dark dimming layer** if the content behind is bright | Sheet / sidebar = regular (more opaque); controls over satellite = clear + dim. |
| Glass has **no inherent colour**; apply colour **sparingly**, to the **background of the primary action** only | One accent (proposal: emerald, `#10b981`-ish, echoing the reference design) used only for primary CTAs (Directions) and the "Open" status. |
| Maps: offer **search + category filters**, **clearly highlight the selection**, **cluster** points, use a **muted** map style when there is info-rich content on top, keep **contrast** between controls and the map, show **place cards** with hours/phone/address | Muted default style, clusters, outlined selected pin, place cards, thin stroke + shadow on controls. |
| Sheets: **detents** (medium / large), **grabber**, **one sheet at a time** | Peek / half / full detents with a grabber; navigation stack inside one sheet. |
| Motion: **purposeful, brief, optional** | Spring transitions under 300 ms, globe fly-in once, everything off when `prefers-reduced-motion` is set. |
| Typography: avoid light weights; clear hierarchy; few typefaces | System font stack (`-apple-system, "SF Pro Text", Inter, system-ui`); weights 400/500/600/700 only. |
| Accessibility: reduce transparency / increase contrast | `prefers-reduced-transparency` → solid surfaces; `prefers-contrast: more` → stronger borders; WCAG AA text contrast; full keyboard + screen-reader labels. |

**Web implementation of the glass:** `backdrop-filter: blur(20–28px) saturate(170%)`, a translucent
fill (white 55–70 % in light mode, near-black 45–60 % in dark mode), a 1 px inner highlight border, a soft
outer shadow and a subtle top specular gradient. The "liquid" refraction edge uses an **SVG displacement
filter on Chromium only**, with a plain-blur fallback for Safari and Firefox. Built as reusable
Tailwind utilities (`.glass`, `.glass-clear`, `.glass-strong`).

> **Honesty note:** the Apple HIG currently online documents Liquid Glass (introduced with iOS 26).
> I didn't find separate "iOS 27"-specific design changes, so this spec follows the current published HIG.
> SF Symbols and the SF font can't be licensed for web use, so we use Lucide icons and the system font stack
> (which shows SF on Apple devices anyway).

## 7. Tech stack & architecture

| Layer | Choice | Why |
|---|---|---|
| Build | **Vite** | Fast dev server, simple GitHub Pages build |
| UI | **React 19 + TypeScript (TSX)** | Approved by faculty; components + typed data |
| Styling | **Tailwind CSS v4** | Required by brief; custom glass utilities |
| Map | **MapLibre GL JS v5** (globe projection) | Same engine OSM.org uses for vector layers; free |
| Map tiles | **OpenFreeMap** (Liberty / Positron / Dark styles, no key), **Esri World Imagery** or **EOX Sentinel-2** for satellite (with attribution) | Verified working cross-origin |
| Data APIs | **Photon** (type-ahead), **Nominatim** (geocode/reverse/bounded), **Overpass** (POI tags), **OSRM FOSSGIS** (routes) | All verified working cross-origin on 2026-10-15 |
| Hours | `opening_hours` npm library (or our own parser for common formats) | Correct Open-now status |
| Motion | `motion` (Framer Motion) | Sheet springs, transitions |
| Icons | `lucide-react` | Clean, Apple-like line icons |
| Tests | **Vitest** (+ Testing Library) | Parser, validation, hours, distance |
| Hosting | **GitHub Pages** via GitHub Actions | Your choice; `base` path configured |

**Folder structure** (the Part II JavaScript lives in plain `.js` modules, as you asked):
```
src/
  js/                     ← plain JavaScript (Part II showcase, JSDoc + // @ts-check)
    api.js                  fetch wrappers: photon, nominatim, overpass, osrm (+timeouts, retries, cache)
    queryParser.js          "X near me / near <place>" → structured query
    categories.js           synonyms → OSM tags, icons, colours
    validation.js           form validation rules + messages
    events.js               keyboard shortcuts, online/offline, geolocation helpers
    geo.js                  haversine distance, bbox, walk-time
    hours.js                opening-hours → status/table
  components/             ← TSX UI (SearchBar, Chips, ResultsList, PlaceSheet, Directions, ReportForm, StylePicker…)
  map/                    ← MapLibre setup, layers, clusters, globe
  hooks/ · state/ · styles/glass.css
docs/evidence/ · docs/screenshots/ · README.md
```

## 8. Testing plan (Part III-6)
- **Unit tests (Vitest):** query parser (20+ phrasings incl. "medical shop near me", "atm near mg road"), validation rules, distance, opening-hours status at fixed times.
- **Manual test cases table:** each feature × {success, empty, error, offline, location denied} with screenshots.
- **Before/after comparison:** the same 6 tasks (E1–E6) on OSM vs Beacon: steps taken, time, correct result.
- **Cross-device:** iPhone-size, Android-size, tablet, desktop; Chrome, Safari, Firefox.
- **Lighthouse:** performance, accessibility, best-practices scores recorded.

## 9. Delivery plan (meaningful commits)
1. Scaffold (Vite + React + TS + Tailwind) + CI deploy to GitHub Pages — deploy on day 1.
2. Map: globe → 2D, styles, controls.
3. `js/` modules + unit tests (parser, api, geo, hours, validation).
4. Search bar, suggestions, chips, which-one cards.
5. Results list + filters + states.
6. Place sheet + directions.
7. Report form, saved/recent, settings, shortcuts.
8. Liquid Glass polish, motion, accessibility pass.
9. Testing evidence, screenshots, README + docs (**after your guidance**).

## 10. Known limitations (to declare honestly)
- OSM data gaps: only ~7 % of places have opening hours in the area we tested, so many places will show "Hours unknown".
- Free public APIs (Overpass, OSRM demo, Nominatim) can be slow or rate-limited; mitigated with caching and fallbacks, not eliminated.
- No live traffic, no transit routing, no user accounts (by design).
- Reports are stored locally or sent as OSM Notes by the user's choice; no own backend.

---

## Decisions needed from you
1. **Name:** "Beacon" OK, or do you want another (e.g. *Nearo*, *Waypoint*, *Around*)?
2. **Scope:** keep the PWA and keyboard shortcuts as stretch goals, or make them must-haves?
3. **Accent colour:** emerald (like your reference design), or something else?
4. Anything to add before I start building?
