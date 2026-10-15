import { useId, useState } from 'react'
import { CITIES } from '../../js/storage.js'
import { LIMITS, validateSettings } from '../../js/validation.js'
import { formatDistance } from '../../js/geo.js'
import type { Beacon } from '../../state/useBeacon'
import type { Settings } from '../../types'
import { cx, PrimaryButton } from '../../ui/Glass'
import { PillButton, ViewHeader } from '../common'

function Segmented<T extends string>({
  name,
  value,
  options,
  onChange,
}: {
  name: string
  value: T
  options: { value: T; label: string }[]
  onChange(v: T): void
}) {
  return (
    <div role="radiogroup" aria-label={name} className="grid auto-cols-fr grid-flow-col gap-1 rounded-full bg-[var(--fill)] p-1">
      {options.map((o) => (
        <label key={o.value} className="cursor-pointer">
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
            className="peer sr-only"
          />
          <span
            className={cx(
              'block rounded-full py-1.5 text-center text-[13px] font-semibold transition',
              'peer-checked:bg-[var(--app-bg)] peer-checked:shadow-sm peer-focus-visible:outline-2 peer-focus-visible:outline-accent-500',
              value !== o.value && 'label-2',
            )}
          >
            {o.label}
          </span>
        </label>
      ))}
    </div>
  )
}

/** Settings form — validated before saving (radius range, allowed values). */
export default function SettingsView({ b }: { b: Beacon }) {
  const id = useId()
  const [draft, setDraft] = useState<Settings>(b.settings)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const dirty = JSON.stringify(draft) !== JSON.stringify(b.settings)
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setDraft((d) => ({ ...d, [k]: v }))

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const result = validateSettings(draft, CITIES.map((c) => c.id))
    setErrors(result.errors)
    if (!result.valid) return
    b.setSettings(draft)
    b.toast('Settings saved.', 'success')
  }

  return (
    <div className="pb-8">
      <ViewHeader title="Settings" onBack={b.back} />
      <form noValidate onSubmit={onSubmit} className="space-y-5 px-4">
        <div>
          <label htmlFor={`${id}-radius`} className="mb-1 flex justify-between text-[13.5px] font-semibold">
            Default search radius <span className="tabular-nums">{formatDistance(draft.radius, draft.units)}</span>
          </label>
          <input
            id={`${id}-radius`}
            type="range"
            min={LIMITS.radiusMin}
            max={LIMITS.radiusMax}
            step={100}
            value={draft.radius}
            onChange={(e) => set('radius', Number(e.target.value))}
            className="w-full accent-[var(--color-accent-600)]"
            aria-invalid={!!errors.radius}
            aria-describedby={errors.radius ? `${id}-radius-err` : undefined}
          />
          {errors.radius && (
            <p id={`${id}-radius-err`} className="text-[12.5px] text-red-600">
              {errors.radius}
            </p>
          )}
        </div>

        <div>
          <p className="mb-1.5 text-[13.5px] font-semibold">Distance units</p>
          <Segmented
            name="Distance units"
            value={draft.units}
            onChange={(v) => set('units', v)}
            options={[
              { value: 'metric', label: 'Kilometres' },
              { value: 'imperial', label: 'Miles' },
            ]}
          />
        </div>

        <div>
          <p className="mb-1.5 text-[13.5px] font-semibold">Default travel mode</p>
          <Segmented
            name="Default travel mode"
            value={draft.mode}
            onChange={(v) => set('mode', v)}
            options={[
              { value: 'foot', label: 'Walk' },
              { value: 'bike', label: 'Cycle' },
              { value: 'car', label: 'Drive' },
            ]}
          />
        </div>

        <div>
          <p className="mb-1.5 text-[13.5px] font-semibold">Appearance</p>
          <Segmented
            name="Appearance"
            value={draft.theme}
            onChange={(v) => set('theme', v)}
            options={[
              { value: 'auto', label: 'Auto' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </div>

        <div>
          <label htmlFor={`${id}-city`} className="mb-1 block text-[13.5px] font-semibold">
            City when location is off
          </label>
          <select
            id={`${id}-city`}
            value={draft.fallbackCity}
            onChange={(e) => set('fallbackCity', e.target.value)}
            className="w-full rounded-xl border border-[var(--separator)] bg-[var(--app-bg)]/70 px-3 py-2.5 text-[15px]"
            aria-invalid={!!errors.fallbackCity}
          >
            {CITIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {errors.fallbackCity && <p className="text-[12.5px] text-red-600">{errors.fallbackCity}</p>}
        </div>

        <PrimaryButton type="submit" className="w-full" disabled={!dirty}>
          {dirty ? 'Save settings' : 'Saved'}
        </PrimaryButton>

        <div className="border-t border-[var(--separator)] pt-4">
          <p className="mb-2 text-[13.5px] font-semibold">Privacy</p>
          <div className="flex flex-wrap gap-2">
            <PillButton
              onClick={() => {
                b.clearRecents()
                b.toast('Search history cleared.', 'success')
              }}
            >
              Clear search history
            </PillButton>
            <PillButton onClick={() => b.push({ name: 'shortcuts' })}>Keyboard shortcuts</PillButton>
          </div>
          <p className="label-3 mt-3 text-[12px]">
            Beacon has no accounts. Your location is used only in your browser to search nearby, and is sent to the
            search services as coordinates (never stored by us).
          </p>
        </div>
      </form>
    </div>
  )
}
