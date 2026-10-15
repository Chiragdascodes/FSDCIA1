import { useEffect, useId, useRef, useState } from 'react'
import { CheckCircle as CircleCheck, Copy, Crosshair, ArrowSquareOut as ExternalLink, MapPin } from '@phosphor-icons/react'
import { copyText } from '../../js/events.js'
import { addReport } from '../../js/storage.js'
import { LIMITS, REPORT_TYPES, validateReport } from '../../js/validation.js'
import type { Beacon } from '../../state/useBeacon'
import { cx, PrimaryButton } from '../../ui/Glass'
import { PillButton, ViewHeader } from '../common'

type Values = {
  type: string
  placeName: string
  details: string
  contact: string
  lat: number | null
  lon: number | null
  consent: boolean
}
type Errors = Partial<Record<keyof Values | 'location', string>>

const inputCls =
  'w-full rounded-xl border border-[var(--separator)] bg-[var(--app-bg)]/70 px-3 py-2.5 text-[15px] outline-none transition focus:border-accent-500 focus:ring-2 focus:ring-accent-500/25 aria-[invalid=true]:border-red-500 aria-[invalid=true]:ring-red-500/20'

/**
 * "Report a problem" — a validated form (required fields, length limits, email/phone pattern,
 * map location, consent). Validation runs on blur per field and on submit for all fields; errors
 * are announced and linked to inputs with aria-describedby. Reports are stored locally and can be
 * sent to OpenStreetMap as a public Note by the user (never silently).
 */
