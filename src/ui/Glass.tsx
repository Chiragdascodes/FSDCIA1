import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react'

type Variant = 'regular' | 'strong' | 'clear'

function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}
export { cx }

interface GlassProps extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant
  lens?: boolean
  as?: 'div' | 'section' | 'aside' | 'nav' | 'header'
}

/** A Liquid Glass surface (functional layer only — HIG: never use glass in the content layer). */
export const Glass = forwardRef<HTMLDivElement, GlassProps>(function Glass(
  { variant = 'regular', lens = false, as: Tag = 'div', className, ...rest },
  ref,
) {
  return (
    <Tag
      ref={ref}
      className={cx(
        'glass',
        variant === 'strong' && 'glass-strong',
        variant === 'clear' && 'glass-clear',
        lens && 'glass-lens',
        className,
      )}
      {...rest}
    />
  )
})

interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  children: ReactNode
  active?: boolean
  variant?: Variant
}

/** Round glass control with an accessible label and tooltip. */
export function GlassButton({ label, children, active, variant = 'regular', className, ...rest }: GlassButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        'glass glass-btn glass-lens grid size-11 place-items-center rounded-full text-[var(--label)]',
        variant === 'clear' && 'glass-clear',
        active && '!bg-accent-500 !text-white',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

/** Primary action: the only place the accent colour fills a background (HIG: Liquid Glass color). */
export function PrimaryButton({ className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cx(
        'glass-btn inline-flex items-center justify-center gap-2 rounded-full bg-accent-600 px-4 py-2.5 text-[15px] font-semibold text-white shadow-[0_8px_20px_-8px_rgb(5_150_105/0.7)] hover:bg-accent-700 disabled:opacity-50',
        className,
      )}
      {...rest}
    />
  )
}

/** Secondary pill on a fill (no glass inside the content layer). */
export function PillButton({ className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cx(
        'glass-btn inline-flex items-center justify-center gap-1.5 rounded-full bg-[var(--fill)] px-3.5 py-2 text-[14px] font-medium text-[var(--label)] hover:bg-[var(--fill-2)] disabled:opacity-50',
        className,
      )}
      {...rest}
    />
  )
}
