import { useEffect, useRef } from 'react'
import { Compass, Crosshair, GlobeHemisphereEast, Minus, Plus, StackSimple } from '@phosphor-icons/react'
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
  compact?: boolean
}

const THUMBS: Record<MapStyleId, string> = {
  muted: 'linear-gradient(135deg,#eef1f5 0%,#e3e8ef 44%,#ffffff 45%,#ffffff 52%,#d3ecc4 53%,#d3ecc4 70%,#b3d7f5 71%)',
  light: 'linear-gradient(135deg,#f4efe6 0%,#e8f1e1 40%,#fcd9a0 41%,#f4efe6 52%,#bfdbfe 53%,#dbeafe 100%)',
  dark: 'linear-gradient(135deg,#1c2230 0%,#232a38 45%,#3a4558 46%,#1c2230 60%,#121722 100%)',
  satellite: 'radial-gradient(circle at 30% 30%,#6b8a46 0%,#3a5a32 40%,#1d3b4f 70%,#0f2433 100%)',
}

/** Right-hand map controls and the "Choose your map style" popover. */
export default function MapControls(p: Props) {
  const popRef = useRef<HTMLDivElement>(null)
  const options = (Object.keys(MAP_STYLES) as MapStyleId[]).map((id) => ({ id, label: MAP_STYLES[id].label }))

  useEffect(() => {
    if (!p.stylesOpen) return
    const onDown = (e: PointerEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) p.setStylesOpen(false)
    }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [p.stylesOpen, p])

  return (
    <div className="pointer-events-none flex flex-col items-end gap-2.5">
      <div ref={popRef} className="pointer-events-auto relative">
        <GlassButton
          label="Map style (S)"
          aria-expanded={p.stylesOpen}
          aria-haspopup="dialog"
          onClick={() => p.setStylesOpen(!p.stylesOpen)}
          active={p.stylesOpen}
        >
          <StackSimple size={22} weight="duotone" />
        </GlassButton>
        {p.stylesOpen && (
          <Glass
            variant="strong"
            role="dialog"
            aria-label="Choose your map style"
            className={cx('absolute right-14 w-[292px] rounded-3xl p-4', p.compact ? 'bottom-0' : 'top-0')}
          >
            <p className="mb-3 text-[14px] font-semibold">Choose your map style</p>
            <div role="radiogroup" aria-label="Map style" className="grid grid-cols-4 gap-2.5">
              {options.map((o) => {
                const selected = p.styleSetting === o.id || (p.styleSetting === 'auto' && p.activeStyle === o.id)
                return (
                  <button
                    key={o.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => p.onStyle(o.id)}
                    className="group flex flex-col items-center gap-1.5"
                  >
                    <span
                      className={cx(
                        'block h-14 w-full rounded-2xl shadow-inner ring-2 ring-offset-2 ring-offset-white transition',
                        selected ? 'ring-accent-500' : 'ring-transparent group-hover:ring-[var(--separator)]',
                      )}
                      style={{ background: THUMBS[o.id] }}
                    />
                    <span className="flex items-center gap-1 text-[12px]">
                      <span
                        className={cx(
                          'grid size-3 place-items-center rounded-full border',
                          selected ? 'border-accent-600' : 'border-[var(--label-3)]',
                        )}
                      >
                        {selected && <span className="size-1.5 rounded-full bg-accent-600" />}
                      </span>
                      <span className={selected ? 'font-semibold' : 'label-2'}>{o.label}</span>
                    </span>
                  </button>
                )
              })}
            </div>
            <label className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-[var(--fill-2)] px-3 py-2.5 text-[13px]">
              <span className="flex items-center gap-2">
                <GlobeHemisphereEast size={18} weight="duotone" className="text-accent-600" /> 3D globe when zoomed out
              </span>
              <input type="checkbox" className="size-4 accent-[var(--color-accent-600)]" checked={p.globe} onChange={p.onToggleGlobe} />
            </label>
          </Glass>
        )}
      </div>

      <GlassButton label="Show my location (L)" onClick={p.onLocate} className="pointer-events-auto">
        <Crosshair size={24} weight="bold" className={cx(p.locating && 'animate-spin [animation-duration:2s]')} />
      </GlassButton>

      {!p.compact && (
        <>
          <GlassButton label="Reset north" onClick={p.onResetNorth} className="pointer-events-auto">
            <Compass size={22} weight="duotone" />
          </GlassButton>
          <Glass variant="strong" className="pointer-events-auto flex flex-col overflow-hidden rounded-full" role="group" aria-label="Zoom">
            <button type="button" aria-label="Zoom in" title="Zoom in (+)" className="grid size-12 place-items-center text-accent-600 hover:bg-[var(--fill-2)]" onClick={() => p.onZoom(1)}>
              <Plus size={20} weight="bold" />
            </button>
            <span className="mx-3 h-px bg-[var(--separator)]" />
            <button type="button" aria-label="Zoom out" title="Zoom out (−)" className="grid size-12 place-items-center text-accent-600 hover:bg-[var(--fill-2)]" onClick={() => p.onZoom(-1)}>
              <Minus size={20} weight="bold" />
            </button>
          </Glass>
        </>
      )}
    </div>
  )
}
