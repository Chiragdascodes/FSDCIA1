# OpenStreetMap.org — Complete A–Z Analysis

> Source URL analysed: `https://www.openstreetmap.org/#map=5/23.66/90.40` (South Asia / Bangladesh view)
> Analysis date: 2026-10-15. Method: live inspection in a browser (DOM, JS globals, bundled source, network
> requests, HTTP headers, public API responses) plus background knowledge of the OSM stack.
> Purpose: reference memory for a later task (likely a full-stack / clone / integration project).

---

## 0. TL;DR (one-paragraph summary)

OpenStreetMap (OSM) is a **free, editable, crowd-sourced map of the world**, run by the non-profit
**OpenStreetMap Foundation (OSMF)**. The data is licensed **ODbL 1.0**. The website `www.openstreetmap.org`
is a **Ruby on Rails** monolith (`openstreetmap-website`, GPL-2.0) that serves: a full-screen
**slippy map** (Leaflet 1.9.4 + MapLibre GL 5.24 for vector layers) with a left **sidebar** whose content is
swapped by a tiny client-side **router** + **Hotwire Turbo Frames**; the **editing API v0.6**
(read-heavy calls answered by the C++ **cgimap** server); user accounts, changesets, notes, GPS traces,
diaries, messages and moderation. Search, routing and "query features" are delegated to separate services:
**Nominatim** (geocoding), **OSRM / Valhalla / GraphHopper** (routing) and **Overpass** (feature query).
Map pictures come from **raster tile servers** (`tile.openstreetmap.org` → OpenStreetMap Carto / Mapnik)
and **vector tiles** (`vector.openstreetmap.org`, Shortbread schema), all behind the **Fastly** CDN.

---

## 1. What the site is (product view)

| Aspect | Detail |
|---|---|
| Tagline (meta description) | "OpenStreetMap is a map of the world, created by people like you and free to use under an open license." |
| Owner/operator | OpenStreetMap Foundation (UK non-profit). Hosting sponsored by **Fastly**, OSMF corporate members, partners. |
| Data licence | **ODbL 1.0** (Open Database License). Attribution required: "© OpenStreetMap contributors". |
| Map image / cartography licence | Tiles CC BY-SA (historically) — attribution always "© OpenStreetMap contributors". |
| Website code licence | GPL-2.0 — repo `github.com/openstreetmap/openstreetmap-website`. |
| Business model | Donations (supporting.openstreetmap.org), OSMF membership, corporate members. No ads. |
| Users | Mappers (editors), data consumers (apps, companies), casual viewers, humanitarian orgs (HOT). |
| Core loop | View map → spot error → add a **Note** or **Edit** (iD/JOSM) → upload **changeset** → tiles re-render in minutes. |

---

