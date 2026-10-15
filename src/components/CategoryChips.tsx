import { CATEGORIES } from '../js/categories.js'
import { cx } from '../ui/Glass'
import { iconFor } from '../ui/icons'

interface Props {
  active: string | null
  onPick(id: string): void
  glass?: boolean
}

/**
 * One-tap category search (HIG Maps: "offer a search feature combined with a way to filter by category").
 * A radio group of white pills; `change` runs the search.
 */
export default function CategoryChips({ active, onPick, glass }: Props) {
  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">Quick search by category</legend>
      <div className="no-scrollbar -mx-1 flex snap-x gap-2 overflow-x-auto px-1 py-1">
        {CATEGORIES.map((c) => {
          const Icon = iconFor(c.icon)
          const checked = active === c.id
          return (
            <label key={c.id} className="shrink-0 snap-start">
              <input
                type="radio"
                name="category"
                value={c.id}
                checked={checked}
                onChange={() => onPick(c.id)}
                onClick={() => checked && onPick(c.id)}
                className="peer sr-only"
              />
              <span
                className={cx(
                  'glass-btn flex h-10 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-[14.5px] font-medium whitespace-nowrap',
                  'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent-500',
                  glass ? 'glass glass-strong' : 'bg-[var(--fill)] hover:bg-accent-50',
                  checked && '!bg-accent-600 !text-white',
                )}
              >
                <Icon size={17} weight="fill" style={{ color: checked ? '#fff' : c.color }} />
                {c.label}
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
