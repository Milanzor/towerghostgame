# 👻 Ghost Catchers — a friendly tower defense for little kids

A cartoonish, **not-at-all-scary** tower defense game inspired by *Luigi's Mansion*.
Cute ghosts float through a haunted house and you build silly helpers — a
**Flashlight** 🔦, a **Poltergust** 🌀 and a **Boo Bomb** 💥 — to gently catch them.
Designed to be easy and rewarding for a 5-year-old, with big buttons, happy sounds,
coins, and ⭐ stars for every level.

Built with **Vite** + plain HTML5 Canvas — no game-engine dependency, so it's tiny
and loads instantly. Builds straight into `docs/` for GitHub Pages.

## How to play (kid-friendly)

1. Tap **▶ Play**, then pick a room.
2. Tap a helper at the bottom (🔦 / 🌀 / 💥), then tap the glowing floor dots to place it.
3. Tap **▶ GO!** to start a wave of ghosts (or just wait — it starts on its own).
4. Catch all the ghosts before they reach the door 🏚️. Earn 🪙 coins for each one.
5. Tap a placed helper to **⬆️ Upgrade** it or **🗑️ Sell** it.
6. Clear all the waves to win ⭐ stars and unlock the next room!

There are **5 progressively harder rooms**, ending with a **King Boo 👑** boss.
Stars and progress are saved automatically in the browser.

## Develop

```bash
npm install
npm run dev      # local dev server with hot reload
npm run build    # builds into docs/
npm run preview  # preview the production build
```

## Deploy on GitHub Pages

Two ways — pick one:

**A. GitHub Actions (recommended, already included).**
Push to `main`. The workflow in `.github/workflows/deploy.yml` builds the project
and deploys the `docs/` output to Pages automatically.
In your repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

**B. Serve the committed `docs/` folder.**
Run `npm run build`, commit the `docs/` folder, then set
**Settings → Pages → Source: Deploy from a branch → `main` / `docs`**.

## Tweaking the game

Almost everything kid-facing lives in [`src/content.js`](src/content.js):

- **`TOWERS`** — the helpers, their cost, range, damage and upgrades.
- **`ENEMIES`** — the ghost types (health, speed, reward, looks).
- **`LEVELS`** — the rooms: the path the ghosts walk, starting coins, lives,
  difficulty scaling, and the waves of ghosts.

Make it easier by raising `startCoins`/`lives` or lowering enemy `hp`/`hpScale`.
