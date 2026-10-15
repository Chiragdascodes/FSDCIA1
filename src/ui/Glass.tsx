import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react'

type Variant = 'regular' | 'strong' | 'clear'

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

interface GlassProps extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant
  lens?: boolean
  as?: 'div' | 'section' | 'aside' | 'nav' | 'header'
}

/** A white Liquid Glass surface (functional layer only — HIG: never use glass in the content layer). */
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

interface ControlProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  children: ReactNode
  active?: boolean
  variant?: Variant
}

/** Square white map control with a blue glyph (as in the reference UI). */
export function GlassButton({ label, children, active, variant = 'strong', className, ...rest }: ControlProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        'glass glass-btn glass-lens grid size-12 place-items-center rounded-full text-accent-600',
        variant === 'strong' && 'glass-strong',
        variant === 'clear' && 'glass-clear text-white',
        active && '!bg-accent-600 !text-white',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

/** Primary action: the blue "Go Now" button — the only filled accent surface (HIG: Liquid Glass color). */
export function PrimaryButton({ className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cx(
        'glass-btn inline-flex h-12 items-center justify-center gap-2 rounded-full bg-accent-600 px-5 text-[16px] font-semibold text-white shadow-[0_12px_24px_-12px_rgb(47_111_223/0.8)] hover:bg-accent-700 disabled:opacity-50',
        className,
      )}
      {...rest}
    />
  )
}

/** Secondary pill on a soft blue fill (no glass inside the content layer). */
export function PillButton({ className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cx(
        'glass-btn inline-flex items-center justify-center gap-1.5 rounded-full bg-[var(--fill)] px-3.5 py-2 text-[14px] font-medium text-[var(--label)] hover:bg-accent-100 disabled:opacity-50',
        className,
      )}
      {...rest}
    />
  )
}
