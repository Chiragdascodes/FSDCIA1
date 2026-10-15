import {
  ArrowUp,
  Bike,
  Car,
  CornerUpLeft,
  CornerUpRight,
  ExternalLink,
  Flag,
  Footprints,
  LocateFixed,
  Merge,
  RotateCw,
  Split,
  Undo2,
} from 'lucide-react'
import { formatDistance, formatDuration } from '../../js/geo.js'
import type { Beacon } from '../../state/useBeacon'
import type { RouteStep, TravelMode } from '../../types'
import { cx } from '../../ui/Glass'
import { EmptyState, PillButton, SkeletonRows, ViewHeader } from '../common'

const MODES: { id: TravelMode; label: string; icon: typeof Footprints }[] = [
  { id: 'foot', label: 'Walk', icon: Footprints },
  { id: 'bike', label: 'Cycle', icon: Bike },
  { id: 'car', label: 'Drive', icon: Car },
]

function StepIcon({ step }: { step: RouteStep }) {
  const m = step.modifier
  const cls = 'size-[18px]'
  if (step.maneuver === 'arrive') return <Flag className={cls} />
  if (step.maneuver === 'depart') return <LocateFixed className={cls} />
  if (step.maneuver === 'merge') return <Merge className={cls} />
  if (step.maneuver === 'fork') return <Split className={cls} />
  if (m === 'uturn') return <Undo2 className={cls} />
  if (m.includes('left')) return <CornerUpLeft className={cls} />
  if (m.includes('right')) return <CornerUpRight className={cls} />
  return <ArrowUp className={cls} />
}

export default function DirectionsView({ b, id }: { b: Beacon; id: string }) {
  const place = b.placesById.get(id)
  const units = b.settings.units
  const r = b.route
  const arrival = r ? new Date(Date.now() + r.duration * 1000) : null
  const osmLink = place
    ? `https://www.openstreetmap.org/directions?engine=fossgis_osrm_${b.mode === 'foot' ? 'foot' : b.mode === 'bike' ? 'bike' : 'car'}&route=${
        b.user ? `${b.user.lat}%2C${b.user.lon}` : ''
      }%3B${place.lat}%2C${place.lon}`
    : '#'

  return (
    <div className="pb-8">
      <ViewHeader
        title={place ? `To ${place.name}` : 'Directions'}
        subtitle={b.user ? 'From your location' : `From ${b.anchor?.label ?? 'the search centre'}`}
        onBack={b.closeDirections}
      />

      <div className="px-4">
        <div role="radiogroup" aria-label="Travel mode" className="mb-4 grid grid-cols-3 gap-1 rounded-full bg-[var(--fill)] p-1">
          {MODES.map((m) => {
            const Icon = m.icon
            const on = b.mode === m.id
            return (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => b.directions(id, m.id)}
                className={cx(
                  'flex items-center justify-center gap-1.5 rounded-full py-2 text-[13.5px] font-semibold transition',
                  on ? 'bg-[var(--app-bg)] shadow-sm' : 'label-2 hover:text-[var(--label)]',
                )}
              >
                <Icon className="size-4" /> {m.label}
              </button>
            )
          })}
        </div>

        {b.routeStatus === 'loading' && (
          <>
            <p role="status" className="label-2 pb-2 text-[13px]">
              Finding the best route…
            </p>
            <SkeletonRows count={4} />
          </>
        )}

        {b.routeStatus === 'error' && (
          <EmptyState
            tone="error"
            title="Couldn’t get a route"
            body={b.routeError}
            actions={
              <PillButton onClick={() => b.directions(id, b.mode)}>
                <RotateCw className="size-4" /> Try again
              </PillButton>
            }
          />
        )}

        {b.routeStatus === 'done' && r && (
          <>
            <div className="mb-4 flex items-end justify-between rounded-2xl bg-[#0a84ff]/10 p-4">
              <div>
                <p className="text-[28px] leading-none font-bold tracking-tight text-[#0a84ff]">{formatDuration(r.duration)}</p>
                <p className="label-2 mt-1 text-[13.5px]">
                  {formatDistance(r.distance, units)} · arrive {arrival?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <a
                href={osmLink}
                target="_blank"
                rel="noopener noreferrer"
                className="label-2 inline-flex items-center gap-1 text-[12px] hover:text-[var(--label)]"
              >
                OSM <ExternalLink className="size-3" />
              </a>
            </div>
            <ol className="space-y-0.5" aria-label="Turn-by-turn steps">
              {r.steps.map((s, i) => (
                <li key={i} className="flex items-start gap-3 rounded-xl px-1 py-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--fill)]">
                    <StepIcon step={s} />
                  </span>
                  <span className="min-w-0 flex-1 pt-1 text-[14.5px]">{s.instruction}</span>
                  {s.distance > 0 && (
                    <span className="label-2 shrink-0 pt-1 text-[13px] tabular-nums">{formatDistance(s.distance, units)}</span>
                  )}
                </li>
              ))}
            </ol>
            <p className="label-3 mt-4 text-[11.5px]">
              Routing by OSRM (FOSSGIS) on OpenStreetMap data. Check the route on the ground — paths can be missing.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
