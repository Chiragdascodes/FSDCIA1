import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight, CircleAlert, X } from 'lucide-react'
import { getCategory } from '../js/categories.js'
import { estimateSeconds, formatDistance, formatDuration } from '../js/geo.js'
import { getOpenStatus } from '../js/hours.js'
import { shortAddress } from '../js/api.js'
import type { OpenStatus, Place } from '../types'
import { cx, PillButton } from '../ui/Glass'
import { iconFor } from '../ui/icons'

export function ViewHeader({
  title,
  subtitle,
  onBack,
  onClose,
  right,
}: {
  title: ReactNode
  subtitle?: ReactNode
  onBack?: () => void
  onClose?: () => void
  right?: ReactNode
}) {
  return (
    <header className="flex items-start gap-2 px-4 pt-2 pb-3">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="glass-btn -ml-1 grid size-9 shrink-0 place-items-center rounded-full bg-[var(--fill)] hover:bg-[var(--fill-2)]"
        >
          <ChevronLeft className="size-5" />
        </button>
      )}
      <div className="min-w-0 flex-1 pt-0.5">
        <h2 className="text-[20px] leading-tight font-bold tracking-tight">{title}</h2>
        {subtitle && <p className="label-2 mt-0.5 text-[13.5px]">{subtitle}</p>}
      </div>
      {right}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="glass-btn grid size-9 shrink-0 place-items-center rounded-full bg-[var(--fill)] hover:bg-[var(--fill-2)]"
        >
          <X className="size-[18px]" />
        </button>
      )}
    </header>
  )
}

const BADGE: Record<string, string> = {
  open: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  soon: 'bg-amber-500/18 text-amber-700 dark:text-amber-300',
  closed: 'bg-red-500/12 text-red-700 dark:text-red-300',
  unknown: 'bg-[var(--fill)] text-[var(--label-2)]',
}

export function OpenBadge({ status, className }: { status: OpenStatus; className?: string }) {
  const key = status.state === 'open' ? (status.closingSoon ? 'soon' : 'open') : status.state
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold', BADGE[key], className)}>
      <span
        className={cx(
          'size-1.5 rounded-full',
          key === 'open' && 'bg-emerald-500',
          key === 'soon' && 'bg-amber-500',
          key === 'closed' && 'bg-red-500',
          key === 'unknown' && 'bg-[var(--label-3)]',
        )}
      />
      {status.label}
    </span>
  )
}

export function CategoryDot({ place, size = 'md' }: { place: Place; size?: 'md' | 'lg' }) {
  const cat = place.categoryId ? getCategory(place.categoryId) : undefined
  const Icon = iconFor(cat?.icon)
  return (
    <span
      className={cx('grid shrink-0 place-items-center rounded-full text-white', size === 'lg' ? 'size-12' : 'size-10')}
      style={{ background: cat?.color ?? '#64748b' }}
      aria-hidden
    >
      <Icon className={size === 'lg' ? 'size-6' : 'size-5'} strokeWidth={2.2} />
    </span>
  )
}

export function PlaceRow({
  place,
  units,
  onSelect,
  selected,
  rank,
  now,
}: {
  place: Place
  units: 'metric' | 'imperial'
  onSelect(): void
  selected?: boolean
  rank?: number
  now: Date
}) {
  const status = getOpenStatus(place.tags.opening_hours, now)
  const walk = place.distance !== undefined ? formatDuration(estimateSeconds(place.distance, 'foot')) : ''
  const address = shortAddress(place.address)
  const wheelchair = place.tags.wheelchair === 'yes'
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? 'true' : undefined}
        className={cx(
          'group flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors',
          selected ? 'bg-accent-500/12' : 'hover:bg-[var(--fill-2)]',
        )}
      >
        <CategoryDot place={place} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="truncate text-[15.5px] font-semibold">{place.name}</span>
            {rank === 0 && (
              <span className="shrink-0 rounded-full bg-accent-600 px-1.5 py-px text-[10.5px] font-bold text-white uppercase">
                Nearest
              </span>
            )}
          </span>
          <span className="label-2 block truncate text-[13px]">
            {place.kind}
            {address ? ` · ${address}` : ''}
          </span>
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <OpenBadge status={status} />
            {wheelchair && <span className="label-2 rounded-full bg-[var(--fill)] px-2 py-0.5 text-[12px]">♿ Accessible</span>}
          </span>
        </span>
        {place.distance !== undefined && (
          <span className="shrink-0 text-right">
            <span className="block text-[14px] font-semibold tabular-nums">{formatDistance(place.distance, units)}</span>
            <span className="label-3 block text-[12px] tabular-nums">{walk} walk</span>
          </span>
        )}
        <ChevronRight className="label-3 size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
      </button>
    </li>
  )
}

export function SkeletonRows({ count = 5 }: { count?: number }) {
  return (
    <ul aria-hidden className="space-y-1 px-2">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="flex items-center gap-3 px-3 py-3">
          <span className="skeleton size-10 rounded-full" />
          <span className="flex-1 space-y-2">
            <span className="skeleton block h-3.5 w-2/3 rounded-full" />
            <span className="skeleton block h-3 w-1/2 rounded-full" />
            <span className="skeleton block h-4 w-24 rounded-full" />
          </span>
          <span className="skeleton h-4 w-10 rounded-full" />
        </li>
      ))}
    </ul>
  )
}

export function EmptyState({
  icon,
  title,
  body,
  actions,
  tone = 'neutral',
}: {
  icon?: ReactNode
  title: string
  body?: ReactNode
  actions?: ReactNode
  tone?: 'neutral' | 'error'
}) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className="flex flex-col items-center px-6 py-10 text-center">
      <span
        className={cx(
          'mb-3 grid size-14 place-items-center rounded-full',
          tone === 'error' ? 'bg-red-500/12 text-red-600 dark:text-red-400' : 'bg-[var(--fill)] text-[var(--label-2)]',
        )}
      >
        {icon ?? <CircleAlert className="size-6" />}
      </span>
      <p className="text-[16px] font-semibold">{title}</p>
      {body && <p className="label-2 mt-1 max-w-[300px] text-[14px]">{body}</p>}
      {actions && <div className="mt-4 flex flex-wrap justify-center gap-2">{actions}</div>}
    </div>
  )
}

export { PillButton }
