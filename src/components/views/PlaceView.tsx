import { useEffect, useRef, useState } from 'react'
import {
  ArrowSquareOut,
  BookmarkSimple,
  Clock,
  Copy,
  CreditCard,
  DotsThree,
  Flag,
  ForkKnife,
  Globe,
  MapPin,
  PaperPlaneTilt,
  Phone,
  ShareNetwork,
  Wheelchair,
} from '@phosphor-icons/react'
import { fullAddress, localityLine, shortAddress } from '../../js/api.js'
import { CATEGORIES, getCategory } from '../../js/categories.js'
import { copyText } from '../../js/events.js'
import { estimateSeconds, formatDistance, formatDuration } from '../../js/geo.js'
import { getOpenStatus, getWeekSchedule } from '../../js/hours.js'
import { findPlacePhoto } from '../../js/photos.js'
import type { Beacon } from '../../state/useBeacon'
import type { Place } from '../../types'
import { cx, PrimaryButton } from '../../ui/Glass'
import { useNow } from '../../ui/hooks'
import { iconFor } from '../../ui/icons'
import { EmptyState, OpenBadge, ViewHeader } from '../common'

const MODE_LABEL = { foot: 'walk', bike: 'by bicycle', car: 'by car' } as const

function website(p: Place) {
  const w = p.tags.website || p.tags['contact:website'] || p.tags.url
  if (!w) return null
  return /^https?:\/\//.test(w) ? w : `https://${w}`
}
function phone(p: Place) {
  return (p.tags.phone || p.tags['contact:phone'] || p.tags['contact:mobile'] || '').split(';')[0].trim() || null
}
const yesNo = (v: string | undefined) =>
  v === 'yes' ? 'Yes' : v === 'limited' ? 'Partly' : v === 'no' ? 'No' : v === 'designated' ? 'Yes (designated)' : null

/** Photo header: a real photo / brand logo from Wikimedia when OSM links one, else an illustration. */
function PlaceHero({ place }: { place: Place }) {
  const [photo, setPhoto] = useState<{ url: string; kind: 'photo' | 'logo'; credit: string } | null>(null)
  const [loaded, setLoaded] = useState(false)
  const cat = place.categoryId ? getCategory(place.categoryId) : undefined
  const Icon = iconFor(cat?.icon)
  const color = cat?.color ?? '#5b8def'

  useEffect(() => {
    const ctrl = new AbortController()
    setPhoto(null)
    setLoaded(false)
    findPlacePhoto(place.tags, ctrl.signal).then((p) => !ctrl.signal.aborted && setPhoto(p))
    return () => ctrl.abort()
  }, [place.id, place.tags])

  return (
    <div
      className="relative h-40 overflow-hidden rounded-2xl"
      style={{
        background: `radial-gradient(120% 90% at 85% 10%, ${color}55 0%, transparent 55%), radial-gradient(90% 80% at 0% 100%, ${color}33 0%, transparent 60%), linear-gradient(135deg, ${color}1a, #eef3fb)`,
      }}
    >
      {/* Illustration (always rendered underneath; covered when a photo loads) */}
      <div className="absolute inset-0 grid place-items-center">
        <span
          className="grid size-20 place-items-center rounded-full text-white shadow-[0_18px_30px_-14px_rgba(0,0,0,0.45)]"
          style={{ background: `linear-gradient(145deg, ${color}, ${color}cc)` }}
        >
          <Icon size={42} weight="fill" />
        </span>
      </div>
      {photo && (
        <img
          src={photo.url}
          alt={photo.kind === 'logo' ? `${place.name} logo` : `Photo of ${place.name}`}
          onLoad={() => setLoaded(true)}
          onError={() => setPhoto(null)}
          className={cx(
            'absolute inset-0 h-full w-full transition-opacity duration-500',
            photo.kind === 'logo' ? 'bg-white object-contain p-6' : 'object-cover',
            loaded ? 'opacity-100' : 'opacity-0',
          )}
        />
      )}
      {photo && loaded && (
        <span className="absolute right-2 bottom-2 rounded-full bg-black/45 px-2 py-0.5 text-[10px] text-white">{photo.credit}</span>
      )}
    </div>
  )
}

