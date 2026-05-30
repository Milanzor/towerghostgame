# 👻 Ghost Catchers — Spooky Tower Defense

A friendly, cartoonish ghost/monster tower-defense game for little kids. Drag cute
helpers onto the floor to catch spooky-but-friendly monsters before they reach the
mansion door. Nothing scary — it's all bright, bouncy and silly. 💜

## Workflow (IMPORTANT — do this on every change)

- After ANY code change, run `npm run build` to refresh `docs/`, then commit BOTH
  the source change and the rebuilt `docs/` together in the same commit. The
  compiled `docs/` is part of every commit — never commit source without rebuilding.
- Then push to `origin/main` **without asking**. GitHub Pages serves the deployed
  game, so pushing the rebuilt `docs/` is part of "done".
- In short: **edit → `npm run build` → `git add -A` → commit → push.** Always.

## Build

- Vite is the build tool. Source: `index.html` (root) + `src/*.js` + `src/style.css`.
  Output: `docs/` with split, hashed JS + CSS bundles (hashing lets the in-app
  auto-updater detect new deploys).
- `npm run dev` — local dev server with HMR.
- `npm run build` — produces `docs/`. Must be re-run before every commit.
- `npm run preview` — preview the production build locally.

## Code map

- `src/content/` — all the kid-facing game data, split by domain. **The easy
  place to add or tweak content — start here.** `src/content.js` is a barrel
  that re-exports them, so importing from `./content.js` still works.
  - `content/grid.js` — tile size + field dimensions.
  - `content/towers.js` — `TOWERS` (helpers) + `TOWER_ORDER`.
  - `content/enemies.js` — `ENEMIES` (cute monsters + bosses).
  - `content/levels.js` — `PATHS`, the themed `AREAS`, and the flat `LEVELS`.
- `src/engine/` — the game engine, split into focused modules:
  - `engine/state.js` — shared mutable state (`S.G`, `S.screen`), save/progress,
    `newGame()`.
  - `engine/dom.js` — builds the HTML scaffold; exports the canvas/HUD handles.
  - `engine/util.js` — tiny pure helpers (`clamp`, `lighten`, seeded RNG).
  - `engine/effects.js` — particles + floating combat text.
  - `engine/enemies.js` — waves, spawning, movement, damage, deaths, bosses.
  - `engine/towers.js` — leveling/stat growth, targeting, attack kinds,
    projectiles, placement, the upgrade/sell action bar.
  - `engine/render.js` — all canvas drawing.
  - `engine/input.js` — keyboard, drag-and-drop, canvas taps, touch guards.
  - `engine/ui.js` — helper palette, HUD buttons, prep banner, HUD sync.
  - `engine/screens.js` — start / room-picker / win-lose screens.
- `src/main.js` — entry point: wires the modules, runs the frame loop, boots.
- `src/audio.js` — tiny Web Audio sound engine (no audio files).
- `src/update-check.js` — polls the deployed `index.html` and shows the ✨ update
  button when a newer build is live.
- `src/style.css` — all styling.
- `scripts/smoke.mjs` — `npm run smoke`: headless-chromium gameplay smoke test
  (build first). Run it to verify engine changes don't break the running game.

## Game design notes

- Tower `kind`s (defined in `content/towers.js` / handled in `engine/towers.js`
  `updateTowers`):
  `beam`, `suck`, `splash`, `chain`, `burn`, `poison`, `frost`, `pulse`,
  `multishot`, `bank`, `snipe` (hits the toughest), `bounty` (bonus coins on
  catch), `boost` (buffs nearby helpers, never fires), `pull` (whirls the lead
  monster backwards).
- Every helper can be **leveled up** to `MAX_LEVEL` (5). There are no per-level
  stat tables — `towerStat()` in `engine/towers.js` grows the base stats via
  `LEVEL_GROWTH`, so a new helper just needs its base stats.
- Enemy powers (optional fields on an enemy def): `armor`, `shield`, `regen`,
  `split: { type, count }`. Every monster is hand-drawn in code
  (`engine/critters.js`) — one bespoke body per enemy, dispatched by key, with
  `shape: 'ghost'` selecting the classic-ghost drawer. The `emoji` field is just
  a label now, not what's rendered.
- Helpers also unlock a **new power at level 3 and level 5** (forked bolts,
  shrapnel, spreading fire/goo, extra grabs, cluster booms, knockback…) on top of
  the smooth stat growth — see the `levelTier` handling in `engine/towers.js`.
- Waves do NOT auto-start: the player presses **Start / Next Wave** when ready.
- Keep all content friendly and cute for young kids — no scary or violent wording.
