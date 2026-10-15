import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { cx, Glass } from '../ui/Glass'

export type Detent = 'peek' | 'half' | 'full'

interface Props {
  detent: Detent
  onDetent(d: Detent): void
  header?: ReactNode
  children: ReactNode
  label: string
}

/** Heights for each resting position (HIG Sheets: medium/large detents + a grabber). */
function heights(vh: number): Record<Detent, number> {
  return { peek: 148, half: Math.round(vh * 0.5), full: Math.round(vh - 104) }
}

/**
 * Mobile bottom sheet. Drag the grabber/header with pointer events (pointerdown → move → up);
 * on release it snaps to the nearest detent, taking flick velocity into account.
 * Tapping the grabber cycles detents; keyboard users can press Enter/Space on it.
 */
export default function Sheet({ detent, onDetent, header, children, label }: Props) {
  const [vh, setVh] = useState(() => window.innerHeight)
  const [drag, setDrag] = useState<number | null>(null)
  const start = useRef<{ y: number; h: number; t: number } | null>(null)
  const moved = useRef(false)

  useEffect(() => {
    const onResize = () => setVh(window.innerHeight)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const h = heights(vh)
  const height = drag ?? h[detent]

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if ((e.target as HTMLElement).closest('button, a, input, select, textarea, label')) return
      start.current = { y: e.clientY, h: h[detent], t: performance.now() }
      moved.current = false
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    },
    [detent, h],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!start.current) return
      const dy = start.current.y - e.clientY
      if (Math.abs(dy) > 4) moved.current = true
      setDrag(Math.max(96, Math.min(h.full + 20, start.current.h + dy)))
    },
    [h.full],
  )

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const s = start.current
      start.current = null
      if (!s) return
      if (!moved.current) {
        setDrag(null)
        return
      }
      const current = Math.max(96, Math.min(h.full, s.h + (s.y - e.clientY)))
      const velocity = (s.y - e.clientY) / Math.max(1, performance.now() - s.t) // px/ms, + = up
      const order: Detent[] = ['peek', 'half', 'full']
      let target: Detent = order.reduce((best, d) => (Math.abs(h[d] - current) < Math.abs(h[best] - current) ? d : best), 'peek')
      if (Math.abs(velocity) > 0.6) {
        const idx = order.indexOf(detent)
        target = order[Math.max(0, Math.min(2, idx + (velocity > 0 ? 1 : -1)))]
      }
      setDrag(null)
      onDetent(target)
    },
    [detent, h, onDetent],
  )

  const cycle = () => onDetent(detent === 'peek' ? 'half' : detent === 'half' ? 'full' : 'peek')

  return (
    <Glass
      variant="strong"
      as="section"
      aria-label={label}
      className={cx(
        'pointer-events-auto absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-[28px] pb-[env(safe-area-inset-bottom)]',
        drag === null && 'transition-[height] duration-500 ease-[var(--ease-spring)]',
      )}
      style={{ height }}
    >
      <div
        className="shrink-0 cursor-grab touch-none select-none active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <button
          type="button"
          aria-label={`Resize panel (currently ${detent})`}
          onClick={cycle}
          className="mx-auto mt-2 mb-1 block h-5 w-16"
        >
          <span className="mx-auto block h-[5px] w-10 rounded-full bg-[var(--label-3)]" />
        </button>
        {header}
      </div>
      <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
    </Glass>
  )
}
