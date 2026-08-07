export class RhythmClock {
  constructor(beatmap, settings) {
    this.map = beatmap; this.settings = settings; this.startedAt = 0; this.pausedAt = 0; this.pauseTotal = 0; this.running = false;
  }
  start(now = performance.now()) { this.startedAt = now; this.pauseTotal = 0; this.running = true; }
  pause(now = performance.now()) { if (this.running) { this.pausedAt = now; this.running = false; } }
  resume(now = performance.now()) { if (!this.running) { this.pauseTotal += now - this.pausedAt; this.running = true; } }
  seconds(now = performance.now()) { const end = this.running ? now : this.pausedAt; return Math.max(0, (end - this.startedAt - this.pauseTotal) / 1000 + this.map.offset); }
  bpmAt(beat) { let bpm = this.map.bpm; for (const change of this.map.tempoChanges || []) if (beat >= change.beat) bpm = change.bpm; return bpm; }
  beatFloat(now) {
    const seconds = this.seconds(now); let elapsed = 0; let beat = 0; let bpm = this.map.bpm;
    for (const change of this.map.tempoChanges || []) {
      const segmentSeconds = (change.beat - beat) * 60 / bpm;
      if (seconds < elapsed + segmentSeconds) return beat + (seconds - elapsed) * bpm / 60;
      elapsed += segmentSeconds; beat = change.beat; bpm = change.bpm;
    }
    return beat + (seconds - elapsed) * bpm / 60;
  }
  beat(now) { return Math.floor(this.beatFloat(now)); }
  phase(now) { return this.beatFloat(now) % 1; }
  proximity(now, input = 'keyboard') {
    const latencyKey = input === 'touch' ? 'touchLatency' : 'keyboardLatency';
    const corrected = now - (this.settings[latencyKey] + this.settings.audioLatency + this.settings.displayLatency);
    const phase = this.phase(corrected); return Math.min(phase, 1 - phase);
  }
  judge(now, input, baseWindow) {
    const d = this.proximity(now, input); const w = baseWindow * this.settings.timingWindow;
    if (d <= w * .38) return { grade: 'PERFECT', value: 1, distance: d };
    if (d <= w) return { grade: 'GOOD', value: .65, distance: d };
    return { grade: 'OFF BEAT', value: 0, distance: d };
  }
}
