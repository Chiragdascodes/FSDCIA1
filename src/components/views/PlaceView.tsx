import {
  Accessibility,
  Bookmark,
  BookmarkCheck,
  Clock,
  Copy,
  CreditCard,
  ExternalLink,
  Flag,
  Globe,
  MapPin,
  Navigation,
  Phone,
  Share2,
  Utensils,
} from 'lucide-react'
import { fullAddress, localityLine, shortAddress } from '../../js/api.js'
import { CATEGORIES } from '../../js/categories.js'
import { copyText } from '../../js/events.js'
import { compassDirection, estimateSeconds, formatDistance, formatDuration } from '../../js/geo.js'
import { getOpenStatus, getWeekSchedule } from '../../js/hours.js'
import type { Beacon } from '../../state/useBeacon'
import type { Place } from '../../types'
import { cx, PrimaryButton } from '../../ui/Glass'
import { useNow } from '../../ui/hooks'
import { iconFor } from '../../ui/icons'
import { CategoryDot, EmptyState, OpenBadge, ViewHeader } from '../common'

function ActionButton({
  icon,
  label,
  onClick,
  href,
  disabled,
}: {
  icon: React.ReactNode
  label: string
  onClick?: () => void
  href?: string
  disabled?: boolean
}) {
  const cls = cx(
    'glass-btn flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl bg-[var(--fill)] px-1 py-2.5 text-[12px] font-medium hover:bg-[var(--fill-2)]',
    disabled && 'pointer-events-none opacity-40',
  )
  if (href && !disabled)
    return (
      <a className={cls} href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer">
        {icon}
        <span className="truncate">{label}</span>
      </a>
    )
  return (
    <button type="button" className={cls} onClick={onClick} disabled={disabled} aria-disabled={disabled}>
      {icon}
      <span className="truncate">{label}</span>
    </button>
  )
}

function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 border-b border-[var(--separator)] py-3 last:border-0">
      <span className="label-2 mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1 text-[14.5px]">{children}</div>
    </li>
  )
}

const yesNo = (v: string | undefined) =>
  v === 'yes' ? 'Yes' : v === 'limited' ? 'Partly' : v === 'no' ? 'No' : v === 'designated' ? 'Yes (designated)' : null

function website(p: Place) {
  const w = p.tags.website || p.tags['contact:website'] || p.tags.url
  if (!w) return null
  return /^https?:\/\//.test(w) ? w : `https://${w}`
}
function phone(p: Place) {
  return (p.tags.phone || p.tags['contact:phone'] || p.tags['contact:mobile'] || '').split(';')[0].trim() || null
}

