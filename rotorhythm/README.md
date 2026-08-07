# Rotorhythm: Neon Airwaves

A responsive one-button rhythm-flight browser game built with Phaser 3, CSS, JavaScript modules, procedural Graphics art, and original generated Web Audio tones.

## Run locally

Serve the folder over HTTP (ES modules and JSON manifests do not work reliably from `file://`):

```bash
python3 -m http.server 4173
```

Open `http://localhost:4173`. Internet access is needed once to load Phaser and the two UI fonts from their public CDNs. The music itself is synthesized locally and contains no commercial recordings.

## Controls

- Hold `Space`, `W`, `Up`, or the canvas to rise; release to fall.
- Press `Enter` for Beat Pulse and `E` for the equipped power-up.
- Press `Escape` to pause.
- Mobile and touchpad modes expose a dedicated flight zone and separate multitouch action buttons.

Control mode, calibration, accessibility options, achievements, high scores, unlocked aircraft, cosmetic trails, and best-run ghost samples are saved in localStorage.

Google account sign-in is available through the same Firebase Authentication project already used by the companion game on `dannysiudata.com`. It is optional—the full game remains playable as a guest—and progress currently remains local to the browser.

## Project map

- `index.html` — semantic menu, game HUD, results, pause, and settings UI.
- `css/styles.css` — responsive neon interface, safe-area and reduced-motion rules.
- `js/game.js` — Phaser scene, physics, obstacle patterns, districts, pulse, pickups, boss, scoring.
- `js/rhythm.js` — tempo-aware song clock and latency-adjusted beat judgment.
- `js/audio.js` — original four-layer procedural music and sound effects.
- `js/app.js` — screen flow, settings, calibration, controls, saves, and results.
- `data/assets.json` / `data/music.json` — art and music manifests.
- `data/balance.json` — tunable gameplay values.
- `data/beatmaps/neon-airwaves.json` — editable sample beat map.
- `docs/BEATMAPS.md` — custom-map authoring guide and schema reference.

## Included play styles

Music campaign, Endless Mix, Daily Challenge, Practice, No-fail Visualizer, Expert One-life, Boss Rush, Rhythm Accuracy, and Relaxed Flight are all available from the menu. A flight-plan selector can run the full district tour or start in any one of the six visual districts.

## Accessibility

Settings include independent audio/effects volume, keyboard/touch/audio/display latency, visual timing indicators, metronome, timing-window scaling, reduced flashing, photosensitivity-safe mode, reduced motion, vibration, screen shake, difficulty, visual intensity, and high contrast.
