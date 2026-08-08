# Rift Rotor: Two Worlds, One Flight

A complete responsive Phaser browser game. Hold to rise, release to fall, and shift instantly between two overlapping obstacle fields. The build is static, local-first, and needs no backend.

## Play locally

Requires Node.js 22.13 or later.

```bash
npm install
npm run dev
```

Open the local URL printed by the development server. Production output is created with:

```bash
npm run build
```

## Controls

- Keyboard/mouse: hold Space, W, Up Arrow, or left mouse to rise; Shift, E, or right-click to change world; Escape pauses; R rewinds in Training.
- Touchpad: press and hold the flight area to rise, release to fall, and use the large SHIFT control.
- Mobile/tablet: hold the left/play area to rise and use the independent right-side SHIFT button. Multitouch is enabled, scrolling/zoom gestures are suppressed while playing, and safe areas are respected.

The selected control profile, remapped keys, difficulty, audio mix, game speed, and accessibility options are stored locally in the browser.

## Included game systems

- Solar and Void obstacle fields with inactive-world ghost outlines
- Dimension fuel, phase energy, instability, forced shifts, pickups, enemies, gravity reversals, locked echo doors, and procedural branching routes
- Delayed Echo Helicopter path, echo items, enemy distraction, synchronized mechanisms, Echo Clone, and replay-path storage
- Phase Anchor, Chrono Bubble, Echo Clone, Rift Drill, Reality Merge, Phase Shield, and Stability Core
- Story, Endless, deterministic Daily Seed, One-Life Expert, Practice, rewind Training, Boss Rush, and Echo Puzzle modes
- A dimension-split serpent boss with alternating weak points
- Tutorial, pause/restart, fullscreen, configurable audio, reduced flashing, reduced shake, game speed, difficulty, control profiles, local stats, high score, and achievements

## Project map

- `app/game/GameApp.tsx` — responsive React interface, menus, settings, and HUD
- `app/game/runtime.ts` — Phaser scene, input, simulation, procedural art, echo logic, power-ups, and boss
- `app/game/gameData.ts` — modes and player-facing system definitions
- `public/data/asset-manifest.json` — paired Solar/Void texture contract
- `public/data/level-example.json` — authored campaign level example
- `public/data/balance.json` — tunable physics, economy, and difficulty values

The current visual layer is generated entirely with Phaser Graphics, so there are no broken asset references. The asset manifest documents the exact dimensions, anchors, and collision slots expected when paired PNG artwork is added later.

## GitHub Pages

This repository uses a Vinext/Cloudflare-compatible build by default. For a plain GitHub Pages export, serve the game from a static-capable branch or adapt the page into a Vite static entry, then enable **Settings → Pages → GitHub Actions**. A typical workflow installs dependencies, runs the static build, uploads the generated output directory, and deploys it with `actions/deploy-pages`. Ensure the site base path matches the repository name when publishing below a user or organization URL.

No server database, authentication, or API is required; all player data uses `localStorage`.