## 2. Page layout (UI anatomy)

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ HEADER (55px, Bootstrap navbar)                                                      │
│ [logo OpenStreetMap] [Edit ▾] History Export GPS-Traces User-Diaries Communities     │
│                      Copyright Help Donate About            [Log In] [Sign Up]       │
├───────────────────────┬──────────────────────────────────────────────────────────────┤
│ SIDEBAR (350px)       │  MAP (#map, Leaflet container, fills rest)       ┌─────┐     │
│ ┌───────────────────┐ │                                                  │ +   │zoom │
│ │Search [Where is   │ │                                                  │ −   │     │
│ │ this?] [🔍] [↱]   │ │                                                  │ ➤   │locate│
│ └───────────────────┘ │                                                  ├─────┤     │
│ (or directions form)  │                                                  │ ≋   │layers│
│                       │                                                  │ i   │legend│
│ #sidebar_content      │                                                  │ <   │share │
│ (Turbo frame:         │                                                  ├─────┤     │
│  welcome / search     │                                                  │ 💬  │note  │
│  results / element    │                                                  ├─────┤     │
│  details / history…)  │                                                  │ ?   │query │
│                       │                                                  └─────┘     │
│                       │ [scale bar]          © OpenStreetMap contributors ♥ Donate…  │
└───────────────────────┴──────────────────────────────────────────────────────────────┘
```

- **Body class:** `map-layout`. `<html lang="en" dir="ltr">` (RTL languages flip to `dir="rtl"` and load `*-rtl.css`).
- **Header:** logo link (is a `geolink` — keeps current map position), **Edit** split-button (dropdown:
  "Edit with iD (in-browser editor)", "Edit with Remote Control (JOSM, Potlatch, Merkaartor)"),
  nav links, Log In / Sign Up. Edit button is **disabled below zoom 13** ("Zoom in to edit the map").
- **Sidebar (`#sidebar`, 350px):** search form + directions form at top; `#sidebar_content` below.
  Initial content = **Welcome box** ("Welcome to OpenStreetMap!" + "Learn More" + "Start Mapping"),
  dismissed via cookie `_osm_welcome=hide`.
- **Map controls (right side, vertical stacked buttons, Bootstrap tooltips placed left):**
  1. Zoom In / Zoom Out
  2. Show My Location (browser Geolocation, Leaflet.locate-style)
  3. **Layers** panel (base layer chooser with thumbnails + overlays)
  4. **Legend** panel (map key; only for layers with `hasLegend`)
  5. **Share** panel (link / short link / HTML embed / geo URI / image export)
  6. **Add a note** (enabled only at zoom ≥ 12)
  7. **Query features** "?" (enabled only at zoom ≥ 14)
- **Bottom:** Leaflet scale control (metric + imperial), attribution control
  ("© OpenStreetMap contributors ♥ Make a Donation. Website and API terms").
- **Right-click context menu** on the map (custom `OSM.ContextMenu`, positioned with Popper):
  - Directions from here · Directions to here
  - Add a note here (zoom ≥ 12)
  - Show address (→ `/search?lat=..&lon=..&zoom=..`, reverse geocode)
  - Query features (zoom ≥ 14)
  - Centre map here
- **Mobile (<768px):** sidebar collapses; search box moves into the hamburger menu (`.navbar-toggler`),
  a "Select Language" (translate) button appears in the header, map fills the screen, controls stay right.
- **Theme:** automatic light/dark via `prefers-color-scheme` (Bootstrap 5.3 colour modes). In dark mode
  the map tiles are also dimmed / dark vector styles are used (`OSM.isDark("map")`).
- **Banners:** a dismissable top banner (cookie e.g. `_osm_banner_31day_2026`) for campaigns/events.

### Design tokens observed
| Token | Light | Dark |
|---|---|---|
| `--bs-primary` | `#7092FF` | `#7092FF` |
| `--bs-body-bg` | `#fff` | `#212529` |
| `--bs-body-color` | `#212529` | `#dee2e6` |
| `--bs-link-color` | `#24d` | `#a9beff` |
| `--bs-secondary-bg` | `#e9ecef` | `#343a40` |
| Marker colours | green `#9cef11` (start), red `#f6110a` (end), blue `#0b8ef1` | same |
| Font | `system-ui, -apple-system, "Segoe UI", Roboto, …` (system font stack) | same |
| Brand green (mask-icon / tiles) | `#7ebc6f`, MS tile `#00a300` | |
| Icons | **Bootstrap Icons** (`bi-*`) + custom inline SVGs (search, directions, pins) | |

---

## 3. Front-end technology stack (verified live)

| Library | Version | Role |
|---|---|---|
| **Leaflet** | 1.9.4 | Main map engine (`L.OSM.Map` subclass), raster tiles, markers, vector overlays |
| **MapLibre GL JS** | 5.24.0 | Renders **vector-tile** base layers (Shortbread, Transport, MapTiler) inside Leaflet via `MaplibreGLLeaflet` bridge |
| **jQuery** | 3.7.1 | DOM/event handling (legacy-style code) |
| **Bootstrap** | 5.3.8 | Layout, navbar, dropdowns, modals, tooltips, colour modes |
| **Popper** | 2.x | Tooltip / context-menu positioning |
| **Hotwire Turbo** | (turbo-*.js) | Turbo Frames for the sidebar (`<turbo-frame id="sidebar_content_frame">`), `turbo-refresh-method=morph` |
| **i18n-js** (`I18n`, `OSM.i18n`) | — | Client translations, per-locale bundle `/assets/i18n/en-*.js`; plural rules via `make-plural` |
| **js-cookie** (`Cookies`) | — | Cookie helper (`OSM.cookies`) |
| **@mapbox/mapbox-gl-rtl-text** | — | Lazy-loaded plugin for Arabic/Hebrew label shaping in vector maps |
| **Matomo** (Piwik) | — | Privacy-friendly self-hosted analytics at `matomo.openstreetmap.org` |
| **Bootstrap Icons** | — | Icon font |

**Asset pipeline:** Rails (Propshaft/Sprockets-style) fingerprinted assets: `/assets/application-<sha256>.js`,
`/assets/index-<sha>.js`, `screen-auto-ltr-<sha>.css`, `print-ltr-<sha>.css`, `leaflet-all-*.css`,
`maplibre-gl-all-*.css`. Page-specific code is **code-split ES modules** loaded on demand via dynamic `import()`:

```
OSM.MODULE_PATHS = {
  index_index, index_search, index_directions, index_export, index_history,
  index_note, index_new_note, index_element, index_changeset, index_query, index_home,
  make_plural_cardinals, mapbox_rtl_text
}
```

Page size: ~50 KB HTML; `application.js` ~1.5 MB (uncompressed, includes Leaflet, MapLibre, jQuery, Bootstrap);
`index.js` ~57 KB; per-route modules 5–20 KB.

---

## 4. How the single-page map works (client architecture)

### 4.1 Boot sequence
1. Server renders the Rails layout (header, sidebar shell, empty `#map`, inline JSON config into `OSM.*`).
2. `application.js` defines `OSM` namespace, Leaflet extensions (`L.OSM.Map`, `L.OSM.TileLayer`,
   `L.OSM.DataLayer`, `L.OSM.GPS`), controls, helpers.
3. `index.js` creates the map:
   ```js
   const map = new L.OSM.Map("map", { zoomControl:false, layerControl:false, contextmenu:true, worldCopyJump:true });
   ```
   then adds controls, base layer from URL/cookie, overlays, context menu, then starts the router:
   `OSM.Router(map, {...routes}); OSM.router.load();`
4. Every map move (`moveend`, `baselayerchange`, `overlayadd`, `overlayremove`) → `updateLinks()` rewrites all
   `.geolink` hrefs to include the current position and writes the `_osm_location` cookie.

### 4.2 Initial-position resolution (`OSM.mapParams`)
Priority order:
1. URL **hash** `#map=Z/LAT/LON&layers=XY`
2. Query params: `?mlat=&mlon=` (marker), `?node=|way=|relation=|note=` (object), `?bbox=minlon,minlat,maxlon,maxlat`,
   `?minlon=&minlat=&maxlon=&maxlat=`, `?lat=&lon=&zoom=`
3. Cookie `_osm_location = lon|lat|zoom|layers` (e.g. `90.40|23.66|5|M`)
4. Server-side **GeoIP** guess → `OSM.location = {minlat,minlon,maxlat,maxlon}` (here: India/South-Asia box)
5. Fallback default world view.

### 4.3 URL hash format
```
#map=<zoom>/<lat>/<lon>[&layers=<codes>]
e.g.  #map=5/23.66/90.40          (zoom 5, lat 23.66, lon 90.40, default layer M)
      #map=13/23.77066/90.39911&layers=CN
```
- Coordinate precision depends on zoom: `zoomPrecision(z) = ceil(log10(2^(8+z) / 180))` → z5 → 2 decimals,
  z13 → 5 decimals (`OSM.cropLocation`).
- `layers` is a concatenation of single-letter codes; `M` (default) is stripped.

### 4.4 Layer codes
| Code | Layer | Type | Max zoom | Tile/style source |
|---|---|---|---|---|
| **M** | Standard (OpenStreetMap Carto) | raster 256px | 19 | `https://tile.openstreetmap.org/{z}/{x}/{y}.png` |
| **Y** | CyclOSM | raster | 20 | `https://{a,b,c}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png` |
| **C** | Cycle Map (OpenCycleMap, Thunderforest) | raster, `{ratio}` for HiDPI | 21 | `https://api.thunderforest.com/cycle/{z}/{x}/{y}{ratio}.png?apikey=…` |
| **T** | Transport Map (Thunderforest) | **vector** (MapLibre), light + dark style | 23 | `https://api.thunderforest.com/styles/transport[-dark]/style.json?apikey=…` |
| **P** | Tracestrack Topo | raster webp | 19 | `https://tile.tracestrack.com/topo__/{z}/{x}/{y}.webp?key=…` |
| **H** | Humanitarian (HOT, OSM France) | raster | 20 | `https://tile-{a,b,c}.openstreetmap.fr/hot/{z}/{x}/{y}.png` |
| **S** | Shortbread (OSMF vector tiles) | **vector** | 23 | `https://vector.openstreetmap.org/styles/svwd/svwd03style.json` |
| **V** | MapTiler OMT (OpenMapTiles) | **vector** | 23 | `https://api.maptiler.com/maps/openstreetmap/style.json?key=…` |
| **N** | Overlay: Map Notes | overlay (Leaflet FeatureGroup) | — | `/api/0.6/notes?bbox=` |
| **D** | Overlay: Map Data | overlay (`L.OSM.DataLayer`) | — | `/api/0.6/map?bbox=` (max area 0.25°²) |
| **G** | Overlay: Public GPS Traces | raster overlay | 20 (native) / 21 | `https://gps.tile.openstreetmap.org/lines/{z}/{x}/{y}.png` |

> Third-party layer API keys are embedded client-side in the page config (`OSM.LAYER_DEFINITIONS`). They are
> OSM's own keys, scoped to osm.org — **do not reuse them** in another project; get your own keys.

Each layer definition object contains: `layerId, nameId, code, url|style, maxZoom, subdomains, credit{id,href,children},
hasLegend, canEmbed, canDownloadImage, isVectorStyle, leafletOsmId, wiki`. Raster layers are also expressed as
MapLibre style JSON (`version:8`, raster source) so either engine can draw them.

### 4.5 Client router (`OSM.Router`)
Custom pushState router mapping paths → lazily imported page modules. Each module exposes `load(path)`,
`unload()`, optional `init()`. Clicks on same-origin `<a>` are intercepted; sidebar HTML is fetched as a
**Turbo Frame** (`OSM.loadSidebarContent(url)` sets `#sidebar_content_frame.src`); page title comes from
response header **`X-Page-Title`** (URL-encoded).

| Route | Module | What it does |
|---|---|---|
| `/` | index | Welcome sidebar |
| `/search` | search | Geocoding results |
| `/directions` | directions | Routing UI |
| `/export` | export | Bbox data export |
| `/note/new` | new_note | Draggable note marker + form |
| `/note/:id` | note | Note details/comments |
| `/history`, `/history/friends`, `/history/nearby`, `/user/:display_name/history` | history | Changeset list + bboxes on map |
| `/node/:id(/history)` , `/node/:id/history/:version` | element | Node detail, highlights on map |
| `/way/:id(/history)`, `/way/:id/history/:version` | element | Way detail (geometry drawn) |
| `/relation/:id(/history)`, `/relation/:id/history/:version` | element | Relation detail + members |
| `/changeset/:id` | changeset | Changeset detail + bbox |
| `/query` | query | "Query features" via Overpass |
| `/account/home` | home | Logged-in user's home location |

Everything else (`/traces`, `/diary`, `/user/...`, `/login`, `/copyright`, `/about`, `/help`, `/communities`,
`/fixthemap`, `/messages/...`, `/issues`, `/reports/new`, `/dashboard`…) are **classic full-page Rails views**.

### 4.6 Cookies & storage
| Cookie | Example | Purpose |
|---|---|---|
| `_osm_location` | `90.40\|23.66\|5\|M` | Last map position (lon\|lat\|zoom\|layers), 10-year expiry |
| `_osm_welcome` | `hide` | Welcome box dismissed |
| `_osm_banner_*` | `1` / `hide` | Campaign banner dismissed |
| `_osm_session` | (HttpOnly) | Rails session (when logged in) |
| `_osm_totp_token` / remember-me | — | Persistent login |
| `_pk_id.*`, `_pk_ses.*` | — | Matomo analytics (visitor 28 days, referral 7 days) |

CSRF: `<meta name="csrf-param" content="authenticity_token">` + `<meta name="csrf-token">`, mirrored in `OSM.csrf`.
CSP nonce in `<meta name="csp-nonce">`.

---

## 5. Feature-by-feature (how each works)

### 5.1 Search (geocoding)
- Form `GET /search?query=…`. Client module loads `/search` sidebar, which contains placeholder entries
  `data-href="/search/nominatim_query?query=…"`; JS then **POSTs** (with CSRF token) to that URL —
  the **Rails server proxies Nominatim** and returns an HTML `<ul>` of results.
  (Plain GET to `/search/nominatim_query` returns 404 — must be POST.)
- Coordinates typed into search (`23.7, 90.4`) are detected as lat/lon and shown directly.
- Each result `<a class="set_position">` carries `data-lat, data-lon, data-min-lat… data-prefix ("City"),
  data-type (node/way/relation), data-id`. Clicking fits bounds / opens the element page.
- Results get coloured markers using a golden-angle hue sequence (`hwb(i*111.25deg 5% 5%)`).
- "More results" → POST `/search/nominatim_query?exclude=N…,R…&query=…`.
- **"Where is this?"** button → reverse geocoding (`/search?lat=&lon=&zoom=`) via
  `/search/nominatim_reverse_query`.
- Link out: "Nominatim" → `https://nominatim.openstreetmap.org/search?q=…&format=html`.
- OpenSearch descriptor `/assets/osm-*.xml` lets browsers add OSM as a search engine.

### 5.2 Directions (routing)
- URL: `/directions?engine=<engine>_<mode>&route=<lat,lon>;<lat,lon>` e.g.
  `/directions?engine=fossgis_osrm_car&route=23.8103,90.4125;23.7275,90.3854`
- UI: mode toggle (Car / Bicycle / Foot), engine `<select>` (GraphHopper, OSRM, Valhalla), From/To inputs with
  **draggable** start (green) / end (red) pins, Reverse button, close button.
- Engines (called **directly from the browser**, CORS):
  | Engine | Endpoint | Modes |
  |---|---|---|
  | OSRM (FOSSGIS) | `https://routing.openstreetmap.de/routed-{car,bike,foot}/route/v1/driving/{lon,lat;lon,lat}?overview=false&geometries=polyline&steps=true` | car, bike, foot |
  | Valhalla (FOSSGIS) | `https://valhalla1.openstreetmap.de/route` | car, bike, foot |
  | GraphHopper | `https://graphhopper.com/api/1/route?…` (OSM's key) | car, bike, foot |
- Free-text From/To are geocoded with Nominatim; coordinates are **reverse-geocoded** directly from the browser:
  `https://nominatim.openstreetmap.org/reverse?lat=..&lon=..&format=json`.
- Output: blue route polyline, summary "Distance: 13km. Time: 0:17.", numbered turn-by-turn list with icons
  (hover highlights segment), distance-units setting (km/mi), **"Download route as GeoJSON"**, credit +
  "More details from …" deep link to the engine's own site.

### 5.3 Query features ("?" button / right-click)
- Enabled at **zoom ≥ 14**. Click a point → `/query?lat=..&lon=..`.
- Draws an orange (`#FF6200`) circle of radius `10 * 1.5^(19 - zoom)` metres.
- Sends two **Overpass QL** POSTs to `https://query.openstreetmap.org/query-features` (OSMF's Overpass):
  - **Nearby features:** `[timeout:10][out:json];(node(around:R,lat,lon);way(around:R,lat,lon););out tags geom(bbox);relation(around:R,lat,lon);out geom(bbox);`
  - **Enclosing features:** `is_in(lat,lon)->.a;way(pivot.a);out tags bb; out ids geom(bbox);relation(pivot.a);out tags bb;` sorted by area (smallest first).
- Results list with prefixes ("Restaurant", "City Boundary"…) from translated tag→label tables; hover draws geometry.
- Uninteresting tags ignored: `source, source_ref, created_by, tiger:*, KSJ2:*, note:ja, history, attribution`.

### 5.4 Element pages (node / way / relation)
- Sidebar shows: title "Node: Dhaka (3442474911)", version #, changeset comment, "Edited 2 days ago by <user>",
  changeset link + comment count, location (nodes), **Tags table** (each key/value links to the OSM Wiki,
  `wikidata`/`wikipedia`/`website`/`phone`/`email` rendered as links, Wikidata/Commons images fetched from
  `wikidata.org/w/api.php` and `commons.wikimedia.org`), "Part of" (parent ways/relations), Members/Nodes list
  (paginated), links: **Download XML**, **View History**, version navigation (`/node/ID/history/N`).
- Geometry is fetched from the API (`OSM.apiUrl` → `/api/0.6/{type}/{id}[/full]`) and highlighted on the map.

### 5.5 History / changesets
- `/history` lists recent changesets in current view: comment, "Closed X ago by user", `#id`, counts of
  created / modified / deleted elements and comments. Bounding boxes drawn on the map; hovering cross-highlights.
- Variants: `/history/friends`, `/history/nearby`, `/user/NAME/history`.
- `/changeset/:id`: comment, tags (`created_by=iD 2.42.2`, `host`, `imagery_used`, `locale`, `source`,
  `changesets_count`), **discussion** (comments; subscribe — login required), lists of nodes/ways/relations,
  links to "Changeset XML" and "osmChange XML", prev/next changeset by same user.

### 5.6 Export
- `/export`: bbox (from current view or "Manually select a different area" with a draggable rectangle).
- "Export" downloads OSM XML from `/api/0.6/map?bbox=` — limited to **0.25 square degrees** / 50,000 nodes;
  for bigger areas it links to: **Overpass API** (mirror download), **Planet OSM** (planet.openstreetmap.org),
  **Geofabrik Downloads** (country extracts), wiki "Other sources".

### 5.7 Share panel
- **Link** (long URL with hash), **Short Link** (`https://osm.org/go/<code>` — a base64-like interleaved
  quadtile encoding of lat/lon/zoom, with `?m=` for marker), **HTML** embed:
  ```html
  <iframe width="425" height="350"
    src="https://www.openstreetmap.org/export/embed.html?bbox=minlon,minlat,maxlon,maxlat&layer=mapnik[&marker=lat,lon]"
    style="border: 1px solid black"></iframe><br/><small><a href="…">View Larger Map</a></small>
  ```
- "Include marker" checkbox (adds `mlat/mlon` or `marker=`).
- **Geo URI**: `geo:14.33,98.96?z=5` (RFC 5870), parsed back by `OSM.parseGeoURI`.
- **Image export:** formats PNG / JPEG / WEBP / SVG / PDF, scale `1 : N`, custom dimensions, POST
  `/export/finish` → rendered by `render.openstreetmap.org` (Mapnik). Only layers with `canDownloadImage`.

### 5.8 Notes (bug reports anyone can leave)
- `/note/new` (zoom ≥ 12): draggable marker + textarea; anonymous allowed ("Anyone in the public can see a note").
- Notes overlay (N) loads `/api/0.6/notes.json?bbox=` (max area 25°²). Open = red marker, closed = green.
- Note page: comments thread, actions comment / resolve / reactivate / hide (moderators).
- API returns GeoJSON Feature with `properties {id, status, date_created, comments[{action,date,text,html}],
  url, comment_url, close_url}`.

### 5.9 Map Data overlay (D)
- `L.OSM.DataLayer` fetches `/api/0.6/map?bbox=` and draws raw nodes (circle markers) and ways (polylines /
  polygons when closed and tagged with an **area tag**: `area, building, leisure, tourism, ruins, historic,
  landuse, military, natural, sport`). Clicking a feature opens its element page. Shows a warning when too
  many features (> ~2000) and a "load data" prompt.

### 5.10 Editing
- **Edit** button → `/edit?editor=id#map=…` — embeds **iD** (JavaScript editor, default `OSM.preferred_editor="id"`)
  in an iframe; requires login (redirects to `/login?referer=/edit`). Edit disabled below zoom 13.
- **Remote Control** → browser calls JOSM/Merkaartor running locally on `http://127.0.0.1:8111/load_and_zoom?...`
  (whitelisted in CSP `connect-src`).
- Users can set preferred editor in account settings. (Potlatch 2 Flash editor is retired; name remains in menu text.)
- Edits are uploaded as **changesets** through API 0.6 using **OAuth 2.0** (Doorkeeper on Rails).

### 5.11 GPS traces
- `/traces`: public uploads (GPX), each with points count, visibility (`IDENTIFIABLE`, `TRACKABLE`, `PUBLIC`,
  `PRIVATE`), tags, uploader, "View location on map", "Open in editor". Upload form requires login.
- Rendered as overlay G (`gps.tile.openstreetmap.org/lines/`). Trace images stored on S3
  (`openstreetmap-gps-images.s3…`).

### 5.12 Community features
- **User Diaries** (`/diary`, per language, comments, subscribe, RSS).
- **User profiles** (`/user/NAME`): edits count, notes, traces, diary, comments, "Mapper since", "Last map edit",
  home location, avatar (Gravatar or uploaded to S3), Send Message, add as friend / follow, block info.
- **Messages** (`/messages/inbox|outbox|muted`) — private messaging.
- **Communities** (`/communities`): Local Chapters (OSMF-affiliated) + other groups.
- **Dashboard** (`/dashboard`): followed users' activity.
- **Issues / reports** (`/reports/new`, `/issues`): moderation queue for admins/moderators; **user blocks**
  (`/user_blocks`), roles (administrator, moderator, importer).
- **Help** (`/help`): links to Beginners' Guide, community forum (community.openstreetmap.org), mailing lists,
  IRC/Matrix, switch2osm, wiki.
- **Fix the map** (`/fixthemap`), **About** (`/about`), **Copyright** (`/copyright`, localized licence text).

### 5.13 Accounts & auth
- Sign up `/user/new`: Email, Display Name, Password, Confirm, **"Verify you're a human"** (Turnstile/captcha),
  agree to Terms of Use + Privacy Policy + **Contributor Terms**; email confirmation.
- Log in `/login` (email or username + password, "Remember me", "Lost your password?").
- **Third-party login** (OmniAuth): `/auth/google`, `/auth/apple`, `/auth/facebook`, `/auth/microsoft`,
  `/auth/github`, `/auth/wikipedia` (also OpenID historically).
- Optional 2FA (TOTP) in newer versions; OAuth 2 applications at `/oauth2/applications`.
- Pages that need login redirect to `/login?referer=<path>`.

### 5.14 Internationalisation
- ~100+ locales via **translatewiki.net**. Locale picked from `Accept-Language` (`OSM.preferred_languages`
  = `["en-US","en"]`) or user prefs. Response header `Content-Language: en`, `Vary: Accept-Language`.
- Feature names shown with `name:<lang>` fallback → `name` → `ref` → `addr:housename` → housenumber+street.
- Map labels on the Standard raster layer are in **local script** (e.g. Bengali `ঢাকা`) because tiles are
  pre-rendered from the `name` tag only.

---

## 6. OSM data model (the heart of everything)

| Element | Has | Notes |
|---|---|---|
| **Node** | `id, lat, lon, tags, version, changeset, timestamp, user, uid, visible` | A point (POI or vertex of a way) |
| **Way** | ordered list of node refs (`nodes[]`, **max 2,000**), tags | Line; closed way = area (if area tags) |
| **Relation** | ordered `members[]` of `{type, ref, role}` (**max 32,000**), tags | Multipolygons, routes, boundaries, turn restrictions… |
| **Tag** | `key=value` free-form strings (max 255 chars each) | Conventions documented on wiki.openstreetmap.org (e.g. `highway=trunk`, `name:en=Airport Road`, `place=city`) |
| **Changeset** | id, user, open/closed, bbox, tags (`comment`, `source`, `created_by`, `imagery_used`), discussion | Groups edits; max **10,000** elements; auto-closes after 1h idle / 24h |
| **Note** | id, lat/lon, status open/closed/hidden, comments | Not part of map data |
| **GPS trace** | GPX file, visibility, tags, description | Not part of map data |

- Every element is **versioned**; full history is kept (`/node/ID/history`).
- Example real node (Dhaka, `node/3442474911`): `place=city`, `capital=yes`, `admin_level=2`, `population=21741000`,
  `wikidata=Q1354`, ~150 `name:xx` translations, version 49.
- Example way (`way/13848342`, Airport Road): `highway=trunk, lanes=4, oneway=yes, surface=asphalt, lit=yes,
  maxheight=4.8, name=বিমানবন্দর সড়ক, name:en=Airport Road` with 14 node refs.
- Coordinates: WGS84, 7 decimal places (~1 cm). Stored as integers ×10⁷ in the DB with a **quadtile** index column.

---

## 7. Public APIs & endpoints (what you can call)

### 7.1 OSM Editing API v0.6 (`https://api.openstreetmap.org/api/0.6/…`, also on www)
Formats: XML default, **`.json`** suffix or `Accept: application/json`.

| Endpoint | Purpose |
|---|---|
| `GET /api/versions(.json)` | `["0.6"]` |
| `GET /api/capabilities(.json)` | Limits (see below) |
| `GET /api/0.6/map?bbox=l,b,r,t` | All data in bbox (≤0.25°², ≤50k nodes) |
| `GET /api/0.6/{node|way|relation}/{id}` | Current version |
| `GET /api/0.6/{type}/{id}/history`, `/{id}/{version}` | History / specific version |
| `GET /api/0.6/{way|relation}/{id}/full` | Element + all referenced members |
| `GET /api/0.6/{nodes|ways|relations}?{type}s=1,2,3` | Multi-fetch |
| `GET /api/0.6/node/{id}/ways`, `/{type}/{id}/relations` | Parents |
| `PUT /api/0.6/changeset/create`, `POST /changeset/{id}/upload` (osmChange), `PUT /changeset/{id}/close` | Editing (OAuth 2) |
| `GET /api/0.6/changesets?bbox=&user=&time=&open=&closed=` | Changeset query (limit 100) |
| `GET /api/0.6/changeset/{id}?include_discussion=true`, `/changeset/{id}/download` | Changeset details / osmChange |
| `POST /api/0.6/changeset/{id}/comment`, `/subscribe` | Discussion |
| `GET /api/0.6/notes?bbox=&limit=&closed=`, `/notes/{id}`, `/notes/search?q=` | Notes (≤25°², limit ≤10,000) |
| `POST /api/0.6/notes?lat=&lon=&text=`, `/notes/{id}/comment|close|reopen` | Notes write |
| `GET /api/0.6/trackpoints?bbox=&page=` , `/gpx/{id}`, `POST /gpx/create` | GPS |
| `GET /api/0.6/user/{id}`, `/user/details` (auth), `/user/preferences` | Users |

**Capabilities (live values):**
```
area.maximum = 0.25 (deg²)        note_area.maximum = 25
waynodes.maximum = 2000           relationmembers.maximum = 32000
changesets.maximum_elements = 10000, default/max query limit = 100
notes default 100 / max 10000     tracepoints.per_page = 5000
timeout = 300 s                   status: api/database/gpx = online
imagery blacklist: Google, Here, Yandex, 2GIS, mapy.cz, vworld (licence reasons)
```
- Responses carry `generator: "openstreetmap-cgimap 2.1.0 (… spike-08.openstreetmap.org)"` — reads are served by
  **cgimap** (C++ FastCGI), writes by Rails.
- Every response includes `copyright`, `attribution`, `license` (ODbL).

### 7.2 Website-internal (HTML fragment) endpoints
- `GET <any sidebar path>` with header `Turbo-Frame: sidebar_content_frame` → returns only
  `<turbo-frame id="sidebar_content_frame">…</turbo-frame>` + `X-Page-Title` header.
- `GET /panes/layers` → HTML of the layer switcher pane.
- `POST /search/nominatim_query?query=`, `/search/nominatim_reverse_query?lat=&lon=&zoom=` (CSRF token).
- `POST /export/finish` → image/data export.
- `/export/embed.html?bbox=&layer=&marker=` → embeddable minimal map.
- `https://osm.org/go/<shortcode>` → short links.

### 7.3 External services used
| Service | URL | Used for |
|---|---|---|
| Nominatim | `https://nominatim.openstreetmap.org/` | Search + reverse geocode (`/search`, `/reverse?format=json`) |
| Overpass (OSMF) | `https://query.openstreetmap.org/query-features` | Query features |
| OSRM (FOSSGIS) | `https://routing.openstreetmap.de/` | Routing |
| Valhalla (FOSSGIS) | `https://valhalla1.openstreetmap.de/route` | Routing |
| GraphHopper | `https://graphhopper.com/api/1/route` | Routing |
| Wikidata | `https://www.wikidata.org/w/api.php` | Element images/labels |
| Wikimedia Commons | `https://commons.wikimedia.org` | Images |
| Thunderforest | `api.thunderforest.com` | Cycle / Transport layers |
| Tracestrack | `tile.tracestrack.com` | Topo layer |
| OSM France | `*.openstreetmap.fr` | CyclOSM, HOT layers |
| MapTiler | `api.maptiler.com` | OMT vector layer |
| Render | `render.openstreetmap.org` | Image export |
| Matomo | `matomo.openstreetmap.org` | Analytics (goals per layer + signup) |
| Gravatar / S3 | `www.gravatar.com`, `openstreetmap-user-avatars.s3…`, `openstreetmap-gps-images.s3…` | Avatars, trace images |
| JOSM | `http://127.0.0.1:8111` | Remote-control editing |

---

## 8. Back-end & infrastructure (how the server side works)

```
                Browser
                   │  HTTPS (HTTP/3 alt-svc), HSTS preload
          ┌────────▼─────────┐
          │  Fastly CDN       │  x-served-by: cache-sin-… (Singapore POP), Varnish ("via: 1.1 varnish")
          └────────┬─────────┘
   ┌───────────────┼─────────────────────────────────────────────┐
   ▼               ▼                                             ▼
www/api       tile.openstreetmap.org                 vector.openstreetmap.org
Apache +      (renderd + mod_tile + Mapnik,          (Tilekiln, Shortbread
Phusion        OpenStreetMap Carto CartoCSS,          schema vector tiles)
Passenger      PostGIS rendering DB fed by
6.2.0          osm2pgsql minutely diffs)
   │
   ├─ Rails app (openstreetmap-website): HTML pages, auth, OAuth2, writes to API, notes, diaries, traces…
   ├─ cgimap (C++): high-volume API reads (map, element, history, changeset download)
   └─ PostgreSQL "apidb" (main DB: current_* tables + history tables, quadtile index)
           │
           ├─► replication: minutely / hourly / daily osmChange diffs (planet.openstreetmap.org/replication)
           ├─► weekly Planet dump (planet.osm.pbf, ~80+ GB), full-history dump
           └─► consumers: tile DBs, Nominatim, Overpass, routing engines, everyone else
```

- **Response headers seen:** `server: Apache`, `x-powered-by: Phusion Passenger(R) 6.2.0`, `x-runtime`,
  `x-request-id`, `strict-transport-security: max-age=31536000; includeSubDomains; preload`,
  `x-frame-options: SAMEORIGIN`, `x-content-type-options: nosniff`, `referrer-policy: strict-origin-when-cross-origin`,
  `cache-control: max-age=0, private, must-revalidate`, `vary: Accept-Language, Accept-Encoding`.
- **Content-Security-Policy** (strict): `default-src 'self'`, nonce-based `script-src` (+ `'wasm-unsafe-eval'`,
  Matomo), `worker-src blob:` (MapLibre workers), `connect-src` whitelist of all services in §7.3,
  `img-src` whitelist of tile hosts, `form-action 'self' render.openstreetmap.org tile.thunderforest.com`,
  `frame-ancestors 'self'`.
- **Rails internals (from the open-source repo):** models `Node/Way/Relation` (+ `OldNode`… history,
  `CurrentNode`… current tables), `Changeset`, `Note/NoteComment`, `Trace/Tracepoint`, `DiaryEntry`,
  `Message`, `User/UserBlock/UserRole`, `Issue/Report`; auth via Devise-like custom + **OmniAuth** +
  **Doorkeeper** (OAuth2) ; background jobs via ActiveJob (trace import, emails); storage via ActiveStorage (S3);
  rate limiting on edits for new users; i18n via translatewiki.
- **Tile rendering pipeline:** edit uploaded → minutely diff → osm2pgsql updates rendering PostGIS DB → tiles
  in affected areas marked dirty → re-rendered on demand by renderd (metatiles 8×8) → served/cached by Fastly.
  Hence the "my edit shows in a few minutes" behaviour.
- **Tile coordinate system:** Web Mercator (EPSG:3857), XYZ "slippy map" scheme, 256px tiles,
  `n = 2^z`, `x = floor((lon+180)/360·n)`, `y = floor((1 − ln(tan φ + sec φ)/π)/2·n)`. Zoom 0 = 1 tile for the world,
  zoom 19 = street level.

---

## 9. Policies & limits you MUST respect when building on OSM

- **Attribution:** "© OpenStreetMap contributors" linking to `https://www.openstreetmap.org/copyright`, visible on the map.
- **Tile Usage Policy** (`operations.osmfoundation.org/policies/tiles/`): `tile.openstreetmap.org` is for light use;
  send a valid **User-Agent / Referer**, don't bulk download/prefetch, cache per HTTP headers, no offline scraping;
  heavy users must use a commercial provider or self-host.
- **Nominatim Usage Policy:** max **1 request/second**, identify via UA/Referer, no autocomplete-on-keystroke,
  cache results; bulk geocoding → self-host.
- **API Usage Policy:** API is for **editing**; for reading big data use Overpass, planet dumps, extracts.
- **Overpass:** fair use (timeouts, 10s used here), self-host for heavy use.
- **FOSSGIS routing:** demo-level fair use.
- **ODbL:** share-alike for derived **databases**; produced works (images) just need attribution.

---

## 10. Ecosystem & glossary (A–Z)

- **Area tags** – keys that make a closed way an area (`building`, `landuse`, …).
- **Bbox** – `minlon,minlat,maxlon,maxlat`.
- **cgimap** – C++ fast API read server.
- **Changeset** – bundle of edits with a comment.
- **CyclOSM / OpenCycleMap** – bike-oriented map styles.
- **Diff / replication** – minutely osmChange streams.
- **Element** – node, way or relation.
- **Geofabrik** – company offering free country extracts.
- **GPX** – GPS exchange format for traces.
- **HOT** – Humanitarian OpenStreetMap Team; Humanitarian layer.
- **iD** – default in-browser editor (JavaScript, D3-based).
- **JOSM** – Java desktop editor (remote-control port 8111).
- **Leaflet** – JS map library used by the site.
- **MapLibre GL** – WebGL vector-map renderer.
- **Mapnik** – C++ renderer producing raster tiles.
- **Nominatim** – OSM geocoder.
- **Notes** – public map-bug reports.
- **ODbL** – data licence.
- **OSMF** – OpenStreetMap Foundation.
- **osm2pgsql** – imports OSM data into PostGIS for rendering.
- **osmChange (.osc)** – XML format for diffs/uploads.
- **OSRM / Valhalla / GraphHopper** – routing engines.
- **Overpass API / Overpass QL** – read-only query engine/language.
- **PBF** – compact binary OSM format (`.osm.pbf`).
- **Planet** – full database dump.
- **Quadtile** – spatial index used in apidb and short links.
- **Relation** – grouping element (members with roles).
- **Shortbread** – open vector-tile schema used by OSMF vector tiles.
- **Slippy map** – pannable/zoomable tiled web map.
- **Tags** – key=value metadata.
- **Thunderforest / Tracestrack / MapTiler** – third-party tile providers.
- **Turbo (Hotwire)** – partial page loading used for the sidebar.
- **Way** – ordered list of nodes.
- **Wiki** – `wiki.openstreetmap.org`, the tagging documentation.
- **XYZ tiles** – `{z}/{x}/{y}` tile URL scheme.
- **Zoom levels** – 0 (world) to 19/20+ (building level); edit ≥13, notes ≥12, query ≥14.

---

## 11. Blueprint: rebuilding an "OSM-like" site (for later use)

A minimal full-stack clone that mirrors the real architecture:

**Front-end**
- HTML layout: fixed header (55px) + left sidebar (350px) + full-height map; Bootstrap 5 (or Tailwind) +
  Bootstrap Icons; auto dark mode via `prefers-color-scheme`.
- Map: **Leaflet 1.9.x** with a base `L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom:19,
  attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'})`.
  Optional vector layer via MapLibre GL.
- Controls: zoom, locate (`navigator.geolocation`), layer switcher, share (copy link / iframe), legend, right-click
  context menu (directions from/to, show address, centre map).
- State in URL hash `#map=z/lat/lon&layers=…` + `localStorage`/cookie for last position.
- Client router (pushState) swapping sidebar panels: `/`, `/search`, `/directions`, `/node/:id`, `/way/:id`,
  `/relation/:id`, `/history`, `/export`, `/note/new`.

**Back-end (choose e.g. Node/Express, Django, Rails, Spring)**
- Proxy endpoints (to respect usage policies, add caching and a proper User-Agent):
  - `GET /api/search?q=` → Nominatim `/search?format=jsonv2`
  - `GET /api/reverse?lat=&lon=` → Nominatim `/reverse?format=jsonv2`
  - `GET /api/route?from=&to=&mode=` → OSRM `routing.openstreetmap.de/routed-{car|bike|foot}/route/v1/driving/...`
  - `GET /api/element/:type/:id` → `api.openstreetmap.org/api/0.6/{type}/{id}[/full].json`
  - `POST /api/query` → Overpass (`overpass-api.de/api/interpreter`)
- Own database (PostgreSQL/MongoDB) for app features: users (auth with bcrypt/JWT or OAuth via Google/GitHub),
  saved places/bookmarks, notes (lat, lon, text, status, comments), search history, diary/blog posts.
- Security: CSRF tokens, CSP, HSTS, rate limiting, input validation.

**Data model for a clone's own "notes" feature (mirrors OSM):**
```
User(id, display_name, email, password_hash, created_at, home_lat, home_lon, preferred_editor, locale)
Note(id, lat, lon, status[open|closed|hidden], created_at, closed_at)
NoteComment(id, note_id, user_id?, action[opened|commented|closed|reopened], body, created_at)
Bookmark(id, user_id, name, lat, lon, zoom, layer)
```

---

## 12. Quick reference: useful URLs

```
https://www.openstreetmap.org/#map=5/23.66/90.40                # the analysed view
https://www.openstreetmap.org/?mlat=23.7644&mlon=90.3890#map=16/23.7644/90.3890   # with marker
https://www.openstreetmap.org/node/3442474911                   # Dhaka node
https://www.openstreetmap.org/relation/3921322                  # Dhaka Division boundary
https://www.openstreetmap.org/search?query=Dhaka
https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=23.8103,90.4125;23.7275,90.3854
https://www.openstreetmap.org/query?lat=23.7644&lon=90.3890
https://www.openstreetmap.org/export/embed.html?bbox=90.35,23.70,90.45,23.80&layer=mapnik
https://www.openstreetmap.org/api/0.6/node/3442474911.json
https://www.openstreetmap.org/api/0.6/map.json?bbox=90.3885,23.7640,90.3895,23.7648
https://www.openstreetmap.org/api/capabilities.json
https://nominatim.openstreetmap.org/search?q=Dhaka&format=jsonv2
https://nominatim.openstreetmap.org/reverse?lat=23.81&lon=90.41&format=json
https://routing.openstreetmap.de/routed-car/route/v1/driving/90.4125,23.8103;90.3854,23.7275?overview=full&geometries=geojson&steps=true
https://tile.openstreetmap.org/5/23/13.png                      # a raster tile
https://planet.openstreetmap.org/  ·  https://download.geofabrik.de/asia/bangladesh.html
https://github.com/openstreetmap/openstreetmap-website          # source code (Rails)
https://wiki.openstreetmap.org/wiki/API_v0.6                    # API docs
```
