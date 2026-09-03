# Open Forecast

An interactive 2026 US Open men's singles bracket forecast for `dannysiudata.com/usopen/`.

## What is included

- The remaining official men's singles draw as of September 3, 2026 at 5:54 PM Central.
- Central-time conversions of the official Day 5 order of play.
- User-selectable winners with automatic bracket propagation.
- A one-click model projection and exact bracket-based title probabilities.
- Optional Google sign-in using the Firebase project already configured for `dannysiudata.com`.
- Device-local bracket saves, separated by Google account when signed in.

## Updating the tournament snapshot

The draw and schedule are intentionally stored in `app.js` so the page remains reliable on static hosting. Update the open matches and official times from:

- https://www.usopen.org/en_US/draws/mens-singles.html
- https://www.usopen.org/en_US/scores/schedule/index.html

The model probabilities are informational forecasts, not sportsbook odds.
