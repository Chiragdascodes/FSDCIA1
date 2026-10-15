import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import {
  ArrowBendUpLeft,
  ArrowBendUpRight,
  ArrowUp,
  ArrowUUpLeft,
  ArrowsMerge,
  ArrowsSplit,
  Bicycle,
  Car,
  CheckCircle,
  Crosshair,
  FlagCheckered,
  NavigationArrow,
  Pause,
  PersonSimpleWalk,
  Play,
  X,
} from '@phosphor-icons/react'
import { formatDistance, formatDuration } from '../js/geo.js'
import { buildRouteIndex, NAV_CAMERA, pointAlong, progress, SIM_SPEED, snapToRoute } from '../js/navigation.js'
import type { BeaconMapHandle } from '../map/BeaconMap'
import type { Route, RouteStep, TravelMode } from '../types'
import { cx, Glass } from '../ui/Glass'

interface Props {
  route: Route
  mode: TravelMode
  destination: string
  user: { lat: number; lon: number } | null
  units: 'metric' | 'imperial'
  reducedMotion: boolean
  mapRef: RefObject<BeaconMapHandle | null>
  onExit(): void
}

function TurnIcon({ step, size }: { step: RouteStep | undefined; size: number }) {
  const p = { size, weight: 'bold' as const }
  if (!step) return <ArrowUp {...p} />
  const m = step.modifier
  if (step.maneuver === 'arrive') return <FlagCheckered {...p} weight="fill" />
  if (step.maneuver === 'merge') return <ArrowsMerge {...p} />
  if (step.maneuver === 'fork') return <ArrowsSplit {...p} />
  if (m === 'uturn') return <ArrowUUpLeft {...p} />
  if (m.includes('left')) return <ArrowBendUpLeft {...p} />
  if (m.includes('right')) return <ArrowBendUpRight {...p} />
  return <ArrowUp {...p} />
}

const MODE_ICON = { foot: PersonSimpleWalk, bike: Bicycle, car: Car }
const MODE_LABEL = { foot: 'Walking', bike: 'Cycling', car: 'Driving' }

/**
 * Full-screen turn-by-turn navigation (like Google Maps):
 *  - the camera follows a direction arrow, tilted and rotated to the heading;
 *  - live GPS (watchPosition) is snapped onto the route when the user is on it;
 *  - otherwise a simulated trip plays along the route so it can be demoed anywhere.
 */
