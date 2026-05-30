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

- `src/content.js` — all the kid-facing game data: `TOWERS` (helpers), `ENEMIES`
  (cute monsters), and `LEVELS` (rooms/maps). This is the easy place to add or tweak
  content — start here.
- `src/main.js` — the game engine: rendering, input (incl. drag-and-drop placement),
  waves, tower behaviours and enemy mechanics.
- `src/audio.js` — tiny Web Audio sound engine (no audio files).
- `src/update-check.js` — polls the deployed `index.html` and shows the ✨ update
  button when a newer build is live.
- `src/style.css` — all styling.

## Game design notes

- Tower `kind`s (in `content.js` / handled in `main.js` `updateTowers`):
  `beam`, `suck`, `splash`, `chain`, `burn`, `poison`, `frost`, `pulse`,
  `multishot`, `bank`.
- Enemy powers (optional fields on an enemy def): `armor`, `shield`, `regen`,
  `split: { type, count }`. Enemies render as classic ghosts (`shape: 'ghost'`) or
  as emoji critters (any def with an `emoji`).
- Waves do NOT auto-start: the player presses **Start / Next Wave** when ready.
- Keep all content friendly and cute for young kids — no scary or violent wording.
