import { forwardRef, useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { ArrowUpLeft, Clock, LoaderCircle, MapPin, Search, Sparkles, X } from 'lucide-react'
import * as api from '../js/api.js'
import { debounce } from '../js/events.js'
import { distanceMeters, formatDistance } from '../js/geo.js'
import { describeQuery, parseQuery } from '../js/queryParser.js'
import type { LatLon, ParsedQuery, Place } from '../types'
import { cx, Glass } from '../ui/Glass'
import { iconFor } from '../ui/icons'

export interface SearchBarHandle {
  focus(): void
  blur(): void
}

interface Props {
  value: string
  error: string | null
  near: LatLon | null
  units: 'metric' | 'imperial'
  recents: string[]
  busy: boolean
  onChange(v: string): void
  onSubmit(v: string): void
  onPickPlace(p: Place): void
  onClearRecents(): void
  onClearError(): void
  onFocusChange?(focused: boolean): void
}

type Row =
  | { kind: 'intent'; text: string; q: ParsedQuery }
  | { kind: 'recent'; text: string }
  | { kind: 'example'; text: string }
  | { kind: 'place'; place: Place }

const EXAMPLES = ['pharmacy near me', 'open atm near MG Road', '24/7 hospital nearby', 'washroom near Cubbon Park']

/**
 * Search field with live suggestions.
 * Events: `input` (debounced Photon type-ahead), `submit`, `keydown` (↑ ↓ Enter Esc), `focus`/`blur`.
 */
const SearchBar = forwardRef<SearchBarHandle, Props>(function SearchBar(p, ref) {
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()
  const errorId = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [suggestions, setSuggestions] = useState<Place[]>([])
  const [loading, setLoading] = useState(false)
  const [suggestError, setSuggestError] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const nearRef = useRef(p.near)
  nearRef.current = p.near

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    blur: () => inputRef.current?.blur(),
  }))

  // Debounced type-ahead (Photon is built for search-as-you-type; Nominatim's policy forbids it).
  const fetchSuggestions = useMemo(
    () =>
      debounce(async (text: string) => {
        abortRef.current?.abort()
        const q = parseQuery(text)
        const term = q.anchor.type === 'place' ? q.anchor.text : q.category ? '' : q.what
        if (!term || term.length < 3) {
          setSuggestions([])
          setLoading(false)
          return
        }
        const ctrl = new AbortController()
        abortRef.current = ctrl
        setLoading(true)
        setSuggestError(false)
        try {
          const places = await api.suggest(term, { near: nearRef.current, limit: 6, signal: ctrl.signal })
          if (!ctrl.signal.aborted) setSuggestions(places)
        } catch (e) {
          if (!(e instanceof api.ApiError && e.kind === 'aborted')) {
            setSuggestions([])
            setSuggestError(true)
          }
        } finally {
          if (!ctrl.signal.aborted) setLoading(false)
        }
      }, 320),
    [],
  )

  useEffect(() => () => fetchSuggestions.cancel(), [fetchSuggestions])

  const parsedPreview = useMemo(() => (p.value.trim().length >= 2 ? parseQuery(p.value) : null), [p.value])

  const rows: Row[] = useMemo(() => {
    const v = p.value.trim()
    if (!v) {
      return p.recents.length
        ? p.recents.map((text) => ({ kind: 'recent' as const, text }))
        : EXAMPLES.map((text) => ({ kind: 'example' as const, text }))
    }
    const list: Row[] = []
    if (parsedPreview && parsedPreview.intent !== 'place' && parsedPreview.intent !== 'empty') {
      list.push({ kind: 'intent', text: v, q: parsedPreview })
    }
    for (const place of suggestions) list.push({ kind: 'place', place })
    return list
  }, [p.value, p.recents, parsedPreview, suggestions])

  const submit = (text: string) => {
    setOpen(false)
    setActive(-1)
    inputRef.current?.blur()
    p.onSubmit(text)
  }

  const choose = (row: Row) => {
    if (row.kind === 'place') {
      setOpen(false)
      inputRef.current?.blur()
      // "pharmacy near MG Ro…" + picking "MG Road" → search the category near that exact place.
      const q = parseQuery(p.value)
      if (q.anchor.type === 'place' && (q.category || q.what)) {
        const prefix = q.category ? q.category.label : q.what
        const text = `${prefix} near ${row.place.name}`
        p.onChange(text)
        p.onSubmit(text)
      } else {
        p.onChange(row.place.name)
        p.onPickPlace(row.place)
      }
      return
    }
    p.onChange(row.text)
    submit(row.text)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((i) => Math.min(rows.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(-1, i - 1))
    } else if (e.key === 'Enter' && open && active >= 0 && rows[active]) {
      e.preventDefault()
      choose(rows[active])
    } else if (e.key === 'Escape') {
      if (p.value && !open) p.onChange('')
      setOpen(false)
      inputRef.current?.blur()
    }
  }

  const showList = open && (rows.length > 0 || loading)

  return (
    <div className="relative">
      <form
        role="search"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          submit(p.value)
        }}
      >
        <Glass
          lens
          className={cx(
            'flex h-12 items-center gap-2 rounded-full pr-1.5 pl-4 transition-shadow',
            p.error && 'ring-2 ring-red-500/70',
          )}
        >
          {p.busy ? (
            <LoaderCircle className="size-[18px] shrink-0 animate-spin text-accent-600" aria-hidden />
          ) : (
            <Search className="label-2 size-[18px] shrink-0" aria-hidden />
          )}
          <label htmlFor="beacon-search" className="sr-only">
            Search for essentials or places
          </label>
          <input
            ref={inputRef}
            id="beacon-search"
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            spellCheck={false}
            maxLength={120}
            placeholder="Search “pharmacy near me”"
            className="h-full min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-[var(--label-3)] [&::-webkit-search-cancel-button]:hidden"
            value={p.value}
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
            aria-invalid={!!p.error}
            aria-describedby={p.error ? errorId : undefined}
            onChange={(e) => {
              p.onChange(e.target.value)
              if (p.error) p.onClearError()
              setOpen(true)
              setActive(-1)
              fetchSuggestions(e.target.value)
            }}
            onFocus={() => {
              setOpen(true)
              p.onFocusChange?.(true)
            }}
            onBlur={() => {
              // Delay so a click on a suggestion registers first.
              setTimeout(() => setOpen(false), 150)
              p.onFocusChange?.(false)
            }}
            onKeyDown={onKeyDown}
          />
          {p.value && (
            <button
              type="button"
              aria-label="Clear search"
              className="label-2 grid size-8 place-items-center rounded-full hover:bg-[var(--fill)]"
              onClick={() => {
                p.onChange('')
                setSuggestions([])
                inputRef.current?.focus()
              }}
            >
              <X className="size-4" />
            </button>
          )}
          <button
            type="submit"
            aria-label="Search"
            className="glass-btn grid size-9 place-items-center rounded-full bg-accent-600 text-white hover:bg-accent-700"
          >
            <ArrowUpLeft className="size-[18px] rotate-90" />
          </button>
        </Glass>
      </form>

      {p.error && (
        <p id={errorId} role="alert" className="mt-2 px-4 text-[13px] font-medium text-red-600 dark:text-red-400">
          {p.error}
        </p>
      )}

      {showList && (
        <Glass
          variant="strong"
          className="absolute inset-x-0 top-[calc(100%+8px)] z-30 max-h-[min(60vh,420px)] overflow-y-auto rounded-3xl p-1.5 thin-scrollbar"
        >
          <ul id={listId} role="listbox" aria-label="Search suggestions">
            {!p.value.trim() && (
              <li className="label-3 flex items-center justify-between px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wide uppercase">
                {p.recents.length ? 'Recent searches' : 'Try asking'}
                {p.recents.length > 0 && (
                  <button
                    type="button"
                    className="text-[11px] font-semibold text-accent-600 normal-case"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={p.onClearRecents}
                  >
                    Clear
                  </button>
                )}
              </li>
            )}
            {rows.map((row, i) => (
              <li
                key={row.kind === 'place' ? row.place.id : `${row.kind}-${row.text}`}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                className={cx(
                  'flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-2.5',
                  i === active ? 'bg-[var(--fill)]' : 'hover:bg-[var(--fill-2)]',
                )}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(row)}
              >
                <RowContent row={row} near={p.near} units={p.units} />
              </li>
            ))}
            {loading && (
              <li className="label-2 flex items-center gap-2 px-3 py-2.5 text-[13px]">
                <LoaderCircle className="size-4 animate-spin" /> Finding places…
              </li>
            )}
            {suggestError && !loading && (
              <li className="label-2 px-3 py-2.5 text-[13px]">Suggestions unavailable — press Enter to search anyway.</li>
            )}
          </ul>
        </Glass>
      )}
    </div>
  )
})

