import { useEffect, useRef, useState } from 'react'
import { Compass, Earth, Layers, LocateFixed, Minus, Plus } from 'lucide-react'
import { Glass, GlassButton, cx } from '../ui/Glass'
import { MAP_STYLES, type MapStyleId, type MapStyleSetting } from '../map/styles'

interface Props {
  styleSetting: MapStyleSetting
  activeStyle: MapStyleId
  globe: boolean
  locating: boolean
  onImagery: boolean
  onStyle(s: MapStyleSetting): void
  onToggleGlobe(): void
  onLocate(): void
  onZoom(delta: number): void
  onResetNorth(): void
  stylesOpen: boolean
  setStylesOpen(open: boolean): void
}

const THUMBS: Record<MapStyleId, string> = {
  muted: 'linear-gradient(135deg,#eef1f0 0%,#dfe5e3 45%,#c9d2cf 46%,#eef1f0 60%,#e2e8e6 100%)',
  light: 'linear-gradient(135deg,#f4efe6 0%,#e8f1e1 40%,#fbd38d 41%,#f4efe6 52%,#bfdbfe 53%,#dbeafe 100%)',
  dark: 'linear-gradient(135deg,#1c2321 0%,#232b29 45%,#3a4744 46%,#1c2321 60%,#121716 100%)',
  satellite: 'radial-gradient(circle at 30% 30%,#5b7a3c 0%,#2f4a2a 40%,#1d3b4f 70%,#0f2433 100%)',
}

/** Right-hand map controls + map style picker (as in the reference design). */
export default function MapControls(p: Props) {
  const popRef = useRef<HTMLDivElement>(null)
  const [focusIdx, setFocusIdx] = useState(0)
  const options: { id: MapStyleSetting; label: string }[] = [
    { id: 'auto', label: 'Auto' },
    ...(Object.keys(MAP_STYLES) as MapStyleId[]).map((id) => ({ id, label: MAP_STYLES[id].label })),
  ]

  // Close the popover on outside click.
  useEffect(() => {
    if (!p.stylesOpen) return
    const onDown = (e: PointerEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) p.setStylesOpen(false)
    }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [p.stylesOpen, p])

  const variant = p.onImagery ? 'clear' : 'regular'

  return (
    <div className={cx('pointer-events-none flex flex-col items-end gap-3', p.onImagery && 'on-imagery')}>
      <div ref={popRef} className="pointer-events-auto relative flex flex-col gap-3">
        <GlassButton
          label="Map style (S)"
          variant={variant}
          aria-expanded={p.stylesOpen}
          aria-haspopup="dialog"
          onClick={() => p.setStylesOpen(!p.stylesOpen)}
        >
          <Layers className="size-5" />
        </GlassButton>
        {p.stylesOpen && (
          <Glass
            variant="strong"
            role="dialog"
            aria-label="Choose your map style"
            className="absolute top-0 right-14 w-[300px] rounded-3xl p-3.5"
          >
            <p className="mb-2.5 px-1 text-[13px] font-semibold">Choose your map style</p>
            <div
              role="radiogroup"
              className="grid grid-cols-5 gap-2"
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                  e.preventDefault()
                  const next = (focusIdx + (e.key === 'ArrowRight' ? 1 : -1) + options.length) % options.length
                  setFocusIdx(next)
                  p.onStyle(options[next].id)
                }
              }}
            >
              {options.map((o, i) => {
                const selected = p.styleSetting === o.id
                const thumbId = o.id === 'auto' ? p.activeStyle : o.id
                return (
                  <button
                    key={o.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => {
                      setFocusIdx(i)
                      p.onStyle(o.id)
                    }}
                    className="group flex flex-col items-center gap-1.5"
                  >
                    <span
                      className={cx(
                        'block size-12 rounded-2xl ring-2 ring-offset-2 ring-offset-transparent transition',
                        selected ? 'ring-accent-500' : 'ring-transparent group-hover:ring-[var(--separator)]',
                      )}
                      style={{
                        background:
                          o.id === 'auto'
                            ? `linear-gradient(135deg, ${THUMBS.muted.match(/#\w+/)?.[0]} 0 50%, #1c2321 50% 100%)`
                            : THUMBS[thumbId],
                      }}
                    />
                    <span className={cx('text-[11.5px]', selected ? 'font-semibold' : 'label-2')}>{o.label}</span>
                  </button>
                )
              })}
            </div>
            <label className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-[var(--fill-2)] px-3 py-2.5 text-[13px]">
              <span className="flex items-center gap-2">
                <Earth className="size-4" /> 3D globe when zoomed out
              </span>
              <input
                type="checkbox"
                className="size-4 accent-[var(--color-accent-600)]"
                checked={p.globe}
                onChange={p.onToggleGlobe}
              />
            </label>
          </Glass>
        )}
      </div>

      <div className="pointer-events-auto flex flex-col gap-3">
        <GlassButton label="Show my location (L)" variant={variant} onClick={p.onLocate}>
          <LocateFixed className={cx('size-5', p.locating && 'animate-pulse text-accent-500')} />
        </GlassButton>
        <GlassButton label="Reset north" variant={variant} onClick={p.onResetNorth} className="hidden md:grid">
          <Compass className="size-5" />
        </GlassButton>
      </div>

      <Glass
        variant={variant}
        lens
        className="pointer-events-auto hidden flex-col overflow-hidden rounded-full md:flex"
        role="group"
        aria-label="Zoom"
      >
        <button type="button" aria-label="Zoom in" title="Zoom in (+)" className="grid size-11 place-items-center hover:bg-[var(--fill-2)]" onClick={() => p.onZoom(1)}>
          <Plus className="size-5" />
        </button>
        <span className="mx-2.5 h-px bg-[var(--separator)]" />
        <button type="button" aria-label="Zoom out" title="Zoom out (−)" className="grid size-11 place-items-center hover:bg-[var(--fill-2)]" onClick={() => p.onZoom(-1)}>
          <Minus className="size-5" />
        </button>
      </Glass>
    </div>
  )
}
