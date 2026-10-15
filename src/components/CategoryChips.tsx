import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { DotsThreeOutline, X } from '@phosphor-icons/react'
import { CATEGORIES } from '../js/categories.js'
import { cx, Glass } from '../ui/Glass'
import { iconFor } from '../ui/icons'

interface Props {
  active: string | null
  onPick(id: string): void
  glass?: boolean
}

const GAP = 8
const MORE_W = 88

/**
 * One-tap category search (HIG Maps: "offer a search feature combined with a way to filter by category").
 * No horizontal scrolling: as many chips as fit are shown in one row (measured with a ResizeObserver),
 * the rest live behind a "More" button that opens a grid of every category.
 */
export default function CategoryChips({ active, onPick, glass }: Props) {
  const rowRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState(CATEGORIES.length)
  const [open, setOpen] = useState(false)
  const popRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const row = rowRef.current
    const measure = measureRef.current
    if (!row || !measure) return
    const compute = () => {
      const widths = [...measure.children].map((c) => (c as HTMLElement).offsetWidth)
      const available = row.clientWidth
      const total = widths.reduce((a, w) => a + w + GAP, -GAP)
      if (total <= available) return setFit(CATEGORIES.length)
      let used = MORE_W
      let n = 0
      for (const w of widths) {
        if (used + GAP + w > available) break
        used += GAP + w
        n++
      }
      setFit(Math.max(1, n))
    }
    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(row)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [open])

  const chipCls = (checked: boolean) =>
    cx(
      'glass-btn flex h-10 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-[14.5px] font-medium whitespace-nowrap',
      glass ? 'glass glass-strong' : 'bg-[var(--fill)] hover:bg-accent-50',
      checked && '!bg-accent-600 !text-white',
    )

  const shown = CATEGORIES.slice(0, fit)
  const hidden = CATEGORIES.slice(fit)
  const hiddenActive = hidden.some((c) => c.id === active)

  return (
    <div className="relative">
      {/* Invisible copy used only to measure chip widths. */}
      <div ref={measureRef} aria-hidden className="pointer-events-none invisible absolute flex gap-2">
        {CATEGORIES.map((c) => {
          const Icon = iconFor(c.icon)
          return (
            <span key={c.id} className={chipCls(false)}>
              <Icon size={17} weight="fill" />
              {c.label}
            </span>
          )
        })}
      </div>

      <div ref={rowRef} role="group" aria-label="Quick search by category" className="flex gap-2">
        {shown.map((c) => {
          const Icon = iconFor(c.icon)
          const checked = active === c.id
          return (
            <button key={c.id} type="button" aria-pressed={checked} onClick={() => onPick(c.id)} className={chipCls(checked)}>
              <Icon size={17} weight="fill" style={{ color: checked ? '#fff' : c.color }} />
              {c.label}
            </button>
          )
        })}
        {hidden.length > 0 && (
          <div ref={popRef} className="relative">
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={open}
              onClick={() => setOpen((o) => !o)}
              className={chipCls(hiddenActive)}
              style={{ minWidth: MORE_W - 8 }}
            >
              <DotsThreeOutline size={17} weight="fill" />
              More
            </button>
          </div>
        )}
      </div>

      {open && (
        <Glass
          variant="strong"
          role="dialog"
          aria-label="All categories"
          className="glass-menu absolute inset-x-0 top-12 z-40 rounded-3xl p-4"
        >
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[15px] font-semibold">All categories</p>
            <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="label-2 grid size-8 place-items-center rounded-full hover:bg-[var(--fill)]">
              <X size={16} weight="bold" />
            </button>
          </div>
          <div className="grid grid-cols-5 gap-x-1 gap-y-3">
            {CATEGORIES.map((c) => {
              const Icon = iconFor(c.icon)
              const checked = active === c.id
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={checked}
                  onClick={() => {
                    setOpen(false)
                    onPick(c.id)
                  }}
                  className="glass-btn flex flex-col items-center gap-1.5"
                >
                  <span
                    className={cx('grid size-12 place-items-center rounded-full', checked && 'ring-2 ring-accent-500 ring-offset-2')}
                    style={{ background: `${c.color}1c`, color: c.color }}
                  >
                    <Icon size={24} weight="fill" />
                  </span>
                  <span className="text-center text-[11.5px] leading-tight font-medium">{c.label}</span>
                </button>
              )
            })}
          </div>
        </Glass>
      )}
    </div>
  )
}