function RowContent({ row, near, units }: { row: Row; near: LatLon | null; units: 'metric' | 'imperial' }) {
  if (row.kind === 'intent') {
    const Icon = row.q.category ? iconFor(row.q.category.icon) : Sparkles
    return (
      <>
        <span
          className="grid size-9 shrink-0 place-items-center rounded-full text-white"
          style={{ background: row.q.category?.color ?? 'var(--color-accent-600)' }}
        >
          <Icon className="size-[18px]" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-semibold">{describeQuery(row.q)}</span>
          <span className="label-2 block text-[12.5px]">Understood as a nearby search · press Enter</span>
        </span>
      </>
    )
  }
  if (row.kind === 'recent' || row.kind === 'example') {
    const Icon = row.kind === 'recent' ? Clock : Sparkles
    return (
      <>
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--fill)]">
          <Icon className="label-2 size-4" />
        </span>
        <span className="truncate text-[15px]">{row.text}</span>
      </>
    )
  }
  const pl = row.place
  const dist = near ? formatDistance(distanceMeters(near, pl), units) : ''
  const sub = api.localityLine(pl.address) || pl.address.country
  return (
    <>
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--fill)]">
        <MapPin className="label-2 size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium">{pl.name}</span>
        <span className="label-2 block truncate text-[12.5px]">
          {pl.kind}
          {sub ? ` · ${sub}` : ''}
        </span>
      </span>
      {dist && <span className="label-3 shrink-0 text-[12px] tabular-nums">{dist}</span>}
    </>
  )
}

export default SearchBar
