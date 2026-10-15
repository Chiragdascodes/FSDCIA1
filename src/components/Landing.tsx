import { useState } from 'react'
import { motion } from 'motion/react'
import { ArrowRight, GithubLogo as Github, X } from '@phosphor-icons/react'
import { formatDuration } from '../js/geo.js'
import type { Route } from '../types'
import { cx, Glass } from '../ui/Glass'

interface Props {
  route: Route | null
  reducedMotion: boolean
  onExplore(): void
}

const NAV = [
  { id: 'explore', label: 'Explore' },
  { id: 'how', label: 'How it works' },
  { id: 'essentials', label: 'Essentials' },
  { id: 'about', label: 'About' },
] as const

type Panel = 'how' | 'essentials' | 'about' | null

const PANELS: Record<Exclude<Panel, null>, { title: string; body: string[] }> = {
  how: {
    title: 'How Beacon works',
    body: [
      'Ask like you would ask a friend — “pharmacy near me”, “atm near MG Road”.',
      'Beacon finds the right place in your city, sorted by distance, with Open-now status.',
      'Tap Go Now for walking, cycling or driving directions.',
    ],
  },
  essentials: {
    title: 'Ten everyday essentials',
    body: [
      'Pharmacies · Hospitals & clinics · ATMs & banks · Toilets · Food',
      'Cafés · Groceries · Fuel · Police · EV charging',
      'Filter by open now, 24/7 or wheelchair access.',
    ],
  },
  about: {
    title: 'Built on OpenStreetMap',
    body: [
      'Beacon improves the OpenStreetMap “search → place → directions” workflow for newcomers to a city.',
      'Map data © OpenStreetMap contributors (ODbL). No accounts, no tracking — your location stays in your browser.',
    ],
  },
}

/**
 * One-screen landing page (no scroll). The live 3D map of Bengaluru renders behind it, with a real
 * walking route to a pharmacy and a dot travelling along it.
 */
