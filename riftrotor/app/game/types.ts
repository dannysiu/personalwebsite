export type Dimension = "solar" | "void";
export type ControlMode = "keyboard" | "touchpad" | "mobile";

export type GameMode =
  | "story"
  | "endless"
  | "daily"
  | "expert"
  | "practice"
  | "training"
  | "boss"
  | "puzzle";

export type HudState = {
  dimension: Dimension;
  distance: number;
  score: number;
  phase: number;
  instability: number;
  solarFuel: number;
  voidFuel: number;
  multiplier: number;
  powerup: string;
  lives: number;
  status: "attract" | "playing" | "paused" | "over";
  warning: string;
  boss: number;
};

export type Settings = {
  controlMode: ControlMode;
  masterVolume: number;
  musicVolume: number;
  effectsVolume: number;
  reducedFlashing: boolean;
  reducedShake: boolean;
  gameSpeed: number;
  difficulty: "relaxed" | "standard" | "expert";
  riseKey: string;
  shiftKey: string;
};

export type RuntimeApi = {
  start: (mode: GameMode) => void;
  pause: (paused?: boolean) => void;
  restart: () => void;
  shift: () => void;
  setLift: (active: boolean) => void;
  rewind: () => void;
  setSettings: (settings: Settings) => void;
  destroy: () => void;
};