export default function ReportView({ b, id }: { b: Beacon; id: string | null }) {
  const place = id ? b.placesById.get(id) : undefined
  const formId = useId()
  const errorSummaryRef = useRef<HTMLDivElement>(null)
  const [values, setValues] = useState<Values>(() => ({
    type: place ? (place.tags.opening_hours ? 'wrong-hours' : 'wrong-details') : 'missing',
    placeName: place?.name ?? '',
    details: '',
    contact: '',
    lat: place?.lat ?? b.anchor?.lat ?? null,
    lon: place?.lon ?? b.anchor?.lon ?? null,
    consent: false,
  }))
  const [errors, setErrors] = useState<Errors>({})
  const [touched, setTouched] = useState<Partial<Record<keyof Values, boolean>>>({})
  const [submitted, setSubmitted] = useState<null | { text: string; lat: number; lon: number }>(null)

  // Show a draggable pin on the map while the form is open; clicks on the map move it.
  useEffect(() => {
    if (values.lat !== null && values.lon !== null) b.setPickLocation({ lat: values.lat, lon: values.lon })
    return () => b.setPickLocation(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (b.pickLocation && (b.pickLocation.lat !== values.lat || b.pickLocation.lon !== values.lon)) {
      setValues((v) => ({ ...v, lat: b.pickLocation!.lat, lon: b.pickLocation!.lon }))
      setErrors((e) => ({ ...e, location: undefined }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [b.pickLocation])

  const set = <K extends keyof Values>(k: K, v: Values[K]) => {
    const next = { ...values, [k]: v }
    setValues(next)
    if (touched[k]) setErrors((e) => ({ ...e, [k]: validateReport(next).errors[k] }))
  }
  const blur = (k: keyof Values) => {
    setTouched((t) => ({ ...t, [k]: true }))
    setErrors((e) => ({ ...e, [k]: validateReport(values).errors[k] }))
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const result = validateReport(values)
    setErrors(result.errors)
    setTouched({ type: true, placeName: true, details: true, contact: true, consent: true })
    if (!result.valid) {
      requestAnimationFrame(() => errorSummaryRef.current?.focus())
      return
    }
    addReport({ ...values, placeId: place?.id ?? null })
    b.refreshReports()
    const typeLabel = REPORT_TYPES.find((t) => t.value === values.type)?.label ?? values.type
    const text = `[Beacon report] ${typeLabel}: ${values.placeName.trim()}\n\n${values.details.trim()}${
      place ? `\n\nOSM object: https://www.openstreetmap.org/${place.id}` : ''
    }`
    setSubmitted({ text, lat: values.lat!, lon: values.lon! })
    b.setPickLocation(null)
    b.toast('Report saved. Thank you for improving the map!', 'success')
  }

  if (submitted) {
    const noteUrl = `https://www.openstreetmap.org/note/new#map=19/${submitted.lat.toFixed(6)}/${submitted.lon.toFixed(6)}`
    return (
      <div className="pb-8">
        <ViewHeader title="Report saved" onClose={b.back} />
        <div className="space-y-4 px-4">
          <div role="status" className="flex flex-col items-center rounded-2xl bg-accent-50 p-5 text-center">
            <CircleCheck size={44} weight="fill" className="mb-2 text-emerald-500" />
            <p className="text-[16px] font-semibold">Thanks — your report is saved on this device.</p>
            <p className="label-2 mt-1 text-[13.5px]">
              To get it fixed on the real map, post it as an OpenStreetMap Note. Local mappers will see it.
            </p>
          </div>
          <ol className="label-2 list-decimal space-y-1 pl-5 text-[13.5px]">
            <li>Copy your report text.</li>
            <li>Open OpenStreetMap at the same spot and paste it into the note.</li>
          </ol>
          <div className="flex flex-wrap gap-2">
            <PillButton
              onClick={async () => {
                const ok = await copyText(submitted.text)
                b.toast(ok ? 'Report text copied.' : 'Couldn’t copy.', ok ? 'success' : 'error')
              }}
            >
              <Copy className="size-4" /> Copy text
            </PillButton>
            <a
              className="glass-btn inline-flex items-center gap-1.5 rounded-full bg-accent-600 px-3.5 py-2 text-[14px] font-semibold text-white"
              href={noteUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="size-4" /> Open OSM note
            </a>
          </div>
          <PillButton onClick={b.back} className="w-full">
            Done
          </PillButton>
        </div>
      </div>
    )
  }

  const errorList = Object.entries(errors).filter(([, v]) => v) as [string, string][]
  const fid = (k: string) => `${formId}-${k}`
  const err = (k: keyof Errors) =>
    errors[k] ? (
      <p id={fid(`${k}-err`)} className="mt-1 text-[12.5px] font-medium text-red-600 dark:text-red-400">
        {errors[k]}
      </p>
    ) : null

  return (
    <div className="pb-8">
      <ViewHeader
        title="Report a problem"
        subtitle={place ? `About ${place.name}` : 'Help fix OpenStreetMap for everyone'}
        onBack={b.back}
      />
      <form noValidate onSubmit={onSubmit} className="space-y-4 px-4" aria-describedby={`${formId}-intro`}>
        <p id={`${formId}-intro`} className="label-2 text-[13px]">
          Fields marked * are required. Nothing is sent anywhere until you choose to.
        </p>

        {errorList.length > 0 && (
          <div
            ref={errorSummaryRef}
            tabIndex={-1}
            role="alert"
            className="rounded-xl bg-red-500/10 p-3 text-[13px] text-red-700 outline-none dark:text-red-300"
          >
            <p className="font-semibold">Please fix {errorList.length === 1 ? '1 thing' : `${errorList.length} things`}:</p>
            <ul className="mt-1 list-disc pl-5">
              {errorList.map(([k, v]) => (
                <li key={k}>
                  <a href={`#${fid(k)}`} className="underline">
                    {v}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <label htmlFor={fid('type')} className="mb-1 block text-[13.5px] font-semibold">
            What’s wrong? *
          </label>
          <select
            id={fid('type')}
            className={inputCls}
            value={values.type}
            onChange={(e) => set('type', e.target.value)}
            onBlur={() => blur('type')}
            aria-invalid={!!errors.type}
            aria-describedby={errors.type ? fid('type-err') : undefined}
            required
          >
            {REPORT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          {err('type')}
        </div>

        <div>
          <label htmlFor={fid('placeName')} className="mb-1 block text-[13.5px] font-semibold">
            Place name *
          </label>
          <input
            id={fid('placeName')}
            className={inputCls}
            value={values.placeName}
            onChange={(e) => set('placeName', e.target.value)}
            onBlur={() => blur('placeName')}
            maxLength={LIMITS.placeNameMax + 10}
            autoComplete="off"
            required
            aria-invalid={!!errors.placeName}
            aria-describedby={errors.placeName ? fid('placeName-err') : undefined}
            placeholder="e.g. Apollo Pharmacy"
          />
          {err('placeName')}
        </div>

        <div>
          <label htmlFor={fid('details')} className="mb-1 flex justify-between text-[13.5px] font-semibold">
            <span>Details *</span>
            <span
              className={cx(
                'font-normal tabular-nums',
                values.details.trim().length > LIMITS.detailsMax ? 'text-red-600' : 'label-3',
              )}
              aria-live="polite"
            >
              {values.details.trim().length}/{LIMITS.detailsMax}
            </span>
          </label>
          <textarea
            id={fid('details')}
            className={cx(inputCls, 'min-h-[96px] resize-y')}
            value={values.details}
            onChange={(e) => set('details', e.target.value)}
            onBlur={() => blur('details')}
            required
            aria-invalid={!!errors.details}
            aria-describedby={errors.details ? fid('details-err') : `${fid('details')}-hint`}
            placeholder="e.g. The board says open 8 am – 11 pm every day, including Sundays."
          />
          {err('details') ?? (
            <p id={`${fid('details')}-hint`} className="label-3 mt-1 text-[12px]">
              At least {LIMITS.detailsMin} characters. Say what you saw and when.
            </p>
          )}
        </div>

        <div id={fid('location')}>
          <p className="mb-1 text-[13.5px] font-semibold">Location *</p>
          <div
            className={cx(
              'flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[13.5px]',
              errors.location ? 'border-red-500' : 'border-[var(--separator)]',
            )}
          >
            <MapPin size={18} weight="fill" className="shrink-0 text-pin-500" />
            <span className="min-w-0 flex-1 tabular-nums">
              {values.lat !== null && values.lon !== null
                ? `${values.lat.toFixed(5)}, ${values.lon.toFixed(5)}`
                : 'Not set'}
            </span>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-[13px] font-semibold text-accent-600"
              onClick={() => {
                const c = b.mapCenter()
                b.setPickLocation(c)
              }}
            >
              <Crosshair className="size-3.5" /> Use map centre
            </button>
          </div>
          {errors.location ? (
            err('location')
          ) : (
            <p className="label-3 mt-1 text-[12px]">Drag the red pin, or tap the map, to adjust.</p>
          )}
        </div>

        <div>
          <label htmlFor={fid('contact')} className="mb-1 block text-[13.5px] font-semibold">
            Email or phone <span className="label-3 font-normal">(optional)</span>
          </label>
          <input
            id={fid('contact')}
            className={inputCls}
            type="text"
            inputMode="email"
            autoComplete="email"
            value={values.contact}
            onChange={(e) => set('contact', e.target.value)}
            onBlur={() => blur('contact')}
            aria-invalid={!!errors.contact}
            aria-describedby={errors.contact ? fid('contact-err') : undefined}
            placeholder="you@example.com"
          />
          {err('contact')}
        </div>

        <div>
          <label className="flex items-start gap-2.5 text-[13.5px]">
            <input
              id={fid('consent')}
              type="checkbox"
              className="mt-0.5 size-4 shrink-0 accent-[var(--color-accent-600)]"
              checked={values.consent}
              onChange={(e) => set('consent', e.target.checked)}
              onBlur={() => blur('consent')}
              aria-invalid={!!errors.consent}
              aria-describedby={errors.consent ? fid('consent-err') : undefined}
            />
            <span>
              I understand OpenStreetMap Notes are public. My contact details stay on this device. *
            </span>
          </label>
          {err('consent')}
        </div>

        <PrimaryButton type="submit" className="w-full">
          Save report
        </PrimaryButton>
      </form>
    </div>
  )
}
