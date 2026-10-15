import type { Beacon } from '../../state/useBeacon'
import { ViewHeader } from '../common'

export const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ['/'], label: 'Focus search' },
  { keys: ['Esc'], label: 'Close panel / clear search' },
  { keys: ['↑', '↓', 'Enter'], label: 'Move through suggestions' },
  { keys: ['L'], label: 'Show my location' },
  { keys: ['S'], label: 'Map styles' },
  { keys: ['G'], label: 'Toggle 3D globe' },
  { keys: ['+', '−'], label: 'Zoom in / out' },
  { keys: ['1–9'], label: 'Quick category search' },
  { keys: ['?'], label: 'Show this help' },
]

export default function ShortcutsView({ b }: { b: Beacon }) {
  return (
    <div className="pb-8">
      <ViewHeader title="Keyboard shortcuts" onBack={b.back} />
      <dl className="mx-4 divide-y divide-[var(--separator)] rounded-2xl bg-[var(--fill-2)] px-3.5">
        {SHORTCUTS.map((s) => (
          <div key={s.label} className="flex items-center justify-between py-2.5 text-[14px]">
            <dt>{s.label}</dt>
            <dd className="flex gap-1">
              {s.keys.map((k) => (
                <kbd
                  key={k}
                  className="min-w-7 rounded-md border border-[var(--separator)] bg-[var(--app-bg)] px-1.5 py-0.5 text-center font-sans text-[12px] font-semibold shadow-[0_1px_0_var(--separator)]"
                >
                  {k}
                </kbd>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
