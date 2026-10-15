import { ArrowSquareOut, Bell, Copy } from '@phosphor-icons/react'
import { copyText } from '../../js/events.js'
import { REPORT_TYPES } from '../../js/validation.js'
import type { Beacon } from '../../state/useBeacon'
import { EmptyState, PillButton, ViewHeader } from '../common'

/** "Reports" tab: problems the user reported, kept on this device, each one-tap shareable as an OSM Note. */
export default function ReportsView({ b }: { b: Beacon }) {
  return (
    <div className="pb-8">
      <ViewHeader title="Your reports" subtitle="Saved on this device until you post them to OpenStreetMap" />
      {b.reports.length === 0 ? (
        <EmptyState
          icon={<Bell size={28} weight="duotone" />}
          title="No reports yet"
          body="Spotted wrong hours or a missing pharmacy? Open a place, tap ⋯ and choose Report a problem."
          actions={<PillButton onClick={() => b.push({ name: 'report', id: null })}>Report a missing place</PillButton>}
        />
      ) : (
        <ul className="space-y-2 px-4">
          {b.reports.map((r) => {
            const label = REPORT_TYPES.find((t) => t.value === r.type)?.label ?? r.type
            const text = `[Beacon report] ${label}: ${r.placeName}\n\n${r.details}`
            return (
              <li key={r.id} className="rounded-2xl bg-[var(--fill-2)] p-3.5">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-[15px] font-semibold">{r.placeName}</p>
                  <time className="label-3 shrink-0 text-[12px]" dateTime={new Date(r.createdAt).toISOString()}>
                    {new Date(r.createdAt).toLocaleDateString([], { day: 'numeric', month: 'short' })}
                  </time>
                </div>
                <p className="mt-0.5 text-[13px] font-medium text-accent-700">{label}</p>
                <p className="label-2 mt-1 line-clamp-2 text-[13.5px]">{r.details}</p>
                <div className="mt-3 flex gap-2">
                  <PillButton
                    onClick={async () => {
                      const ok = await copyText(text)
                      b.toast(ok ? 'Report text copied.' : 'Couldn’t copy.', ok ? 'success' : 'error')
                    }}
                  >
                    <Copy size={16} /> Copy
                  </PillButton>
                  {r.lat !== null && r.lon !== null && (
                    <a
                      className="glass-btn inline-flex items-center gap-1.5 rounded-full bg-accent-600 px-3.5 py-2 text-[14px] font-semibold text-white"
                      href={`https://www.openstreetmap.org/note/new#map=19/${r.lat.toFixed(6)}/${r.lon.toFixed(6)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ArrowSquareOut size={16} weight="bold" /> Post as OSM note
                    </a>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
