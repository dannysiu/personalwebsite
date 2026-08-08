import type { GameMode } from "./types";

export const modes: Array<{
  id: GameMode;
  label: string;
  eyebrow: string;
  description: string;
  icon: string;
}> = [
  { id: "story", label: "Story Campaign", eyebrow: "ACT I · AWAKENING", description: "Five escalating sectors and dimensional bosses.", icon: "◈" },
  { id: "endless", label: "Endless Rift", eyebrow: "HIGH SCORE", description: "Procedural gates that accelerate forever.", icon: "∞" },
  { id: "daily", label: "Daily Seed", eyebrow: "SAME RIFT FOR ALL", description: "Today’s deterministic global route.", icon: "24" },
  { id: "expert", label: "One-Life Expert", eyebrow: "NO MERCY", description: "One hull, tighter gates, double scoring.", icon: "1" },
  { id: "practice", label: "Relaxed Practice", eyebrow: "FREE FLIGHT", description: "Gentle speed and forgiving collisions.", icon: "♡" },
  { id: "training", label: "Rewind Training", eyebrow: "LEARN THE LINE", description: "Hold R or tap rewind to undo mistakes.", icon: "↶" },
  { id: "boss", label: "Boss Rush", eyebrow: "WEAK POINTS", description: "Face dimension-split guardians back to back.", icon: "⌁" },
  { id: "puzzle", label: "Echo Puzzles", eyebrow: "DUAL PATH", description: "Coordinate your delayed echo to open gates.", icon: "⧉" },
];

export const powerups = [
  ["anchor", "Phase Anchor", "Blocks forced shifts"],
  ["chrono", "Chrono Bubble", "Slows the rift"],
  ["clone", "Echo Clone", "Adds a second echo"],
  ["drill", "Rift Drill", "Breaks one barrier"],
  ["merge", "Reality Merge", "Collects both worlds"],
  ["shield", "Phase Shield", "Absorbs one impact"],
  ["core", "Stability Core", "Resets instability"],
] as const;

export const defaultHud = {
  dimension: "solar" as const,
  distance: 0,
  score: 0,
  phase: 100,
  instability: 0,
  solarFuel: 100,
  voidFuel: 100,
  multiplier: 1,
  powerup: "NONE",
  lives: 3,
  status: "attract" as const,
  warning: "",
  boss: 0,
};
