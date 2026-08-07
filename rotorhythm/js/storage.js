import { DEFAULT_SETTINGS } from './config.js';

const SAVE_KEY = 'rotorhythm-save-v1';
const blankSave = { settings: DEFAULT_SETTINGS, bestScore: 0, bestAccuracy: 0, aircraft: ['Signal Wren'], trails: ['Neon Clef'], achievements: {}, ghost: [] };

export function loadSave() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}');
    return { ...blankSave, ...parsed, settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) } };
  } catch { return structuredClone(blankSave); }
}

export function writeSave(save) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
}

export function recordRun(save, stats) {
  const previous = save.bestScore;
  save.bestScore = Math.max(save.bestScore, stats.score);
  save.bestAccuracy = Math.max(save.bestAccuracy, stats.accuracy);
  save.ghost = stats.ghost.slice(-900);
  if (stats.combo >= 20) save.achievements.hotSignal = true;
  if (stats.accuracy >= 0.9) save.achievements.perfectCarrier = true;
  if (stats.distance >= 4000 && !save.aircraft.includes('Night Heron')) save.aircraft.push('Night Heron');
  writeSave(save);
  return stats.score > previous;
}
