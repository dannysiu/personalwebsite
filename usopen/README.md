# Open Forecast

An interactive 2026 US Open men's singles bracket forecast for `dannysiudata.com/usopen/`.

## What is included

- The remaining official men's singles draw as of September 3, 2026 at 5:54 PM Central.
- Match times converted from the official order of play into each visitor's local timezone.
- A connected, classic tournament-tree bracket with user-selectable winners and automatic propagation.
- A one-click model projection and exact bracket-based title probabilities.
- A saved light/dark mode toggle.
- DraftKings moneyline snapshots for unfinished Round 2 matches, with clearly labeled forecast lines later in the draw.
- Optional Gmail sign-in through Google OAuth using the Firebase project already configured for `dannysiudata.com`.
- Device-local bracket saves, separated by Gmail account when signed in.
- Preloaded player portraits and summaries, with ranking, coach, playing hand, and birth information loaded on demand from Wikipedia.
- Sourced US Open news cards for players advancing and notable upsets.

## Updating the tournament snapshot

The draw and schedule are intentionally stored in `app.js` so the page remains reliable on static hosting. Update the open matches and official times from:

- https://www.usopen.org/en_US/draws/mens-singles.html
- https://www.usopen.org/en_US/scores/schedule/index.html

The model probabilities are informational forecasts, not sportsbook odds.
