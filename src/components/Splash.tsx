import { motion } from 'motion/react'

/** Full-screen loading screen shown until the 3D map has drawn its first frame of tiles. */
export default function Splash({ message }: { message: string }) {
  return (
    <motion.div
      className="absolute inset-0 z-[60] grid place-items-center bg-[#f4f6fa]"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } }}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center">
        <motion.svg
          viewBox="0 0 64 64"
          className="size-20 drop-shadow-[0_14px_24px_rgba(47,111,223,0.35)]"
          aria-hidden
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        >
          <defs>
            <linearGradient id="splash-g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#7aa7f5" />
              <stop offset="1" stopColor="#2f6fdf" />
            </linearGradient>
          </defs>
          <rect width="64" height="64" rx="32" fill="url(#splash-g)" />
          <path d="M32 13c-8.3 0-15 6.6-15 14.8C17 39 32 52 32 52s15-13 15-24.2C47 19.6 40.3 13 32 13z" fill="#fff" />
          <circle cx="32" cy="28" r="6" fill="#2f6fdf" />
        </motion.svg>
        <p className="font-display mt-6 text-[26px] font-extrabold tracking-tight text-[#14161c]">Beacon</p>
        <p className="mt-1 text-[14px] text-[#5b6170]">{message}</p>
        <div className="relative mt-6 h-1 w-48 overflow-hidden rounded-full bg-[#e3e8f1]">
          <motion.span
            className="absolute inset-y-0 w-1/3 rounded-full bg-accent-500"
            animate={{ left: ['-35%', '100%'] }}
            transition={{ duration: 1.3, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
      </div>
    </motion.div>
  )
}
