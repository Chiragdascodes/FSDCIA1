// Generates the PWA / Apple touch icons as PNGs without any image library:
// the Beacon mark (blue gradient tile + white map pin) is rasterised per pixel with
// 4× supersampling and encoded with Node's built-in zlib.
//
//   node scripts/make-icons.mjs
import { writeFileSync, mkdirSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const OUT = new URL('../public/', import.meta.url)
mkdirSync(OUT, { recursive: true })

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
function png(size, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const mix = (a, b, t) => a + (b - a) * t
const C1 = [0x7a, 0xa7, 0xf5]
const C2 = [0x2f, 0x6f, 0xdf]
const DOT = [0x2f, 0x6f, 0xdf]

/** Colour of a point in unit space (0..1), or null for transparent. */
function sample(u, v, { maskable }) {
  // Background tile (rounded rect, or full bleed for maskable icons).
  const r = 0.25
  if (!maskable) {
    const dx = Math.max(Math.abs(u - 0.5) - (0.5 - r), 0)
    const dy = Math.max(Math.abs(v - 0.5) - (0.5 - r), 0)
    if (dx * dx + dy * dy > r * r) return null
  }
  const t = (u + v) / 2
  let col = [mix(C1[0], C2[0], t), mix(C1[1], C2[1], t), mix(C1[2], C2[2], t)]

  // Pin, scaled down for maskable icons so it stays inside the safe zone.
  const s = maskable ? 0.72 : 1
  const pu = (u - 0.5) / s + 0.5
  const pv = (v - 0.5) / s + 0.5
  const cx = 0.5
  const cy = 0.43
  const R = 0.235
  const inHead = (pu - cx) ** 2 + (pv - cy) ** 2 <= R * R
  // Tail: triangle from the circle's sides down to the tip.
  const tip = 0.82
  const halfW = pv > cy && pv < tip ? R * (1 - (pv - cy) / (tip - cy)) * 0.92 : -1
  const inTail = pv > cy && pv < tip && Math.abs(pu - cx) <= halfW
  if (inHead || inTail) col = [255, 255, 255]
  if ((pu - cx) ** 2 + (pv - cy) ** 2 <= (R * 0.4) ** 2) col = DOT
  return col
}

function render(size, opts) {
  const buf = Buffer.alloc(size * size * 4)
  const SS = 4
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const c = sample((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size, opts)
          if (c) {
            r += c[0]
            g += c[1]
            b += c[2]
            a += 1
          }
        }
      }
      const i = (y * size + x) * 4
      const n = SS * SS
      buf[i] = a ? r / a : 0
      buf[i + 1] = a ? g / a : 0
      buf[i + 2] = a ? b / a : 0
      buf[i + 3] = (a / n) * 255
    }
  }
  return png(size, buf)
}

const files = {
  'icon-192.png': render(192, { maskable: false }),
  'icon-512.png': render(512, { maskable: false }),
  'icon-maskable-512.png': render(512, { maskable: true }),
  'apple-touch-icon.png': render(180, { maskable: true }),
}
for (const [name, data] of Object.entries(files)) {
  writeFileSync(new URL(name, OUT), data)
  console.log(`${name} ${data.length} bytes`)
}
