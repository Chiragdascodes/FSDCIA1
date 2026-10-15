import { useEffect, useRef, useState } from 'react'
import { ArrowSquareOut, ArrowsDownUp, Bicycle, Car, CaretLeft, DotsThree, MapPin, Motorcycle, PersonSimpleWalk, type Icon } from '@phosphor-icons/react'
import { formatDistance, formatDuration } from '../js/geo.js'
import type { Beacon } from '../state/useBeacon'
import type { TravelMode } from '../types'
import { cx, Glass } from '../ui/Glass'

const MODES: { id: TravelMode; label: string; icon: Icon }[] = [
  { id: 'foot', label: 'Walking', icon: PersonSimpleWalk },
  { id: 'bike', label: 'Bicycle', icon: Bicycle },
  { id: 'moto', label: 'Motorbike', icon: Motorcycle },
  { id: 'car', label: 'Car', icon: Car },
]

/**
 * Top route card (third screen of the reference UI): "Your place" → destination, swap button,
 * a Google-Maps-style travel mode switcher (walk / cycle / motorbike / car) and distance + time.
 */
export default function RouteCard({ b, id }: { b: Beacon; id: string }) {
  const [menu, setMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const place = b.placesById.get(id)
  const r = b.route
  const fromLabel = b.user ? 'Your place' : b.anchor?.label ?? 'Search centre'
  const toLabel = place?.name ?? 'Destination'
  const [top, bottom] = b.routeReversed ? [toLabel, fromLabel] : [fromLabel, toLabel]
  const units = b.settings.units

  useEffect(() => {
    if (!menu) return
    const close = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false)
    }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [menu])

  const osmLink = place
    ? `https://www.openstreetmap.org/directions?engine=fossgis_osrm_${b.mode}&route=${b.user ? `${b.user.lat}%2C${b.user.lon}` : ''}%3B${place.lat}%2C${place.lon}`
    : 'https://www.openstreetmap.org/directions'

  return (
    <Glass variant="strong" className="rounded-[26px] p-3.5" aria-label="Route">
      <div className="flex items-stretch gap-2.5">
        <button
          type="button"
          aria-label="Close directions"
          onClick={b.closeDirections}
          className="grid w-8 shrink-0 place-items-center rounded-xl text-[var(--label-2)] hover:bg-[var(--fill)]"
        >
          <CaretLeft size={20} weight="bold" />
        </button>
        <div className="relative min-w-0 flex-1 space-y-2">
          {/* dotted connector between the two endpoints */}
          <span className="absolute top-[22px] bottom-[22px] left-[19px] border-l-2 border-dotted border-[var(--label-3)]" aria-hidden />
          {[top, bottom].map((label, i) => {
            const isPlace = (i === 1) !== b.routeReversed
            return (
              <div
                key={i}
                className="relative flex h-11 items-center gap-3 rounded-2xl border border-[var(--separator)] bg-white/70 px-3 text-[15.5px] dark:bg-white/5"
              >
                {isPlace ? (
                  <MapPin size={18} weight="fill" className="shrink-0 text-pin-500" />
                ) : (
                  <span className="grid size-[18px] shrink-0 place-items-center rounded-full bg-accent-100">
                    <span className="size-2.5 rounded-full bg-accent-500" />
                  </span>
                )}
                <span className="truncate">{label}</span>
              </div>
            )
          })}
        </div>
        <div className="flex flex-col justify-between gap-2">
          <div ref={menuRef} className="relative">
            <button
              type="button"
              aria-label="More route options"
              aria-haspopup="menu"
              aria-expanded={menu}
              onClick={() => setMenu((m) => !m)}
              className="grid size-11 place-items-center rounded-full bg-[var(--fill)] text-[var(--label-2)] hover:bg-accent-50"
            >
              <DotsThree size={22} weight="bold" />
            </button>
            {menu && (
              <div role="menu" className="glass glass-menu absolute top-12 right-0 z-30 w-56 rounded-2xl p-1.5">
                <a
                  role="menuitem"
                  href={osmLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] hover:bg-accent-50"
                  onClick={() => setMenu(false)}
                >
                  <ArrowSquareOut size={18} className="text-accent-600" /> Compare on OpenStreetMap
                </a>
              </div>
            )}
          </div>
          <button
            type="button"
            aria-label="Swap start and destination"
            onClick={() => b.directions(id, b.mode, !b.routeReversed)}
            className="grid size-11 place-items-center rounded-full bg-[var(--fill)] text-[var(--label-2)] hover:bg-accent-50"
          >
            <ArrowsDownUp size={20} weight="bold" />
          </button>
        </div>
      </div>

      {/* Travel mode switcher (like Google Maps): icon pills, the selected one shows its time. */}
      <div role="radiogroup" aria-label="Travel mode" className="mt-3 grid grid-cols-4 gap-1.5 rounded-full bg-[var(--fill)] p-1">
        {MODES.map((m) => {
          const on = b.mode === m.id
          const Icon = m.icon
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={m.label}
              title={m.label}
              onClick={() => !on && b.directions(id, m.id, b.routeReversed)}
              className={cx(
                'glass-btn flex h-10 items-center justify-center gap-1.5 rounded-full text-[13px] font-semibold transition-colors',
                on ? 'bg-accent-600 text-white shadow-[0_6px_14px_-6px_rgb(47_111_223/0.9)]' : 'text-[var(--label-2)] hover:text-accent-600',
              )}
            >
              <Icon size={20} weight={on ? 'fill' : 'regular'} />
              {on && (r ? formatDuration(r.duration) : b.routeStatus === 'loading' ? '…' : '')}
            </button>
          )
        })}
      </div>

      <dl className="mt-2.5 grid grid-cols-2 gap-2 px-1 text-center">
        <div>
          <dt className="label-2 text-[12.5px]">Distance</dt>
          <dd className="font-display mt-0.5 text-[20px] font-semibold tabular-nums">
            {r ? formatDistance(r.distance, units) : b.routeStatus === 'loading' ? '…' : '—'}
          </dd>
        </div>
        <div>
          <dt className="label-2 text-[12.5px]">{MODES.find((m) => m.id === b.mode)?.label}</dt>
          <dd className="font-display mt-0.5 text-[20px] font-semibold text-accent-600 tabular-nums">
            {r ? formatDuration(r.duration) : b.routeStatus === 'loading' ? '…' : '—'}
          </dd>
        </div>
      </dl>
    </Glass>
  )
}
