import { Accessibility, Clock, LoaderCircle, MapPinned, RotateCw, SearchX, SlidersHorizontal, Timer, WifiOff } from 'lucide-react'
import { describeQuery } from '../../js/queryParser.js'
import { formatDistance } from '../../js/geo.js'
import type { Beacon, Filters } from '../../state/useBeacon'
import { cx } from '../../ui/Glass'
import { useNow } from '../../ui/hooks'
import { EmptyState, PillButton, PlaceRow, SkeletonRows, ViewHeader } from '../common'

const RADII = [500, 1000, 1500, 3000, 5000, 10000]

function FilterChip({
  on,
  onToggle,
  icon,
  children,
}: {
  on: boolean
  onToggle(): void
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onToggle}
      className={cx(
        'glass-btn inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium',
        on ? 'bg-[var(--label)] text-[var(--app-bg)]' : 'bg-[var(--fill)] hover:bg-[var(--fill-2)]',
      )}
    >
      {icon}
      {children}
    </button>
  )
}

export default function ResultsView({ b }: { b: Beacon }) {
  const now = useNow()
  const units = b.settings.units
  const heading = b.parsed ? describeQuery({ ...b.parsed, filters: { openNow: false, allDay: false, wheelchair: false } }) : 'Results'
  const where =
    b.anchor?.kind === 'place'
      ? `near ${b.anchor.label}`
      : b.anchor?.kind === 'map'
        ? 'in this area'
        : b.anchor?.kind === 'city'
          ? `in ${b.anchor.label} (location off)`
          : b.anchor
            ? 'near you'
            : ''
  const title = b.category ? b.category.plural : b.parsed?.what || heading.split(' near ')[0]
  const setFilter = (k: keyof Filters, v: boolean) => b.setFilters((f) => ({ ...f, [k]: v }))
  const showFilters = !!b.category || b.results.length > 0
  const named = b.results.filter((p) => p.name).length

  return (
    <div className="pb-6">
      <ViewHeader
        title={title}
        subtitle={
          <>
            {where}
            {b.anchorOptions.length > 1 && b.anchor?.kind === 'place' && (
              <>
                {' · '}
                <button type="button" className="font-semibold text-accent-600" onClick={() => b.push({ name: 'disambiguate' })}>
                  Change
                </button>
              </>
            )}
            {b.status === 'done' && named > 0 && ` · ${b.visibleResults.length} of ${named}`}
          </>
        }
        onClose={b.goHome}
      />

      {showFilters && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3" role="toolbar" aria-label="Filters">
          <FilterChip on={b.filters.openNow} onToggle={() => setFilter('openNow', !b.filters.openNow)} icon={<Clock className="size-3.5" />}>
            Open now
          </FilterChip>
          <FilterChip on={b.filters.allDay} onToggle={() => setFilter('allDay', !b.filters.allDay)} icon={<Timer className="size-3.5" />}>
            24/7
          </FilterChip>
          <FilterChip
            on={b.filters.wheelchair}
            onToggle={() => setFilter('wheelchair', !b.filters.wheelchair)}
            icon={<Accessibility className="size-3.5" />}
          >
            Wheelchair
          </FilterChip>
          <label className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-[var(--fill)] pr-1 pl-3 text-[13px] font-medium">
            <SlidersHorizontal className="size-3.5" />
            <span className="sr-only">Search radius</span>
            <select
              value={b.radius}
              onChange={(e) => {
                const r = Number(e.target.value)
                b.updateSetting('radius', r)
                if (b.category && b.anchor) void b.expandRadiusTo(r)
              }}
              className="h-full cursor-pointer appearance-none bg-transparent pr-2 outline-none"
            >
              {RADII.map((r) => (
                <option key={r} value={r}>
                  {formatDistance(r, units)}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {/* Progressive enrichment status (fast results first, details later). */}
      {b.status === 'done' && b.enrich === 'loading' && b.results.length > 0 && (
        <p role="status" className="label-2 mx-4 mb-2 flex items-center gap-2 rounded-xl bg-[var(--fill-2)] px-3 py-2 text-[12.5px]">
          <LoaderCircle className="size-3.5 animate-spin" /> Checking OpenStreetMap for more places…
        </p>
      )}
      {b.enrich === 'failed' && b.results.length > 0 && (
        <p role="status" className="mx-4 mb-2 flex items-center gap-2 rounded-xl bg-amber-500/12 px-3 py-2 text-[12.5px] text-amber-800 dark:text-amber-200">
          Some extra places may be missing — OpenStreetMap’s Overpass server is busy.
          <button type="button" className="ml-auto font-semibold underline" onClick={b.retry}>
            Retry
          </button>
        </p>
      )}

      {b.status === 'locating' && (
        <>
          <p role="status" className="label-2 flex items-center gap-2 px-5 pb-2 text-[13px]">
            <LoaderCircle className="size-4 animate-spin" /> Finding your location…
          </p>
          <SkeletonRows count={4} />
        </>
      )}

      {b.status === 'loading' && (
        <>
          <p role="status" className="label-2 flex items-center gap-2 px-5 pb-2 text-[13px]">
            <LoaderCircle className="size-4 animate-spin" />
            {b.category ? `Searching ${b.category.plural.toLowerCase()} within ${formatDistance(b.radius, units)}…` : 'Searching…'}
          </p>
          <SkeletonRows />
        </>
      )}

      {b.status === 'error' && (
        <EmptyState
          tone="error"
          icon={b.online ? undefined : <WifiOff className="size-6" />}
          title={b.online ? 'Search didn’t work' : 'You’re offline'}
          body={b.error}
          actions={
            <>
              <PillButton onClick={b.retry}>
                <RotateCw className="size-4" /> Try again
              </PillButton>
              <PillButton onClick={b.goHome}>Back</PillButton>
            </>
          }
        />
      )}

      {b.status === 'done' && b.enrich !== 'loading' && named === 0 && (
        <EmptyState
          icon={<SearchX className="size-6" />}
          title={`No ${(b.category?.plural ?? 'matches').toLowerCase()} within ${formatDistance(b.radius, units)}`}
          body="OpenStreetMap may not have them mapped here yet. Try a wider area, or report a missing place."
          actions={
            <>
              {b.radius < 10000 && (
                <PillButton onClick={b.expandRadius} className="!bg-accent-600 !text-white">
                  Search {formatDistance(Math.min(b.radius * 2, 10000), units)}
                </PillButton>
              )}
              <PillButton onClick={() => b.push({ name: 'report', id: null })}>Report missing place</PillButton>
            </>
          }
        />
      )}

      {b.status === 'done' && named > 0 && b.visibleResults.length === 0 && (
        <EmptyState
          icon={<Clock className="size-6" />}
          title="Nothing matches these filters"
          body={
            b.filters.openNow
              ? `Only a few places on OpenStreetMap list opening hours. ${b.hiddenCount} place${b.hiddenCount === 1 ? ' is' : 's are'} hidden.`
              : `${b.hiddenCount} place${b.hiddenCount === 1 ? ' is' : 's are'} hidden by filters.`
          }
          actions={
            <>
              {b.filters.openNow && !b.filters.includeUnknown && (
                <PillButton onClick={() => setFilter('includeUnknown', true)}>Include unknown hours</PillButton>
              )}
              <PillButton
                onClick={() => b.setFilters({ openNow: false, allDay: false, wheelchair: false, includeUnknown: true })}
                className="!bg-accent-600 !text-white"
              >
                Clear filters
              </PillButton>
            </>
          }
        />
      )}

      {b.status === 'done' && b.visibleResults.length > 0 && (
        <>
          <ul className="space-y-0.5 px-2" aria-label="Results, nearest first">
            {b.visibleResults.map(({ place }, i) => (
              <PlaceRow
                key={place.id}
                place={place}
                rank={b.category ? i : undefined}
                units={units}
                now={now}
                selected={b.selectedId === place.id}
                onSelect={() => b.selectPlace(place.id)}
              />
            ))}
          </ul>
          {b.hiddenCount > 0 && (
            <p className="label-2 px-5 pt-3 text-[12.5px]">
              {b.hiddenCount} hidden by filters ·{' '}
              <button
                type="button"
                className="font-semibold text-accent-600"
                onClick={() => b.setFilters({ openNow: false, allDay: false, wheelchair: false, includeUnknown: true })}
              >
                Show all
              </button>
            </p>
          )}
          {b.filters.openNow && b.filters.includeUnknown && (
            <p className="label-3 px-5 pt-2 text-[12px]">
              Places with unknown hours are included — OpenStreetMap has hours for only a few places.{' '}
              <button type="button" className="font-semibold text-accent-600" onClick={() => setFilter('includeUnknown', false)}>
                Only confirmed open
              </button>
            </p>
          )}
          <p className="label-3 flex items-center gap-1.5 px-5 pt-4 text-[11.5px]">
            <MapPinned className="size-3.5" /> Data © OpenStreetMap contributors (ODbL). Distances are straight-line.
          </p>
        </>
      )}
    </div>
  )
}
