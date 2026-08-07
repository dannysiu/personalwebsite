export const DISTRICTS = [
  { id: 'synthwave', name: 'Synthwave Skyline', sky: [0x100d33, 0x3b155d], accent: 0x31f3e3, hazard: 0xff3dac, style: 'city' },
  { id: 'jazz', name: 'Jazz Rooftop District', sky: [0x141126, 0x54243d], accent: 0xffd166, hazard: 0xf77f58, style: 'rooftop' },
  { id: 'factory', name: 'Electronic Factory', sky: [0x071e2c, 0x133d4b], accent: 0x38f29b, hazard: 0xffbe33, style: 'factory' },
  { id: 'storm', name: 'Orchestral Thunderstorm', sky: [0x0c1028, 0x293663], accent: 0xd9dcff, hazard: 0xa985ff, style: 'storm' },
  { id: 'lofi', name: 'Lo-Fi Cloud Garden', sky: [0x26335b, 0xb06f99], accent: 0xb8f2df, hazard: 0xffb4a2, style: 'garden' },
  { id: 'volcano', name: 'Percussion Volcano', sky: [0x1b0a13, 0x571522], accent: 0xffb000, hazard: 0xff375f, style: 'volcano' }
];

export const MODES = {
  campaign: { duration: 128, speed: 255, damage: true, lives: 3, window: 0.13, label: 'Music campaign' },
  endless: { duration: Infinity, speed: 270, damage: true, lives: 3, window: 0.12, label: 'Endless Mix' },
  daily: { duration: 96, speed: 280, damage: true, lives: 2, window: 0.11, label: 'Daily challenge' },
  practice: { duration: 90, speed: 220, damage: false, lives: 99, window: 0.18, label: 'Practice mode' },
  nofail: { duration: 90, speed: 210, damage: false, lives: 99, window: 0.2, label: 'No-fail visualizer' },
  expert: { duration: 90, speed: 310, damage: true, lives: 1, window: 0.075, label: 'Expert one-life' },
  boss: { duration: 75, speed: 285, damage: true, lives: 3, window: 0.105, label: 'Boss rush' },
  accuracy: { duration: 80, speed: 245, damage: false, lives: 99, window: 0.08, label: 'Accuracy challenge' },
  relaxed: { duration: 110, speed: 185, damage: false, lives: 99, window: 0.24, label: 'Relaxed flight' }
};

export const FALLBACK_BEATMAP = {
  id: 'neon-airwaves', title: 'Neon Airwaves', artist: 'Rotorhythm Signal Lab', bpm: 128, beatsPerMeasure: 4,
  duration: 128, offset: 0.08,
  tempoChanges: [{ beat: 192, bpm: 136 }, { beat: 256, bpm: 128 }],
  sections: [
    { beat: 0, name: 'Ignition', district: 'synthwave', layer: 0 },
    { beat: 32, name: 'Night Drive', district: 'jazz', layer: 1 },
    { beat: 64, name: 'Assembly', district: 'factory', layer: 2 },
    { beat: 96, name: 'Overture', district: 'storm', layer: 2 },
    { beat: 128, name: 'Cloudbreak', district: 'lofi', layer: 3 },
    { beat: 160, name: 'Eruption', district: 'volcano', layer: 3 }
  ],
  events: [
    { beat: 8, type: 'pickup', power: 'Bass Shield' }, { beat: 24, type: 'remix' },
    { beat: 48, type: 'switch' }, { beat: 72, type: 'pickup', power: 'Perfect Pitch' },
    { beat: 96, type: 'environment', action: 'lightning' }, { beat: 120, type: 'pickup', power: 'Echo Wave' },
    { beat: 144, type: 'remix' }, { beat: 176, type: 'boss', boss: 'The Resonator' }
  ]
};

export const DEFAULT_SETTINGS = {
  controlMode: matchMedia('(pointer: coarse)').matches ? 'mobile' : 'keyboard',
  musicVolume: 0.68, effectsVolume: 0.78, audioLatency: 0, displayLatency: 0,
  keyboardLatency: 0, touchLatency: 0, visualIntensity: 0.8, timingWindow: 1,
  beatIndicators: true, metronome: false, vibration: true, reducedMotion: false,
  reducedFlashing: false, photoSafe: false, highContrast: false, screenShake: 0.65,
  difficulty: 'normal'
};

export const POWERUPS = ['Bass Shield', 'Tempo Slowdown', 'Perfect Pitch', 'Echo Wave', 'Solo Mode', 'Combo Lock', 'Remix Token'];
