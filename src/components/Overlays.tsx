import { AnimatePresence, motion } from 'motion/react'
import { WarningCircle as CircleAlert, CheckCircle as CircleCheck, Info, ArrowClockwise as RotateCw, Warning as TriangleAlert, WifiSlash as WifiOff, X } from '@phosphor-icons/react'
import type { Toast } from '../state/useBeacon'
import { cx, Glass } from '../ui/Glass'

const ICONS = { info: Info, success: CircleCheck, warning: TriangleAlert, error: CircleAlert }
const TONE = {
  info: 'text-accent-600',
  success: 'text-emerald-500',
  warning: 'text-amber-500',
  error: 'text-red-500',
}

export function Toasts({ toasts, onDismiss, reducedMotion }: { toasts: Toast[]; onDismiss(id: number): void; reducedMotion: boolean }) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+128px)] z-50 flex flex-col items-center gap-2 px-4 md:top-auto md:bottom-6"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const Icon = ICONS[t.tone]
          return (
            <motion.div
              key={t.id}
              layout={!reducedMotion}
              initial={reducedMotion ? false : { opacity: 0, y: -12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              className="pointer-events-auto w-full max-w-[420px]"
            >
              <Glass variant="strong" role={t.tone === 'error' ? 'alert' : 'status'} className="flex items-center gap-3 rounded-2xl px-4 py-3">
                <Icon size={22} weight="fill" className={cx('shrink-0', TONE[t.tone])} />
                <p className="min-w-0 flex-1 text-[14px] font-medium">{t.text}</p>
                {t.action && (
                  <button
                    type="button"
                    className="shrink-0 text-[14px] font-semibold text-accent-600"
                    onClick={() => {
                      t.action!.run()
                      onDismiss(t.id)
                    }}
                  >
                    {t.action.label}
                  </button>
                )}
                <button type="button" aria-label="Dismiss" className="label-3 shrink-0" onClick={() => onDismiss(t.id)}>
                  <X className="size-4" />
                </button>
              </Glass>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

export function OfflineBanner() {
  return (
    <Glass role="status" className="flex items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-semibold text-amber-700 dark:text-amber-300">
      <WifiOff className="size-4" /> Offline — saved places still work
    </Glass>
  )
}

export function SearchAreaButton({ onClick }: { onClick(): void }) {
  return (
    <Glass lens className="rounded-full">
      <button type="button" onClick={onClick} className="glass-btn flex items-center gap-2 px-4 py-2.5 text-[14px] font-semibold">
        <RotateCw size={16} weight="bold" className="text-accent-600" /> Search this area
      </button>
    </Glass>
  )
}

export function Logo({ compact }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2 select-none">
      <svg viewBox="0 0 64 64" className="size-8 drop-shadow-sm" aria-hidden>
        <defs>
          <linearGradient id="lg-logo" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#7aa7f5" />
            <stop offset="1" stopColor="#2f6fdf" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="16" fill="url(#lg-logo)" />
        <path d="M32 13c-8.3 0-15 6.6-15 14.8C17 39 32 52 32 52s15-13 15-24.2C47 19.6 40.3 13 32 13z" fill="#fff" />
        <circle cx="32" cy="28" r="6" fill="#2f6fdf" />
      </svg>
      {!compact && <span className="font-display text-[20px] font-extrabold tracking-tight">Beacon</span>}
    </span>
  )
}
