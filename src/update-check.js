// Poll the deployed index.html every minute and reveal an Update button
// when its hashed asset URLs differ from what we loaded — meaning a new
// Vite build has been deployed and the player is on a stale version.

const POLL_MS = 60_000
const FIRST_CHECK_MS = 5_000

function extractAssetSig(text) {
  return Array.from(text.matchAll(/assets\/[A-Za-z0-9_-]+\.(?:js|css)/g))
    .map(m => m[0]).sort().join('|')
}

const localSig = extractAssetSig(document.documentElement.outerHTML)

async function remoteSig() {
  try {
    const url = window.location.pathname + '?_uc=' + Date.now()
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    return extractAssetSig(await res.text())
  } catch (_) {
    return null
  }
}

export function initUpdateCheck() {
  const btn = document.getElementById('updateBtn')
  if (!btn) return

  btn.addEventListener('click', () => {
    // Cache-bust query ensures index.html itself isn't pulled from cache.
    // Vite's hashed asset URLs then handle JS/CSS cache invalidation.
    window.location.replace(window.location.pathname + '?v=' + Date.now())
  })

  // Dev (no hashed assets) — skip polling entirely.
  if (!localSig) return

  async function check() {
    const sig = await remoteSig()
    if (sig && sig !== localSig) {
      btn.hidden = false
      btn.classList.add('available')
    }
  }

  setTimeout(check, FIRST_CHECK_MS)
  setInterval(check, POLL_MS)
}
