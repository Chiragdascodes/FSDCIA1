import { useEffect, useState } from 'react'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches)
    setMatches(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])
  return matches
}

export const useIsDesktop = () => useMediaQuery('(min-width: 768px)')
export const useReducedMotion = () => useMediaQuery('(prefers-reduced-motion: reduce)')
export const useSystemDark = () => useMediaQuery('(prefers-color-scheme: dark)')

/** Re-render every `ms` so "Open · closes 23:30" badges stay current. */
export function useNow(ms = 60_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}
