export class MusicEngine {
  constructor(settings) { this.settings = settings; this.context = null; this.master = null; this.fx = null; this.nextBeat = 0; this.timer = null; this.beat = 0; this.layers = 1; this.bpm = 128; this.remix = 0; }
  async unlock() {
    if (!this.context) {
      const AC = window.AudioContext || window.webkitAudioContext; this.context = new AC();
      this.master = this.context.createGain(); this.fx = this.context.createGain();
      this.master.gain.value = this.settings.musicVolume; this.fx.gain.value = this.settings.effectsVolume;
      this.master.connect(this.context.destination); this.fx.connect(this.context.destination);
    }
    if (this.context.state === 'suspended') await this.context.resume();
  }
  start(bpm = 128) { this.stop(); this.bpm = bpm; this.beat = 0; this.nextBeat = this.context.currentTime + .08; this.timer = setInterval(() => this.schedule(), 25); }
  schedule() { while (this.nextBeat < this.context.currentTime + .12) { this.playBeat(this.beat, this.nextBeat); this.nextBeat += 60 / this.bpm; this.beat++; } }
  tone(freq, time, duration, type = 'sine', volume = .06, destination = this.master) {
    if (!this.context) return; const o = this.context.createOscillator(), g = this.context.createGain(); o.type = type; o.frequency.setValueAtTime(freq, time); g.gain.setValueAtTime(.0001, time); g.gain.exponentialRampToValueAtTime(volume, time + .008); g.gain.exponentialRampToValueAtTime(.0001, time + duration); o.connect(g).connect(destination); o.start(time); o.stop(time + duration + .02);
  }
  playBeat(beat, time) {
    this.tone(beat % 4 === 0 ? 70 : 92, time, .11, 'sine', .09);
    if (this.settings.metronome) this.tone(beat % 4 === 0 ? 1050 : 800, time, .025, 'square', .018);
    if (this.layers >= 2 && beat % 2 === 0) this.tone([110,110,138.6,98][Math.floor(beat/4)%4], time, .3, 'triangle', .045);
    if (this.layers >= 3) this.tone([440,523.25,659.25,523.25][(beat + this.remix)%4], time, .15, 'sawtooth', .018);
    if (this.layers >= 4 && beat % 2) this.tone([880,1046.5,1318.5,1046.5][(beat + this.remix)%4], time, .07, 'square', .012);
  }
  effect(kind = 'pulse') { if (!this.context) return; const now = this.context.currentTime; if (kind === 'hit') this.tone(95, now, .22, 'sawtooth', .08, this.fx); else if (kind === 'pickup') { this.tone(523, now, .12, 'sine', .08, this.fx); this.tone(784, now + .08, .18, 'sine', .06, this.fx); } else this.tone(kind === 'perfect' ? 880 : 620, now, .12, 'triangle', .07, this.fx); }
  setLayers(n) { this.layers = Math.max(1, Math.min(4, n)); }
  setVolumes() { if (this.master) this.master.gain.value = this.settings.musicVolume; if (this.fx) this.fx.gain.value = this.settings.effectsVolume; }
  toggleMute() { if (!this.context) return true; const muted = this.master.gain.value > 0; this.master.gain.value = muted ? 0 : this.settings.musicVolume; this.fx.gain.value = muted ? 0 : this.settings.effectsVolume; return muted; }
  stop() { clearInterval(this.timer); this.timer = null; }
}