export default function Landing({ route, reducedMotion, onExplore }: Props) {
  const [panel, setPanel] = useState<Panel>(null)
  const minutes = route ? formatDuration(route.duration) : '6 min'
  const fade = (delay: number) =>
    reducedMotion
      ? {}
      : {
          initial: { opacity: 0, y: 14 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] as const },
        }

  return (
    <motion.div
      className="absolute inset-0 z-40 flex h-dvh flex-col overflow-hidden bg-[radial-gradient(120%_80%_at_50%_0%,#ffffff_0%,#f4f6fa_55%,#e9eef6_100%)]"
      exit={{ opacity: 0, transition: { duration: 0.6 } }}
    >
      {/* 3D city rendered in Blender (design/beacon-city.blend), floating slowly */}
      <motion.img
        src={`${import.meta.env.BASE_URL}landing/city.webp`}
        alt="Illustrated 3D city with a walking route to a pharmacy"
        draggable={false}
        className="pointer-events-none absolute top-[50vh] left-1/2 w-[175vw] max-w-none -translate-x-[52%] select-none md:top-[38vh] md:w-[min(1600px,112vw)]"
        initial={reducedMotion ? false : { opacity: 0, y: 40 }}
        animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: [0, -10, 0] }}
        transition={
          reducedMotion
            ? { duration: 0 }
            : { opacity: { duration: 1.2 }, y: { duration: 9, repeat: Infinity, ease: 'easeInOut' } }
        }
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[44%] bg-gradient-to-b from-[#f9fafc] via-[#f9fafc]/70 to-transparent" />

      {/* Header */}
      <header className="pointer-events-auto relative flex items-center justify-between px-5 pt-5 md:px-12 md:pt-8">
        <span className="font-display text-[26px] font-extrabold tracking-tight text-[#14161c] md:text-[30px]">Beacon</span>
        <nav aria-label="Landing" className="absolute left-1/2 hidden -translate-x-1/2 gap-8 md:flex">
          {NAV.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => (n.id === 'explore' ? onExplore() : setPanel(panel === n.id ? null : n.id))}
              className={cx(
                'text-[15px] transition-colors',
                n.id === 'explore' || panel === n.id ? 'font-semibold text-[#14161c]' : 'text-[#5b6170] hover:text-[#14161c]',
              )}
            >
              {n.label}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-4">
          <a
            href="https://github.com/Chiragdascodes/FSDCIA1"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden items-center gap-1.5 text-[15px] text-[#5b6170] hover:text-[#14161c] sm:inline-flex"
          >
            <Github className="size-4" /> GitHub
          </a>
          <button
            type="button"
            onClick={onExplore}
            className="rounded-full bg-[#14161c] px-4 py-2 text-[14px] font-semibold text-white shadow-[0_8px_18px_-8px_rgb(0_0_0/0.6)] transition hover:bg-black"
          >
            Open app
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="pointer-events-auto relative mx-auto mt-[7vh] flex max-w-[880px] flex-col items-center px-6 text-center md:mt-[8vh]">
        <motion.h1
          {...fade(0.05)}
          className="font-display text-[40px] leading-[1.05] font-bold tracking-[-0.035em] text-[#14161c] sm:text-[56px] md:text-[72px]"
        >
          Find what you need,
          <br />
          right where you are
        </motion.h1>
        <motion.p {...fade(0.18)} className="mt-5 max-w-[560px] text-[16px] leading-relaxed text-[#5b6170] md:text-[18px]">
          Ask for a pharmacy, ATM or hospital “near me” and get the nearest open places, real distances and walking
          directions in seconds — built on OpenStreetMap.
        </motion.p>
        <motion.button
          {...fade(0.3)}
          type="button"
          onClick={onExplore}
          className="group mt-8 inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-[#2b2e36] to-[#0d0f13] px-7 py-3.5 text-[16px] font-semibold text-white shadow-[0_18px_30px_-12px_rgb(0_0_0/0.65),inset_0_1px_0_rgb(255_255_255/0.18)] transition-transform hover:-translate-y-0.5 active:translate-y-0"
        >
          Explore Beacon
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </motion.button>
      </section>

      {/* Floating status card (like “Your Ride” in the reference) */}
      <motion.div
        {...(reducedMotion
          ? {}
          : {
              initial: { opacity: 0, y: 30, scale: 0.96 },
              animate: { opacity: 1, y: 0, scale: 1 },
              transition: { duration: 0.9, delay: 0.5, ease: [0.22, 1, 0.36, 1] as const },
            })}
        className="pointer-events-auto absolute right-[5%] bottom-[10%] hidden w-[270px] md:block lg:right-[10%]"
      >
        <Glass variant="strong" className="rounded-[22px] p-4">
          <p className="text-[13px] font-semibold text-[#14161c]">Your trip</p>
          <p className="text-[11px] text-[#7a8090]">to the nearest pharmacy</p>
          <div className="mt-2 flex items-end justify-between gap-2">
            <div>
              <p className="text-[11px] text-[#7a8090]">Arriving in</p>
              <p className="font-display text-[30px] leading-none font-bold text-[#14161c]">
                {minutes.replace(' min', '')}
                <span className="ml-1 text-[12px] font-medium text-[#7a8090]">min</span>
              </p>
            </div>
            <img
              src={`${import.meta.env.BASE_URL}landing/car.webp`}
              alt="3D car"
              className="-mr-3 -mb-2 w-[150px] drop-shadow-[0_14px_14px_rgba(30,50,90,0.25)]"
              draggable={false}
            />
          </div>
          <p className="mt-2 text-[12px] font-semibold text-emerald-600">● Open now · closes 23:00</p>
          <div className="relative mt-4 h-1.5 rounded-full bg-[#e8ebf1]">
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full bg-[#14161c]"
              initial={{ width: '8%' }}
              animate={reducedMotion ? { width: '55%' } : { width: ['8%', '55%', '96%'] }}
              transition={{ duration: 24, repeat: Infinity, ease: 'linear' }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] text-[#7a8090]">
            <span>Found</span>
            <span>On the way</span>
            <span>Arrived</span>
          </div>
        </Glass>
      </motion.div>

      {/* Info popovers for the nav items (keeps it a single screen) */}
      {panel && (
        <Glass
          variant="strong"
          role="dialog"
          aria-label={PANELS[panel].title}
          className="pointer-events-auto absolute top-24 left-1/2 w-[min(440px,calc(100%-32px))] -translate-x-1/2 rounded-3xl p-5"
        >
          <div className="mb-2 flex items-start justify-between">
            <h2 className="font-display text-[18px] font-bold">{PANELS[panel].title}</h2>
            <button type="button" aria-label="Close" onClick={() => setPanel(null)} className="text-[#7a8090]">
              <X className="size-5" />
            </button>
          </div>
          <ul className="space-y-2 text-[14px] text-[#5b6170]">
            {PANELS[panel].body.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </Glass>
      )}

      {/* Footer */}
      <footer className="pointer-events-auto absolute inset-x-0 bottom-3 flex justify-center md:bottom-5">
        <span className="rounded-full bg-white/85 px-4 py-1.5 text-[12.5px] text-[#5b6170] shadow-[0_6px_16px_-8px_rgb(30_50_90/0.35)] backdrop-blur">
          Developed by <b className="font-semibold text-[#14161c]">Chirag Das</b>
        </span>
      </footer>
    </motion.div>
  )
}