function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 border-b border-[var(--separator)] py-3 last:border-0">
      <span className="mt-0.5 shrink-0 text-accent-600">{icon}</span>
      <div className="min-w-0 flex-1 text-[14.5px]">{children}</div>
    </li>
  )
}

export default function PlaceView({ b, id, compact }: { b: Beacon; id: string; compact?: boolean }) {
  const now = useNow()
  const [menu, setMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const place = b.placesById.get(id)

  useEffect(() => {
    if (!menu) return
    const close = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false)
    }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [menu])

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
  const osmUrl = `https://www.openstreetmap.org/${place.id}`
  const shareUrl = `${location.origin}${location.pathname}#place=${place.id}`
  const payments = Object.entries(place.tags)
    .filter(([k, v]) => k.startsWith('payment:') && v === 'yes')
    .map(([k]) => k.slice(8).replace(/_/g, ' '))
  const wheelchair = yesNo(place.tags.wheelchair)
  const travel = place.distance !== undefined ? formatDuration(estimateSeconds(place.distance, b.mode)) : null

  const share = async () => {
    setMenu(false)
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
  const copyAddress = async () => {
    setMenu(false)
    const ok = await copyText(fullAddress(place.address) || `${place.lat}, ${place.lon}`)
    b.toast(ok ? 'Address copied.' : 'Couldn’t copy.', ok ? 'success' : 'error')
  }

  const menuItems = [
    { icon: <BookmarkSimple size={18} weight={saved ? 'fill' : 'regular'} />, label: saved ? 'Remove from Saved' : 'Save place', run: () => (setMenu(false), b.toggleSaved(place)) },
    { icon: <ShareNetwork size={18} />, label: 'Share link', run: share },
    { icon: <Copy size={18} />, label: 'Copy address', run: copyAddress },
    { icon: <Flag size={18} />, label: 'Report a problem', run: () => (setMenu(false), b.push({ name: 'report', id: place.id })) },
    { icon: <ArrowSquareOut size={18} />, label: 'View on OpenStreetMap', run: () => (setMenu(false), window.open(osmUrl, '_blank', 'noopener')) },
  ]

  return (
    <div className="px-4 pt-1 pb-8">
      {!compact && <PlaceHero place={place} />}

      <div className={cx('flex items-start gap-2', compact ? 'pt-1' : 'pt-4')}>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[23px] leading-tight font-bold tracking-tight">{place.name}</h2>
          <p className="label-2 mt-1 text-[14.5px]">
            {place.kind}
            {travel && ` · ${travel} ${MODE_LABEL[b.mode]}`}
            {place.distance !== undefined && ` · ${formatDistance(place.distance, units)}`}
          </p>
          <OpenBadge status={status} className="mt-1 !text-[14.5px]" />
        </div>
        <div ref={menuRef} className="relative">
          <button
            type="button"
            aria-label="More actions"
            aria-haspopup="menu"
            aria-expanded={menu}
            onClick={() => setMenu((m) => !m)}
            className="grid size-10 place-items-center rounded-full bg-[var(--fill)] text-[var(--label-2)] hover:bg-accent-50"
          >
            <DotsThree size={24} weight="bold" />
          </button>
          {menu && (
            <div role="menu" className="glass glass-menu absolute top-12 right-0 z-30 w-56 rounded-2xl p-1.5">
              {menuItems.map((m) => (
                <button
                  key={m.label}
                  type="button"
                  role="menuitem"
                  onClick={m.run}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14px] hover:bg-accent-50"
                >
                  <span className="text-accent-600">{m.icon}</span>
                  {m.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <PrimaryButton className="mt-4 w-full" onClick={() => b.directions(place.id)}>
        <PaperPlaneTilt size={20} weight="fill" /> Go Now
      </PrimaryButton>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {[
          { icon: <Phone size={20} weight="fill" />, label: 'Call', href: tel ? `tel:${tel.replace(/\s/g, '')}` : null },
          { icon: <Globe size={20} weight="fill" />, label: 'Website', href: web },
        ].map((a) =>
          a.href ? (
            <a
              key={a.label}
              href={a.href}
              target={a.href.startsWith('http') ? '_blank' : undefined}
              rel="noopener noreferrer"
              className="glass-btn flex flex-col items-center gap-1 rounded-2xl bg-accent-50 py-2.5 text-[12.5px] font-semibold text-accent-700 hover:bg-accent-100"
            >
              {a.icon}
              {a.label}
            </a>
          ) : (
            <span
              key={a.label}
              aria-disabled="true"
              title={`No ${a.label.toLowerCase()} on OpenStreetMap`}
              className="flex flex-col items-center gap-1 rounded-2xl bg-[var(--fill-2)] py-2.5 text-[12.5px] font-semibold text-[var(--label-3)]"
            >
              {a.icon}
              {a.label}
            </span>
          ),
        )}
        <button
          type="button"
          onClick={() => b.toggleSaved(place)}
          aria-pressed={saved}
          className="glass-btn flex flex-col items-center gap-1 rounded-2xl bg-accent-50 py-2.5 text-[12.5px] font-semibold text-accent-700 hover:bg-accent-100"
        >
          <BookmarkSimple size={20} weight="fill" />
          {saved ? 'Saved' : 'Save'}
        </button>
      </div>

      {/* Hours */}
      <section aria-labelledby="hours-title" className="mt-5 rounded-2xl bg-[var(--fill-2)] p-4">
        <h3 id="hours-title" className="mb-2 flex items-center gap-2 text-[14.5px] font-semibold">
          <Clock size={18} weight="duotone" className="text-accent-600" /> Opening hours
        </h3>
        {week ? (
          <table className="w-full text-[14px]">
            <caption className="sr-only">Opening hours for the next 7 days</caption>
            <tbody>
              {week.map((d) => (
                <tr key={d.date.toISOString()} className={cx(d.isToday && 'font-semibold text-accent-700')}>
                  <th scope="row" className="w-16 py-1 text-left font-[inherit]">
                    {d.isToday ? 'Today' : d.day}
                  </th>
                  <td className={cx('py-1 text-right tabular-nums', !d.ranges.length && 'text-pin-600')}>
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
      <ul className="mt-3 rounded-2xl bg-[var(--fill-2)] px-4">
        <Row icon={<MapPin size={18} weight="fill" />}>
          <p>{fullAddress(place.address) || `${place.lat.toFixed(5)}, ${place.lon.toFixed(5)}`}</p>
          <button type="button" className="mt-1 inline-flex items-center gap-1 text-[13px] font-semibold text-accent-600" onClick={copyAddress}>
            <Copy size={14} /> Copy address
          </button>
        </Row>
        {tel && (
          <Row icon={<Phone size={18} weight="fill" />}>
            <a className="text-accent-600" href={`tel:${tel.replace(/\s/g, '')}`}>
              {tel}
            </a>
          </Row>
        )}
        {web && (
          <Row icon={<Globe size={18} weight="fill" />}>
            <a className="break-all text-accent-600" href={web} target="_blank" rel="noopener noreferrer">
              {web.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
            </a>
          </Row>
        )}
        {wheelchair && <Row icon={<Wheelchair size={18} weight="fill" />}>Wheelchair accessible: {wheelchair}</Row>}
        {place.tags.cuisine && (
          <Row icon={<ForkKnife size={18} weight="fill" />}>Cuisine: {place.tags.cuisine.replace(/_/g, ' ').replace(/;/g, ', ')}</Row>
        )}
        {payments.length > 0 && <Row icon={<CreditCard size={18} weight="fill" />}>Pays with: {payments.join(', ')}</Row>}
        {place.tags.check_date && <Row icon={<Clock size={18} weight="fill" />}>Last verified on OSM: {place.tags.check_date}</Row>}
      </ul>

      {/* Nearby essentials from here */}
      <section aria-labelledby="nearby-title" className="mt-5">
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
                  className="glass-btn inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-[var(--fill)] px-3 text-[13.5px] font-medium hover:bg-accent-50"
                >
                  <Icon size={17} weight="fill" style={{ color: c.color }} />
                  {c.label}
                </button>
              )
            })}
        </div>
      </section>

      <p className="label-3 mt-5 text-[11.5px]">
        Source: OpenStreetMap {place.id} · Data © OpenStreetMap contributors (ODbL)
      </p>
    </div>
  )
}
