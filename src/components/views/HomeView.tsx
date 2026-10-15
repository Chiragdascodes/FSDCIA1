import { CaretRight, CircleNotch, Crosshair, MapTrifold, Moon, Sparkle } from '@phosphor-icons/react'
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

export default function HomeView({ b }: { b: Beacon }) {
  const hour = new Date().getHours()
  const lateNight = hour >= 22 || hour < 6
  return (
    <div className="space-y-5 px-4 pt-1 pb-6">
      <div>
        <h2 className="font-display text-[26px] font-bold tracking-tight">{greeting()}</h2>
        <p className="label-2 text-[15px]">What do you need nearby?</p>
      </div>

      {/* Location status */}
      <div className="flex items-center gap-3 rounded-2xl bg-accent-50 p-3 dark:bg-accent-500/10">
        <span className="grid size-11 place-items-center rounded-full bg-white text-accent-600 shadow-sm dark:bg-white/10">
          {b.locStatus === 'locating' ? <CircleNotch size={22} className="animate-spin" /> : <MapTrifold size={22} weight="duotone" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14.5px] font-semibold">
            {b.locStatus === 'granted' ? 'Using your location' : b.locStatus === 'locating' ? 'Finding you…' : `Showing ${b.fallbackCity.name}`}
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
            className="glass-btn inline-flex items-center gap-1.5 rounded-full bg-accent-600 px-3 py-2 text-[13px] font-semibold text-white"
          >
            <Crosshair size={16} weight="bold" /> Use
          </button>
        )}
      </div>

      {/* Category grid */}
      <section aria-labelledby="quick-title">
        <h3 id="quick-title" className="label-3 mb-2.5 px-1 text-[12px] font-semibold tracking-wide uppercase">
          Find quickly
        </h3>
        <div className="grid grid-cols-5 gap-x-1.5 gap-y-3.5">
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
                  className="grid size-[54px] place-items-center rounded-full transition-transform group-hover:-translate-y-0.5"
                  style={{ background: `${c.color}1c`, color: c.color }}
                >
                  <Icon size={27} weight="fill" />
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
          className="flex w-full items-center gap-3 rounded-2xl bg-[var(--fill-2)] p-3 text-left hover:bg-accent-50"
        >
          <Moon size={22} weight="fill" className="shrink-0 text-accent-600" />
          <span className="flex-1 text-[14px]">
            <b>Late night?</b> Find a pharmacy that’s open right now.
          </span>
          <CaretRight size={16} className="label-3" />
        </button>
      )}

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

      <section className="rounded-2xl bg-[var(--fill-2)] p-4">
        <p className="mb-2 flex items-center gap-2 text-[14px] font-semibold">
          <Sparkle size={18} weight="fill" className="text-accent-500" /> Ask the way you’d ask a friend
        </p>
        <div className="flex flex-wrap gap-2">
          {['open pharmacy near me', 'atm near MG Road', 'washroom nearby', '24/7 hospital near Koramangala'].map((t) => (
            <button
              key={t}
              type="button"
              className="rounded-xl bg-white px-3 py-1.5 text-[13px] shadow-[0_2px_6px_-3px_rgb(30_50_90/0.3)] hover:text-accent-600 dark:bg-white/10"
              onClick={() => b.search(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
