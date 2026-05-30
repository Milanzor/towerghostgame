// ---------------------------------------------------------------------------
// Emoji rendering that works on EVERY device.
//
// Some tablets/browsers don't render colour emoji in <canvas> (and a few not
// even in the DOM), so helpers/monsters showed up as plain coloured circles.
// Instead of trusting the system emoji font we draw Twemoji PNGs — identical
// art everywhere. We still fall back to text drawing if an image hasn't
// loaded yet (e.g. offline), so nothing ever breaks.
// ---------------------------------------------------------------------------

// We self-host the icons (see scripts/fetch-emoji.mjs). Vite hashes each PNG
// and serves it same-origin, which is what fixes the blank icons on iPad:
// iOS Safari is unreliable about drawing *cross-origin* images to a <canvas>.
// Anything we somehow didn't vendor falls back to the CDN so nothing breaks.
const CDN = 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/'

// code ("1f47b") -> bundled, hashed, same-origin URL.
const LOCAL = {}
const assets = import.meta.glob('./emoji-assets/*.png', {
  eager: true, query: '?url', import: 'default',
})
for (const path in assets) {
  const code = path.slice(path.lastIndexOf('/') + 1, -'.png'.length)
  LOCAL[code] = assets[path]
}

// Twemoji filenames: hyphen-joined hex codepoints, with the VS16 (U+FE0F)
// presentation selector stripped unless it's part of a ZWJ sequence.
export function emojiCode(emoji) {
  let cps = Array.from(emoji).map(c => c.codePointAt(0))
  if (cps.length > 1 && cps.includes(0xfe0f) && !cps.includes(0x200d)) {
    cps = cps.filter(c => c !== 0xfe0f)
  }
  return cps.map(c => c.toString(16)).join('-')
}
export function emojiUrl(emoji) {
  const code = emojiCode(emoji)
  return LOCAL[code] || (CDN + code + '.png')
}

// --- Canvas image cache -----------------------------------------------------
const cache = new Map() // emoji -> HTMLImageElement
export function preloadEmoji(list) {
  for (const e of list) {
    if (!e || cache.has(e)) continue
    const img = new Image()
    img.decoding = 'async'
    img.src = emojiUrl(e)
    cache.set(e, img)
  }
}

const FALLBACK_FONT = '"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji",sans-serif'

// Draw an emoji centred at (cx, cy) at the given pixel size.
export function drawEmoji(ctx, emoji, cx, cy, size) {
  let img = cache.get(emoji)
  if (!img) { preloadEmoji([emoji]); img = cache.get(emoji) }
  if (img && img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size)
    return
  }
  // not loaded yet → text fallback (still readable on most devices)
  ctx.font = `${size}px ${FALLBACK_FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(emoji, cx, cy)
}

// --- DOM replacement --------------------------------------------------------
// Swap emoji in an element's text for <img class="twemoji"> so the UI shows
// the same art as the canvas, even on devices with no emoji font.
const EMOJI_RE = /\p{Extended_Pictographic}(️|‍\p{Extended_Pictographic})*/gu

export function twemojify(root) {
  if (!root) return
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes = []
  while (walker.nextNode()) {
    const n = walker.currentNode
    if (n.nodeValue && EMOJI_RE.test(n.nodeValue)) nodes.push(n)
  }
  for (const node of nodes) {
    const txt = node.nodeValue
    EMOJI_RE.lastIndex = 0
    const frag = document.createDocumentFragment()
    let last = 0, m
    while ((m = EMOJI_RE.exec(txt))) {
      if (m.index > last) frag.appendChild(document.createTextNode(txt.slice(last, m.index)))
      const img = document.createElement('img')
      img.className = 'twemoji'
      img.src = emojiUrl(m[0])
      img.alt = m[0]
      img.draggable = false
      frag.appendChild(img)
      last = m.index + m[0].length
    }
    if (last < txt.length) frag.appendChild(document.createTextNode(txt.slice(last)))
    node.parentNode.replaceChild(frag, node)
  }
}

// Set an element's text and immediately swap any emoji to images.
export function setEmojiText(el, text) {
  el.textContent = text
  twemojify(el)
}
