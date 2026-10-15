import { Bookmark, ChevronRight, LoaderCircle, LocateFixed, MapPinned, Settings, Sparkles } from 'lucide-react'
import { CATEGORIES } from '../../js/categories.js'
import { formatDistance } from '../../js/geo.js'
import type { Beacon } from '../../state/useBeacon'
import { iconFor } from '../../ui/icons'
import { CategoryDot } from '../common'

function greeting(d = new Date()) {
  const h = d.getHours()
  if (h < 5) return 'Up late?'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function HomeView({ b, compact }: { b: Beacon; compact: boolean }) {
  const lateNight = new Date().getHours() >= 22 || new Date().getHours() < 6
  return (
    <div className="space-y-5 px-4 pb-6">
      {!compact && (
        <div className="pt-1">
          <h2 className="text-[24px] font-bold tracking-tight">{greeting()}</h2>
          <p className="label-2 text-[14.5px]">What do you need nearby?</p>
        </div>
      )}

      {/* Location status */}
      <div className="flex items-center gap-3 rounded-2xl bg-[var(--fill-2)] p-3">
        <span className="grid size-10 place-items-center rounded-full bg-[#0a84ff]/12 text-[#0a84ff]">
          {b.locStatus === 'locating' ? <LoaderCircle className="size-5 animate-spin" /> : <MapPinned className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold">
            {b.locStatus === 'granted'
              ? 'Using your location'
              : b.locStatus === 'locating'
                ? 'Finding you…'
                : `Showing ${b.fallbackCity.name}`}
          </p>
          <p className="label-2 truncate text-[12.5px]">
            {b.locStatus === 'granted' && b.user
              ? `Accurate to about ${formatDistance(b.user.accuracy ?? 50)}`
              : 'Allow location to search right where you are'}
          </p>
        </div>
        {b.locStatus !== 'granted' && (
          <button
            type="button"
            onClick={() => b.locate({ fly: true })}
            className="glass-btn inline-flex items-center gap-1.5 rounded-full bg-[#0a84ff] px-3 py-1.5 text-[13px] font-semibold text-white"
          >
            <LocateFixed className="size-4" /> Use
          </button>
        )}
      </div>

      {/* Category grid */}
      <section aria-labelledby="quick-title">
        <h3 id="quick-title" className="label-3 mb-2 px-1 text-[12px] font-semibold tracking-wide uppercase">
          Find quickly
        </h3>
        <div className="grid grid-cols-5 gap-x-1 gap-y-3">
          {CATEGORIES.map((c) => {
            const Icon = iconFor(c.icon)
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => b.searchCategory(c.id)}
                className="glass-btn group flex flex-col items-center gap-1.5 rounded-2xl p-1"
              >
                <span
                  className="grid size-12 place-items-center rounded-full text-white shadow-[0_6px_14px_-6px_rgb(0_0_0/0.35)] transition-transform group-hover:-translate-y-0.5"
                  style={{ background: c.color }}
                >
                  <Icon className="size-[22px]" />
                </span>
                <span className="text-center text-[11.5px] leading-tight font-medium">{c.label}</span>
              </button>
            )
          })}
        </div>
      </section>

      {lateNight && (
        <button
          type="button"
          onClick={() => b.search('open pharmacy near me')}
          className="flex w-full items-center gap-3 rounded-2xl bg-emerald-500/10 p-3 text-left hover:bg-emerald-500/15"
        >
          <Sparkles className="size-5 shrink-0 text-emerald-600" />
          <span className="flex-1 text-[14px]">
            <b>Late night?</b> Find a pharmacy that’s open right now.
          </span>
          <ChevronRight className="label-3 size-4" />
        </button>
      )}

      {/* Saved */}
      {b.saved.length > 0 && (
        <section aria-labelledby="saved-title">
          <div className="mb-1 flex items-center justify-between px-1">
            <h3 id="saved-title" className="label-3 text-[12px] font-semibold tracking-wide uppercase">
              Saved
            </h3>
            <button type="button" className="text-[13px] font-semibold text-accent-600" onClick={() => b.push({ name: 'saved' })}>
              See all
            </button>
          </div>
          <ul>
            {b.saved.slice(0, 3).map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left hover:bg-[var(--fill-2)]"
                  onClick={() => b.selectPlace(p.id)}
                >
                  <CategoryDot place={p} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{p.name}</span>
                    <span className="label-2 block truncate text-[12.5px]">{p.kind}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Tips */}
      <section className="rounded-2xl bg-[var(--fill-2)] p-3.5">
        <p className="mb-1.5 text-[13.5px] font-semibold">Ask the way you’d ask a friend</p>
        <ul className="label-2 space-y-1 text-[13px]">
          {['open pharmacy near me', 'atm near MG Road', 'washroom nearby', '24/7 hospital near Koramangala'].map((t) => (
            <li key={t}>
              <button type="button" className="text-left hover:text-accent-600" onClick={() => b.search(t)}>
                “{t}”
              </button>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => b.push({ name: 'saved' })}
          className="flex flex-1 items-center gap-2 rounded-2xl bg-[var(--fill-2)] p-3 text-[13.5px] font-medium hover:bg-[var(--fill)]"
        >
          <Bookmark className="size-4" /> Saved places
        </button>
        <button
          type="button"
          onClick={() => b.push({ name: 'settings' })}
          className="flex flex-1 items-center gap-2 rounded-2xl bg-[var(--fill-2)] p-3 text-[13.5px] font-medium hover:bg-[var(--fill)]"
        >
          <Settings className="size-4" /> Settings
        </button>
      </div>
    </div>
  )
}
