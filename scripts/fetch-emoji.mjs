// ---------------------------------------------------------------------------
// Vendor the exact Twemoji PNGs the game uses into src/emoji-assets/.
//
// We self-host the icons (instead of hot-linking a CDN) because iOS Safari is
// unreliable about drawing *cross-origin* images onto a <canvas> — the helper
// strip (plain DOM <img>) looked fine on iPad while the same icons on the play
// field came up blank. Same-origin PNGs render everywhere.
//
// Run with:  node scripts/fetch-emoji.mjs
// It scans the source for emoji, downloads the matching 72x72 Twemoji PNGs and
// drops them in src/emoji-assets/<code>.png. Commit those PNGs.
// ---------------------------------------------------------------------------
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUT = join(ROOT, 'src', 'emoji-assets')
const VERSION = '14.0.2' // keep in step with the art we shipped before
const BASE = `https://cdn.jsdelivr.net/gh/twitter/twemoji@${VERSION}/assets/72x72/`

// Same filename rule emoji.js uses: hyphen-joined hex codepoints, VS16 stripped
// unless the sequence is a ZWJ join.
function emojiCode(emoji) {
  let cps = Array.from(emoji).map(c => c.codePointAt(0))
  if (cps.length > 1 && cps.includes(0xfe0f) && !cps.includes(0x200d)) {
    cps = cps.filter(c => c !== 0xfe0f)
  }
  return cps.map(c => c.toString(16)).join('-')
}

const RE = /\p{Extended_Pictographic}(️|‍\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}])*/gu
const sources = ['src/content.js', 'src/main.js']
const emojis = new Set()
for (const f of sources) {
  const text = readFileSync(join(ROOT, f), 'utf8')
  let m; RE.lastIndex = 0
  while ((m = RE.exec(text))) emojis.add(m[0])
}

mkdirSync(OUT, { recursive: true })
// Start clean so removed emoji don't leave stale files behind.
for (const f of readdirSync(OUT)) if (f.endsWith('.png')) rmSync(join(OUT, f))

const codes = [...emojis].map(emojiCode)
let ok = 0
const missing = []
await Promise.all(codes.map(async (code) => {
  const res = await fetch(BASE + code + '.png')
  if (!res.ok) { missing.push(code); return }
  const buf = Buffer.from(await res.arrayBuffer())
  writeFileSync(join(OUT, code + '.png'), buf)
  ok++
}))

console.log(`✓ saved ${ok} PNGs to src/emoji-assets/`)
if (missing.length) console.warn(`⚠ no Twemoji for: ${missing.join(', ')}`)
