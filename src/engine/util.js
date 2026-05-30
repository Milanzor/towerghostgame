// ---------------------------------------------------------------------------
// Tiny pure helpers shared by the rendering and effects code.
// ---------------------------------------------------------------------------
export function clamp(v, a, b) { return Math.max(a, Math.min(b, v)) }

export function lighten(hex, amt) {
  const h = hex.replace('#', '')
  const num = parseInt(h.length === 3 ? h.split('').map(x => x + x).join('') : h, 16)
  let r = (num >> 16) + amt
  let g = ((num >> 8) & 0xff) + amt
  let b = (num & 0xff) + amt
  r = clamp(r, 0, 255); g = clamp(g, 0, 255); b = clamp(b, 0, 255)
  return `rgb(${r},${g},${b})`
}

// Tiny seeded RNG so a room's scattered props are placed once and stay put
// (instead of flickering to new spots every frame).
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
