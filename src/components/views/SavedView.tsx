import { BookmarkSimple as Bookmark, X } from '@phosphor-icons/react'
import { shortAddress } from '../../js/api.js'
import { distanceMeters, formatDistance } from '../../js/geo.js'
import { getOpenStatus } from '../../js/hours.js'
import type { Beacon } from '../../state/useBeacon'
import { useNow } from '../../ui/hooks'
import { CategoryDot, EmptyState, OpenBadge, ViewHeader } from '../common'

export default function SavedView({ b }: { b: Beacon }) {
  const now = useNow()
  const from = b.user
  return (
    <div className="pb-8">
      <ViewHeader title="Saved places" subtitle="Stored on this device — works offline" onBack={b.back} />
      {b.saved.length === 0 ? (
        <EmptyState
          icon={<Bookmark className="size-6" />}
          title="Nothing saved yet"
          body="Tap Save on a place (your hostel, the nearest 24/7 pharmacy…) to find it again instantly."
        />
      ) : (
        <ul className="space-y-0.5 px-2">
          {b.saved.map((p) => (
            <li key={p.id} className="flex items-center gap-1">
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-[var(--fill-2)]"
                onClick={() => {
                  b.remember(from ? { ...p, distance: distanceMeters(from, p) } : p)
                  b.selectPlace(p.id)
                }}
              >
                <CategoryDot place={p} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{p.name}</span>
                  <span className="label-2 block truncate text-[12.5px]">
                    {p.kind}
                    {shortAddress(p.address) ? ` · ${shortAddress(p.address)}` : ''}
                  </span>
                  <span className="mt-1 block">
                    <OpenBadge status={getOpenStatus(p.tags.opening_hours, now)} />
                  </span>
                </span>
                {from && (
                  <span className="shrink-0 text-[13px] font-semibold tabular-nums">
                    {formatDistance(distanceMeters(from, p), b.settings.units)}
                  </span>
                )}
              </button>
              <button
                type="button"
                aria-label={`Remove ${p.name} from saved`}
                className="label-2 grid size-9 shrink-0 place-items-center rounded-full hover:bg-[var(--fill)]"
                onClick={() => b.toggleSaved(p)}
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