export default function PlaceView({ b, id }: { b: Beacon; id: string }) {
  const now = useNow()
  const place = b.placesById.get(id)
  if (!place) {
    return (
      <>
        <ViewHeader title="Place" onBack={b.back} />
        <EmptyState title="This place isn’t loaded" body="Search again to see it." />
      </>
    )
  }
  const status = getOpenStatus(place.tags.opening_hours, now)
  const week = getWeekSchedule(place.tags.opening_hours, now)
  const saved = b.saved.some((s) => s.id === place.id)
  const tel = phone(place)
  const web = website(place)
  const units = b.settings.units
  const from = b.user ?? b.anchor
  const osmUrl = `https://www.openstreetmap.org/${place.id}`
  const shareUrl = `${location.origin}${location.pathname}#place=${place.id}`
  const payments = Object.entries(place.tags)
    .filter(([k, v]) => k.startsWith('payment:') && v === 'yes')
    .map(([k]) => k.slice(8).replace(/_/g, ' '))
  const wheelchair = yesNo(place.tags.wheelchair)

  const share = async () => {
    const text = `${place.name} — ${shortAddress(place.address) || localityLine(place.address)}`
    if (navigator.share) {
      try {
        await navigator.share({ title: place.name, text, url: shareUrl })
        return
      } catch {
        /* cancelled → fall through to copy */
      }
    }
    const ok = await copyText(shareUrl)
    b.toast(ok ? 'Link copied — anyone can open this place in Beacon.' : 'Couldn’t copy the link.', ok ? 'success' : 'error')
  }

  return (
    <div className="pb-8">
      <ViewHeader
        title={place.name}
        subtitle={
          <>
            {place.kind}
            {place.distance !== undefined && from && (
              <>
                {' · '}
                {formatDistance(place.distance, units)} {compassDirection(from, place)}
                {' · '}
                {formatDuration(estimateSeconds(place.distance, 'foot'))} walk
              </>
            )}
          </>
        }
        onBack={b.views.length > 2 ? b.back : undefined}
        onClose={b.goHome}
      />

      <div className="px-4">
        <div className="mb-4 flex items-center gap-3">
          <CategoryDot place={place} size="lg" />
          <OpenBadge status={status} className="!text-[13px]" />
        </div>

        <div className="mb-3">
          <PrimaryButton className="w-full" onClick={() => b.directions(place.id)}>
            <Navigation className="size-[18px]" /> Directions
          </PrimaryButton>
        </div>
        <div className="mb-5 flex gap-2">
          <ActionButton icon={<Phone className="size-5" />} label="Call" href={tel ? `tel:${tel.replace(/\s/g, '')}` : undefined} disabled={!tel} />
          <ActionButton icon={<Globe className="size-5" />} label="Website" href={web ?? undefined} disabled={!web} />
          <ActionButton
            icon={saved ? <BookmarkCheck className="size-5 text-accent-600" /> : <Bookmark className="size-5" />}
            label={saved ? 'Saved' : 'Save'}
            onClick={() => b.toggleSaved(place)}
          />
          <ActionButton icon={<Share2 className="size-5" />} label="Share" onClick={share} />
        </div>

        {/* Hours */}
        <section aria-labelledby="hours-title" className="mb-4 rounded-2xl bg-[var(--fill-2)] p-3.5">
          <h3 id="hours-title" className="mb-2 flex items-center gap-2 text-[14px] font-semibold">
            <Clock className="size-4" /> Opening hours
          </h3>
          {week ? (
            <table className="w-full text-[14px]">
              <caption className="sr-only">Opening hours for the next 7 days</caption>
              <tbody>
                {week.map((d) => (
                  <tr key={d.date.toISOString()} className={cx(d.isToday && 'font-semibold')}>
                    <th scope="row" className="w-16 py-1 text-left font-[inherit]">
                      {d.isToday ? 'Today' : d.day}
                    </th>
                    <td className={cx('py-1 text-right tabular-nums', !d.ranges.length && 'text-red-600 dark:text-red-400')}>
                      {d.ranges.length ? d.ranges.join(', ') : 'Closed'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="label-2 text-[13.5px]">
              OpenStreetMap doesn’t list hours for this place yet{place.tags.opening_hours ? ` (“${place.tags.opening_hours}”)` : ''}.{' '}
              <button type="button" className="font-semibold text-accent-600" onClick={() => b.push({ name: 'report', id: place.id })}>
                Add them
              </button>
            </p>
          )}
          {status.comment && <p className="label-2 mt-2 text-[13px]">Note: {status.comment}</p>}
        </section>

        {/* Details */}
        <ul className="mb-4 rounded-2xl bg-[var(--fill-2)] px-3.5">
          <Row icon={<MapPin className="size-4" />}>
            <p>{fullAddress(place.address) || `${place.lat.toFixed(5)}, ${place.lon.toFixed(5)}`}</p>
            <button
              type="button"
              className="mt-1 inline-flex items-center gap-1 text-[13px] font-semibold text-accent-600"
              onClick={async () => {
                const ok = await copyText(fullAddress(place.address) || `${place.lat}, ${place.lon}`)
                b.toast(ok ? 'Address copied.' : 'Couldn’t copy.', ok ? 'success' : 'error')
              }}
            >
              <Copy className="size-3.5" /> Copy address
            </button>
          </Row>
          {tel && (
            <Row icon={<Phone className="size-4" />}>
              <a className="text-accent-600" href={`tel:${tel.replace(/\s/g, '')}`}>
                {tel}
              </a>
            </Row>
          )}
          {web && (
            <Row icon={<Globe className="size-4" />}>
              <a className="break-all text-accent-600" href={web} target="_blank" rel="noopener noreferrer">
                {web.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
              </a>
            </Row>
          )}
          {wheelchair && (
            <Row icon={<Accessibility className="size-4" />}>Wheelchair accessible: {wheelchair}</Row>
          )}
          {place.tags.cuisine && (
            <Row icon={<Utensils className="size-4" />}>Cuisine: {place.tags.cuisine.replace(/_/g, ' ').replace(/;/g, ', ')}</Row>
          )}
          {payments.length > 0 && <Row icon={<CreditCard className="size-4" />}>Pays with: {payments.join(', ')}</Row>}
          {place.tags.check_date && (
            <Row icon={<Clock className="size-4" />}>Last verified on OSM: {place.tags.check_date}</Row>
          )}
        </ul>

        {/* Nearby essentials from here */}
        <section aria-labelledby="nearby-title" className="mb-4">
          <h3 id="nearby-title" className="label-3 mb-2 text-[12px] font-semibold tracking-wide uppercase">
            Also near here
          </h3>
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
            {CATEGORIES.filter((c) => c.id !== place.categoryId)
              .slice(0, 6)
              .map((c) => {
                const Icon = iconFor(c.icon)
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => b.search(`${c.label} near ${place.name}`)}
                    className="glass-btn inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-[var(--fill)] pr-3 pl-1.5 text-[13px] font-medium hover:bg-[var(--fill-2)]"
                  >
                    <span className="grid size-6 place-items-center rounded-full text-white" style={{ background: c.color }}>
                      <Icon className="size-3.5" />
                    </span>
                    {c.label}
                  </button>
                )
              })}
          </div>
        </section>

        <div className="flex flex-wrap gap-2">
          <a
            href={osmUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--fill)] px-3.5 py-2 text-[13px] font-medium hover:bg-[var(--fill-2)]"
          >
            <ExternalLink className="size-3.5" /> View on OpenStreetMap
          </a>
          <button
            type="button"
            onClick={() => b.push({ name: 'report', id: place.id })}
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--fill)] px-3.5 py-2 text-[13px] font-medium hover:bg-[var(--fill-2)]"
          >
            <Flag className="size-3.5" /> Report a problem
          </button>
        </div>
        <p className="label-3 mt-3 text-[11.5px]">
          Source: OpenStreetMap {place.id} · Data © OpenStreetMap contributors (ODbL)
        </p>
      </div>
    </div>
  )
}
