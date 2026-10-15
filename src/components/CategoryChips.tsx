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
 * A radio group: arrow keys move between chips, `change` runs the search.
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
                  'glass-btn flex h-9 cursor-pointer items-center gap-1.5 rounded-full pr-3.5 pl-1.5 text-[13.5px] font-medium whitespace-nowrap',
                  'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent-500',
                  glass ? 'glass' : 'bg-[var(--fill)] hover:bg-[var(--fill-2)]',
                  checked && '!bg-[var(--label)] !text-[var(--app-bg)]',
                )}
              >
                <span className="grid size-6 place-items-center rounded-full text-white" style={{ background: c.color }}>
                  <Icon className="size-3.5" strokeWidth={2.4} />
                </span>
                {c.label}
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