export default function Navigation({ route, mode, destination, user, units, reducedMotion, mapRef, onExit }: Props) {
  const idx = useMemo(() => buildRouteIndex(route.geometry.coordinates), [route])
  const live = useMemo(() => !!user && snapToRoute(idx, user).offRoute < 80, [idx]) // decided once at start
  const [along, setAlong] = useState(0)
  const [paused, setPaused] = useState(false)
  const [following, setFollowing] = useState(true)
  const alongRef = useRef(0)
  const pausedRef = useRef(paused)
  pausedRef.current = paused
  const followRef = useRef(following)
  followRef.current = following
  const cam = NAV_CAMERA[mode]

  // Simulated trip: advance along the route every animation frame.
  useEffect(() => {
    if (live) return
    let raf = 0
    let last = performance.now()
    let lastState = 0
    const tick = (t: number) => {
      const dt = Math.min(0.1, (t - last) / 1000)
      last = t
      if (!pausedRef.current) alongRef.current = Math.min(idx.total, alongRef.current + SIM_SPEED[mode] * dt)
      const p = pointAlong(idx, alongRef.current)
      mapRef.current?.navMarker(p, p.heading, mode)
      if (followRef.current) mapRef.current?.navFrame(p.lon, p.lat, p.heading, cam.zoom, cam.pitch)
      if (t - lastState > 200) {
        lastState = t
        setAlong(alongRef.current)
      }
      if (alongRef.current < idx.total) raf = requestAnimationFrame(tick)
      else setAlong(idx.total)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [live, idx, mode, mapRef, cam.zoom, cam.pitch])

  // Live trip: every new GPS fix is snapped to the route.
  useEffect(() => {
    if (!live || !user) return
    const s = snapToRoute(idx, user)
    alongRef.current = Math.max(alongRef.current, s.along)
    setAlong(alongRef.current)
    const p = s.offRoute < 40 ? pointAlong(idx, alongRef.current) : { ...user, heading: s.heading }
    mapRef.current?.navMarker(p, s.heading, mode)
    if (followRef.current) mapRef.current?.navFrame(p.lon, p.lat, s.heading, cam.zoom, cam.pitch)
  }, [live, user, idx, mode, mapRef, cam.zoom, cam.pitch])

  // Remove the marker and flatten the camera on exit.
  useEffect(
    () => () => {
      mapRef.current?.navMarker(null, 0, mode)
      mapRef.current?.exitNav()
    },
    [mapRef, mode],
  )

  const prog = progress(route, idx, along)
  const next = route.steps[prog.stepIndex]
  const after = route.steps[prog.stepIndex + 1]
  const arrival = new Date(Date.now() + prog.remainingSeconds * 1000)
  const ModeIcon = MODE_ICON[mode]

  return (
    <div className="pointer-events-none absolute inset-0 z-40 flex flex-col justify-between p-3 md:p-4">
      {/* Next manoeuvre banner */}
      <div className="pointer-events-auto mx-auto w-full max-w-[560px]" role="status" aria-live="polite">
        {prog.arrived ? (
          <div className="flex items-center gap-4 rounded-[26px] bg-emerald-600 p-4 text-white shadow-xl">
            <CheckCircle size={44} weight="fill" />
            <div>
              <p className="font-display text-[22px] font-bold">You have arrived</p>
              <p className="text-[15px] opacity-90">{destination}</p>
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[26px] bg-accent-600 text-white shadow-[0_18px_40px_-16px_rgb(36_89_192/0.9)]">
            <div className="flex items-center gap-4 p-4">
              <span className="grid size-16 shrink-0 place-items-center rounded-full bg-white/15">
                <TurnIcon step={next} size={38} />
              </span>
              <div className="min-w-0">
                <p className="font-display text-[30px] leading-none font-bold tabular-nums">{formatDistance(prog.toNext, units)}</p>
                <p className="mt-1 truncate text-[17px] font-medium">{next?.instruction ?? 'Continue'}</p>
              </div>
            </div>
            {after && (
              <div className="flex items-center gap-2 bg-black/15 px-5 py-2 text-[14px]">
                Then <TurnIcon step={after} size={18} /> <span className="truncate opacity-90">{after.instruction}</span>
              </div>
            )}
          </div>
        )}
        {!live && (
          <p className="mx-auto mt-2 w-fit rounded-full bg-black/60 px-3 py-1 text-[12px] font-medium text-white">
            Simulated trip — live GPS is used when you’re on the route
          </p>
        )}
      </div>

      {/* Bottom summary */}
      <div className="pointer-events-auto mx-auto flex w-full max-w-[560px] flex-col items-end gap-3">
        {!following && (
          <button
            type="button"
            onClick={() => setFollowing(true)}
            className="glass glass-strong glass-btn flex items-center gap-2 rounded-full px-4 py-2.5 text-[14px] font-semibold text-accent-600"
          >
            <Crosshair size={18} weight="bold" /> Re-centre
          </button>
        )}
        <Glass variant="strong" className="flex w-full items-center gap-3 rounded-[26px] p-3 pl-5">
          <div className="min-w-0 flex-1">
            <p className="font-display text-[26px] leading-none font-bold text-emerald-600 tabular-nums">
              {prog.arrived ? 'Arrived' : formatDuration(prog.remainingSeconds)}
            </p>
            <p className="label-2 mt-1 flex items-center gap-1.5 text-[14px] tabular-nums">
              <ModeIcon size={16} weight="fill" className="text-accent-600" />
              {MODE_LABEL[mode]} · {formatDistance(prog.remaining, units)} ·{' '}
              {arrival.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          {!live && !prog.arrived && (
            <button
              type="button"
              aria-label={paused ? 'Resume simulation' : 'Pause simulation'}
              onClick={() => setPaused((p) => !p)}
              className="grid size-12 place-items-center rounded-full bg-[var(--fill)] text-accent-600"
            >
              {paused ? <Play size={22} weight="fill" /> : <Pause size={22} weight="fill" />}
            </button>
          )}
          <button
            type="button"
            onClick={() => setFollowing((f) => !f)}
            aria-pressed={following}
            aria-label="Follow my position"
            className={cx('grid size-12 place-items-center rounded-full', following ? 'bg-accent-600 text-white' : 'bg-[var(--fill)] text-accent-600')}
          >
            <NavigationArrow size={22} weight="fill" />
          </button>
          <button
            type="button"
            onClick={onExit}
            className="flex h-12 items-center gap-1.5 rounded-full bg-pin-500 px-5 text-[16px] font-semibold text-white hover:bg-pin-600"
          >
            <X size={18} weight="bold" /> {prog.arrived ? 'Done' : 'Exit'}
          </button>
        </Glass>
      </div>
      {reducedMotion && <span className="sr-only">Animations are reduced; the camera jumps instead of gliding.</span>}
    </div>
  )
}
