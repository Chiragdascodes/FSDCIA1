import { ChevronRight, LocateFixed, MapPin } from 'lucide-react'
import { localityLine } from '../../js/api.js'
import { formatDistance } from '../../js/geo.js'
import type { Beacon } from '../../state/useBeacon'
import { ViewHeader } from '../common'

/**
 * "Which MG Road did you mean?" — fixes benchmark E6 (OSM silently chose MG Roads in other cities).
 * Cards show the sub-address (area · city · state) and distance from the user, nearest first.
 */
export default function DisambiguateView({ b }: { b: Beacon }) {
  const name = b.parsed?.anchor.text ?? 'that place'
  const what = b.parsed?.category?.plural ?? b.parsed?.what ?? 'places'
  return (
    <div className="pb-6">
      <ViewHeader
        title={<>Which “{name}”?</>}
        subtitle={`Several places match. Pick one to find ${what.toLowerCase()} there — nearest to you first.`}
        onClose={b.goHome}
      />
      <ul className="space-y-2 px-3" aria-label={`Places named ${name}`}>
        {b.anchorOptions.map((p, i) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => b.chooseAnchor(p)}
              className="group flex w-full items-center gap-3 rounded-2xl border border-[var(--separator)] bg-[var(--fill-2)] p-3 text-left transition hover:border-accent-500/50 hover:bg-accent-500/8"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-600/12 text-accent-700 dark:text-accent-300">
                <MapPin className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-[15.5px] font-semibold">{p.name}</span>
                  {i === 0 && p.distance !== undefined && (
                    <span className="shrink-0 rounded-full bg-accent-600 px-1.5 py-px text-[10.5px] font-bold text-white uppercase">
                      Closest
                    </span>
                  )}
                </span>
                <span className="label-2 block truncate text-[13px]">{localityLine(p.address) || p.address.country}</span>
                <span className="label-3 block text-[12px]">{p.kind}</span>
              </span>
              {p.distance !== undefined && (
                <span className="shrink-0 text-[13.5px] font-semibold tabular-nums">{formatDistance(p.distance, b.settings.units)}</span>
              )}
              <ChevronRight className="label-3 size-4 shrink-0" />
            </button>
          </li>
        ))}
      </ul>
      {b.parsed?.category && (
        <div className="px-4 pt-4">
          <button
            type="button"
            onClick={() => b.searchCategory(b.parsed!.category!.id)}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--fill)] py-2.5 text-[14px] font-medium hover:bg-[var(--fill-2)]"
          >
            <LocateFixed className="size-4" /> Search {b.parsed.category.plural.toLowerCase()} near me instead
          </button>
        </div>
      )}
    </div>
  )
}
