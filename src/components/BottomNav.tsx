import { Bell, BookmarkSimple, Compass, UserCircle, type Icon } from '@phosphor-icons/react'
import { cx, Glass } from '../ui/Glass'

export type Tab = 'explore' | 'saved' | 'reports' | 'settings'

const TABS: { id: Tab; label: string; icon: Icon }[] = [
  { id: 'explore', label: 'Explore', icon: Compass },
  { id: 'saved', label: 'Saved', icon: BookmarkSimple },
  { id: 'reports', label: 'Reports', icon: Bell },
  { id: 'settings', label: 'You', icon: UserCircle },
]

/**
 * Bottom tab bar from the reference design: the active tab becomes a blue pill with its label,
 * the others are icon-only (with accessible names).
 */
export default function BottomNav({
  active,
  onChange,
  badge,
  floating,
}: {
  active: Tab
  onChange(tab: Tab): void
  badge?: number
  floating?: boolean
}) {
  return (
    <Glass
      as="nav"
      variant="strong"
      aria-label="Main"
      className={cx(
        'pointer-events-auto flex items-center justify-around gap-1 px-3',
        floating ? 'h-16 rounded-3xl' : 'h-[72px] rounded-t-[28px] pb-[env(safe-area-inset-bottom)]',
      )}
    >
      {TABS.map((t) => {
        const on = active === t.id
        const IconC = t.icon
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            aria-current={on ? 'page' : undefined}
            aria-label={t.label}
            title={t.label}
            className={cx(
              'glass-btn relative flex h-11 items-center gap-2 rounded-full transition-all duration-300',
              on
                ? 'bg-accent-500 px-5 text-white shadow-[0_8px_18px_-8px_rgb(47_111_223/0.9)]'
                : 'label-2 px-3.5 hover:text-accent-600',
            )}
          >
            <IconC size={24} weight={on ? 'fill' : 'regular'} />
            {on && <span className="text-[15px] font-semibold">{t.label}</span>}
            {!on && t.id === 'reports' && !!badge && (
              <span className="absolute top-1.5 right-2 size-2 rounded-full bg-pin-500 ring-2 ring-white" />
            )}
          </button>
        )
      })}
    </Glass>
  )
}
