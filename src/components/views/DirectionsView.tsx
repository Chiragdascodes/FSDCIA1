import {
  ArrowBendUpLeft,
  ArrowBendUpRight,
  ArrowClockwise,
  ArrowUp,
  ArrowUUpLeft,
  ArrowsMerge,
  ArrowsSplit,
  FlagCheckered,
  NavigationArrow,
} from '@phosphor-icons/react'
import { formatDistance } from '../../js/geo.js'
import type { Beacon } from '../../state/useBeacon'
import type { RouteStep } from '../../types'
import { EmptyState, PillButton, SkeletonRows } from '../common'

function StepIcon({ step }: { step: RouteStep }) {
  const m = step.modifier
  const p = { size: 20, weight: 'bold' as const }
  if (step.maneuver === 'arrive') return <FlagCheckered {...p} weight="fill" />
  if (step.maneuver === 'depart') return <NavigationArrow {...p} weight="fill" />
  if (step.maneuver === 'merge') return <ArrowsMerge {...p} />
  if (step.maneuver === 'fork') return <ArrowsSplit {...p} />
  if (m === 'uturn') return <ArrowUUpLeft {...p} />
  if (m.includes('left')) return <ArrowBendUpLeft {...p} />
  if (m.includes('right')) return <ArrowBendUpRight {...p} />
  return <ArrowUp {...p} />
}

/** Turn-by-turn steps (the route summary lives in the RouteCard at the top). */
export default function DirectionsView({ b, id }: { b: Beacon; id: string }) {
  const units = b.settings.units
  const r = b.route
  const arrival = r ? new Date(Date.now() + r.duration * 1000) : null

  return (
    <div className="px-4 pb-8">
      <h2 className="font-display pt-1 text-[19px] font-bold">Steps</h2>
      {r && (
        <p className="label-2 mb-2 text-[13.5px]">
          Arrive around {arrival?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {r.steps.length} steps
        </p>
      )}

      {b.routeStatus === 'loading' && (
        <>
          <p role="status" className="label-2 py-2 text-[13px]">
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
            <PillButton onClick={() => b.directions(id, b.mode, b.routeReversed)}>
              <ArrowClockwise size={16} weight="bold" /> Try again
            </PillButton>
          }
        />
      )}

      {b.routeStatus === 'done' && r && (
        <>
          <ol className="space-y-0.5" aria-label="Turn-by-turn steps">
            {r.steps.map((s, i) => (
              <li key={i} className="flex items-start gap-3 rounded-xl py-2.5">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-50 text-accent-600">
                  <StepIcon step={s} />
                </span>
                <span className="min-w-0 flex-1 pt-2 text-[15px]">{s.instruction}</span>
                {s.distance > 0 && (
                  <span className="label-2 shrink-0 pt-2 text-[13px] tabular-nums">{formatDistance(s.distance, units)}</span>
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
  )
}
