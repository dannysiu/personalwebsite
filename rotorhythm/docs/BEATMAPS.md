# Rotorhythm beat maps

Beat maps are ordinary JSON files in `data/beatmaps`. The runtime song clock treats `beat: 0` as the first audible downbeat. Beat positions may be integers (`8`), half-beats (`8.5`), or any other subdivision (`8.25`). Measures are derived from `beatsPerMeasure`.

## Required song fields

- `id`, `title`, and `artist` identify the song.
- `bpm` is the initial tempo.
- `beatsPerMeasure` is normally `4`.
- `duration` is the song length in seconds.
- `offset` moves the first beat relative to run start. Positive values advance the map.

## Sections and tempo

`tempoChanges` is an ordered list of `{ "beat": 192, "bpm": 136 }` entries. The clock integrates each tempo segment, so changes do not make the beat position jump.

`sections` drive districts and arrangement. A section can select a `district` and its minimum music `layer`. District IDs are `synthwave`, `jazz`, `factory`, `storm`, `lofi`, and `volcano`.

## Events

Every event needs a numeric `beat` and `type`. Supported authoring types are:

- `gate` and `hazard` for flight patterns.
- `pickup` with a `power` name.
- `remix` to change the active arrangement.
- `switch` for Beat Pulse targets and secret routes.
- `environment` with an `action`, such as `lightning`.
- `boss` with a boss identifier. Boss attacks may be additional `hazard` events.

The optional `subdivision` label (`beat`, `half`, or `measure`) is documentation for editors; timing always comes from the numeric beat. Keep events sorted by beat. Validate a new map against `docs/beatmap.schema.json` before adding it to `data/music.json`.

## Timing and calibration

Input judgment is based on distance to the nearest beat, not on animation frames. Audio, display, keyboard, and touch offsets are applied before judging. The base window comes from the selected mode and is multiplied by the user’s timing-window accessibility setting.
