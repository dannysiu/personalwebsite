import * as Phaser from "phaser";
import type { Dimension, GameMode, HudState, RuntimeApi, Settings } from "./types";
import { defaultHud, powerups } from "./gameData";

type Gate = { x: number; w: number; gapY: number; gap: number; dim: Dimension | "both"; passed: boolean; lock: boolean; pulse: number };
type Pickup = { x: number; y: number; dim: Dimension | "both"; kind: "phase" | "fuel" | "echo" | "power"; taken: boolean; seed: number };
type Drone = { x: number; y: number; baseY: number; dim: Dimension; phase: number; dead: boolean };
type TrailPoint = { y: number; at: number };
type Spark = { x: number; y: number; vx: number; vy: number; life: number; color: number };
type Snapshot = { y: number; vy: number; distance: number; score: number; phaseEnergy: number; instability: number; solarFuel: number; voidFuel: number; gates: Gate[]; pickups: Pickup[]; drones: Drone[] };

const W = 1280;
const H = 720;
const SOLAR = 0x6fffe9;
const SOLAR_DARK = 0x106f7b;
const GOLD = 0xf6c453;
const VOID = 0xff2e97;
const VOID_DARK = 0x50115f;
const VIOLET = 0x8b5cf6;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

function seeded(seed: number) {
  let value = seed || 1;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

class RiftScene extends Phaser.Scene {
  settings: Settings;
  onHud: (hud: HudState) => void;
  onEvent: (event: "shift" | "echo") => void;
  gfx!: Phaser.GameObjects.Graphics;
  fx!: Phaser.GameObjects.Graphics;
  dimension: Dimension = "solar";
  mode: GameMode = "story";
  status: HudState["status"] = "attract";
  y = H * 0.48;
  vy = 0;
  lift = false;
  distance = 0;
  score = 0;
  phaseEnergy = 100;
  instability = 0;
  solarFuel = 100;
  voidFuel = 100;
  multiplier = 1;
  lives = 3;
  speed = 230;
  elapsed = 0;
  lastShift = 0;
  invulnerable = 0;
  warning = "";
  warningTimer = 0;
  powerup = "NONE";
  powerTimer = 0;
  bossHealth = 0;
  bossPhase: Dimension = "void";
  bossTimer = 0;
  gates: Gate[] = [];
  pickups: Pickup[] = [];
  drones: Drone[] = [];
  trail: TrailPoint[] = [];
  replay: number[] = [];
  sparks: Spark[] = [];
  history: Snapshot[] = [];
  random = Math.random;
  lastSpawnX = 0;
  lastHud = 0;
  audio?: AudioContext;

  constructor(settings: Settings, onHud: (hud: HudState) => void, onEvent: (event: "shift" | "echo") => void) {
    super("rift");
    this.settings = settings;
    this.onHud = onHud;
    this.onEvent = onEvent;
  }

  create() {
    this.gfx = this.add.graphics();
    this.fx = this.add.graphics();
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (event.code === this.settings.riseKey || event.code === "KeyW" || event.code === "ArrowUp") this.lift = true;
      if ([this.settings.shiftKey, "KeyE", "ShiftRight"].includes(event.code)) this.shiftWorld();
      if (event.code === "Escape" && this.status !== "attract") this.togglePause();
      if (event.code === "KeyR" && this.mode === "training") this.rewind();
    });
    this.input.keyboard?.on("keyup", (event: KeyboardEvent) => {
      if (event.code === this.settings.riseKey || event.code === "KeyW" || event.code === "ArrowUp") this.lift = false;
    });
    this.seedWorld();
    this.emitHud(true);
  }

  setSettings(settings: Settings) { this.settings = settings; }

  start(mode: GameMode) {
    this.mode = mode;
    this.status = "playing";
    this.dimension = "solar";
    this.y = H * 0.5;
    this.vy = 0;
    this.distance = 0;
    this.score = 0;
    this.phaseEnergy = 100;
    this.instability = 0;
    this.solarFuel = 100;
    this.voidFuel = 100;
    this.multiplier = 1;
    this.lives = mode === "expert" ? 1 : mode === "practice" ? 9 : 3;
    this.speed = mode === "practice" ? 190 : mode === "boss" ? 270 : 220;
    this.elapsed = 0;
    this.invulnerable = 1.2;
    this.powerup = "NONE";
    this.powerTimer = 0;
    this.bossHealth = mode === "boss" ? 100 : 0;
    this.bossPhase = "void";
    this.gates = [];
    this.pickups = [];
    this.drones = [];
    this.trail = [];
    this.history = [];
    const daySeed = Number(new Date().toISOString().slice(0, 10).replaceAll("-", ""));
    this.random = mode === "daily" ? seeded(daySeed) : Math.random;
    this.lastSpawnX = W * 0.72;
    this.seedWorld();
    this.playTone(420, 0.08, "sine");
    this.emitHud(true);
  }

  restart() { this.start(this.mode); }

  togglePause(force?: boolean) {
    if (this.status === "over" || this.status === "attract") return;
    const pause = force ?? this.status !== "paused";
    this.status = pause ? "paused" : "playing";
    this.scene.isPaused();
    this.emitHud(true);
  }

  seedWorld() {
    while (this.lastSpawnX < W + 2200) this.spawnCluster();
  }

  spawnCluster() {
    const x = Math.max(this.lastSpawnX + 330 + this.random() * 170, W + 180);
    const difficulty = this.mode === "expert" ? 70 : this.mode === "practice" ? -40 : 0;
    const gap = clamp(230 - difficulty - this.distance * 0.004, 138, 270);
    const gapY = 170 + this.random() * (H - 340);
    const choice = this.random();
    const dim: Gate["dim"] = choice < 0.42 ? "solar" : choice < 0.84 ? "void" : "both";
    const lock = (this.mode === "puzzle" || this.distance > 700) && this.random() < 0.14;
    this.gates.push({ x, w: 54 + this.random() * 26, gapY, gap, dim, passed: false, lock, pulse: this.random() * 6.2 });
    if (this.random() < 0.72) {
      const kinds: Pickup["kind"][] = ["phase", "fuel", "echo", "power"];
      const kind = kinds[Math.floor(this.random() * kinds.length)];
      this.pickups.push({ x: x + 120, y: gapY + (this.random() - 0.5) * gap * 0.45, dim: kind === "echo" ? (dim === "solar" ? "void" : "solar") : dim === "both" ? "both" : dim, kind, taken: false, seed: this.random() });
    }
    if (this.random() < 0.34) this.drones.push({ x: x + 200, y: gapY, baseY: gapY, dim: this.random() > 0.5 ? "solar" : "void", phase: this.random() * 6.2, dead: false });
    this.lastSpawnX = x;
  }

  update(_: number, rawDelta: number) {
    const delta = Math.min(rawDelta / 1000, 0.04);
    if (this.status === "paused") { this.renderWorld(); return; }
    if (this.status === "attract" || this.status === "over") {
      this.elapsed += delta;
      if (this.status === "attract") this.y = H * 0.48 + Math.sin(this.elapsed * 1.4) * 45;
      this.driftWorld(delta * 0.28);
      this.renderWorld();
      return;
    }

    const timeScale = this.settings.gameSpeed * (this.powerup === "CHRONO BUBBLE" ? 0.62 : 1);
    const dt = delta * timeScale;
    this.elapsed += delta;
    this.lastShift += delta;
    this.invulnerable -= delta;
    this.warningTimer -= delta;
    if (this.warningTimer <= 0) this.warning = "";
    if (this.powerTimer > 0) {
      this.powerTimer -= delta;
      if (this.powerTimer <= 0) this.powerup = "NONE";
    }

    const fuel = this.dimension === "solar" ? this.solarFuel : this.voidFuel;
    const gravityFlip = Math.floor(this.distance / 760) % 5 === 3;
    const lifting = this.lift && fuel > 0;
    const liftForce = gravityFlip ? 850 : -850;
    const gravity = gravityFlip ? -420 : 420;
    this.vy += (lifting ? liftForce : gravity) * delta;
    this.vy *= Math.pow(0.992, rawDelta / 16.6);
    this.vy = clamp(this.vy, -430, 430);
    this.y += this.vy * delta;
    if (lifting) {
      if (this.dimension === "solar") this.solarFuel = Math.max(0, this.solarFuel - delta * 2.2);
      else this.voidFuel = Math.max(0, this.voidFuel - delta * 2.2);
    }

    const baseRamp = this.mode === "boss" ? 0 : Math.min(this.distance * 0.018, 160);
    const difficultySpeed = this.settings.difficulty === "expert" ? 1.13 : this.settings.difficulty === "relaxed" ? 0.86 : 1;
    this.speed = ((this.mode === "practice" ? 185 : 220) + baseRamp) * difficultySpeed;
    this.distance += this.speed * delta * 0.105;
    this.score += Math.floor(this.speed * delta * this.multiplier);
    this.phaseEnergy = Math.min(100, this.phaseEnergy + delta * 5.8);
    this.instability += delta * (this.mode === "practice" ? 2.4 : 4.3);
    if (this.instability > 74) this.setWarning("REALITY UNSTABLE — SHIFT ADVISED", 0.4);
    if (this.instability >= 100) {
      if (this.powerup === "PHASE ANCHOR") this.instability = 72;
      else { this.phaseEnergy = Math.max(this.phaseEnergy, 18); this.shiftWorld(true); }
    }

    this.driftWorld(dt);
    this.trail.push({ y: this.y, at: this.elapsed });
    this.trail = this.trail.filter((point) => this.elapsed - point.at < 5);
    if (Math.floor(this.elapsed * 6) !== Math.floor((this.elapsed - delta) * 6)) this.saveHistory();
    this.checkInteractions();

    if (this.y < 40 || this.y > H - 40) this.hit("BOUNDARY IMPACT");
    if (this.mode === "story" && this.distance > 1800 && this.bossHealth <= 0 && this.distance < 1830) this.beginBoss();
    if (this.mode === "boss" || this.bossHealth > 0) this.updateBoss(delta);

    this.renderWorld();
    this.emitHud();
  }

  driftWorld(dt: number) {
    const dx = this.speed * dt;
    this.gates.forEach((gate) => gate.x -= dx);
    this.pickups.forEach((pickup) => pickup.x -= dx);
    this.drones.forEach((drone) => { drone.x -= dx; drone.y = drone.baseY + Math.sin(this.elapsed * 2.2 + drone.phase) * 75; });
    this.lastSpawnX -= dx;
    this.gates = this.gates.filter((gate) => gate.x > -180);
    this.pickups = this.pickups.filter((pickup) => pickup.x > -100 && !pickup.taken);
    this.drones = this.drones.filter((drone) => drone.x > -140 && !drone.dead);
    while (this.lastSpawnX < W + 1800) this.spawnCluster();
    this.sparks.forEach((spark) => { spark.x += spark.vx * dt; spark.y += spark.vy * dt; spark.life -= dt; });
    this.sparks = this.sparks.filter((spark) => spark.life > 0);
  }

  echoY(delay = 1.25) {
    let point = this.trail[0];
    for (const item of this.trail) if (item.at <= this.elapsed - delay) point = item;
    return point?.y ?? this.y;
  }

  checkInteractions() {
    const playerX = 245;
    const echoY = this.echoY();
    for (const gate of this.gates) {
      const active = gate.dim === "both" || gate.dim === this.dimension;
      const inX = playerX + 30 > gate.x && playerX - 30 < gate.x + gate.w;
      const outsideGap = this.y < gate.gapY - gate.gap / 2 + 20 || this.y > gate.gapY + gate.gap / 2 - 20;
      if (active && inX && outsideGap && !gate.lock) {
        if (this.powerup === "RIFT DRILL") { gate.lock = true; this.powerup = "NONE"; this.burst(gate.x, this.y, GOLD); }
        else this.hit("HULL FRACTURE");
      }
      if (!gate.passed && gate.x + gate.w < playerX) {
        gate.passed = true;
        this.multiplier = Math.min(5, this.multiplier + 0.1);
        this.score += Math.floor(120 * this.multiplier);
      }
      if (gate.lock && Math.abs(gate.x - playerX) < 65 && Math.abs(echoY - gate.gapY) < 85) {
        gate.lock = false;
        this.onEvent("echo");
        this.score += 400;
        this.burst(gate.x, echoY, SOLAR);
        this.setWarning("ECHO SYNC — DOOR OPEN", 1.3);
      }
    }

    for (const pickup of this.pickups) {
      const presentCanTake = pickup.dim === "both" || pickup.dim === this.dimension || this.powerup === "REALITY MERGE";
      const playerHit = presentCanTake && Math.hypot(pickup.x - playerX, pickup.y - this.y) < 42;
      const echoCanTake = pickup.kind === "echo" && pickup.dim !== this.dimension && Math.hypot(pickup.x - playerX, pickup.y - echoY) < 44;
      if (playerHit || echoCanTake) this.collect(pickup, echoCanTake);
    }

    for (const drone of this.drones) {
      if (drone.dim === this.dimension && Math.hypot(drone.x - playerX, drone.y - this.y) < 52) this.hit("HOSTILE CONTACT");
      if (drone.dim !== this.dimension && Math.hypot(drone.x - playerX, drone.y - echoY) < 70) {
        drone.baseY += echoY > drone.y ? -35 : 35;
      }
    }
  }

  collect(pickup: Pickup, echo: boolean) {
    pickup.taken = true;
    if (pickup.kind === "phase") this.phaseEnergy = Math.min(100, this.phaseEnergy + 32);
    if (pickup.kind === "fuel") {
      if (pickup.dim === "solar") this.solarFuel = Math.min(100, this.solarFuel + 38);
      else if (pickup.dim === "void") this.voidFuel = Math.min(100, this.voidFuel + 38);
      else { this.solarFuel = Math.min(100, this.solarFuel + 22); this.voidFuel = Math.min(100, this.voidFuel + 22); }
    }
    if (pickup.kind === "echo") { this.onEvent("echo"); this.score += echo ? 650 : 350; this.setWarning(echo ? "ECHO RELIC RECOVERED" : "RESONANCE CAPTURED", 1.1); }
    if (pickup.kind === "power") this.activatePower(Math.floor(pickup.seed * powerups.length));
    this.score += 180;
    this.burst(pickup.x, pickup.y, pickup.dim === "void" ? VOID : SOLAR);
    this.playTone(echo ? 760 : 620, 0.06, "triangle");
  }

  activatePower(index: number) {
    const item = powerups[index % powerups.length];
    this.powerup = item[1].toUpperCase();
    this.powerTimer = ["RIFT DRILL", "PHASE SHIELD", "STABILITY CORE"].includes(this.powerup) ? 99 : 8;
    if (this.powerup === "STABILITY CORE") { this.instability = 0; this.powerTimer = 1.2; }
    this.setWarning(`${this.powerup} ONLINE`, 1.4);
  }

  hit(message: string) {
    if (this.invulnerable > 0) return;
    if (this.powerup === "PHASE SHIELD") { this.powerup = "NONE"; this.invulnerable = 1; this.burst(245, this.y, SOLAR); return; }
    if (this.mode === "practice") { this.y = clamp(this.y, 90, H - 90); this.vy *= -0.4; this.invulnerable = 1; this.setWarning("PRACTICE SHIELD", 0.8); return; }
    this.lives -= 1;
    this.multiplier = 1;
    this.invulnerable = 1.7;
    this.y = H * 0.5;
    this.vy = 0;
    this.burst(245, this.y, VOID);
    this.setWarning(message, 1.2);
    this.playTone(95, 0.14, "sawtooth");
    if (this.lives <= 0) this.endGame();
  }

  endGame() {
    this.status = "over";
    this.lift = false;
    try {
      const stats = JSON.parse(localStorage.getItem("rift-rotor-stats-v1") || "{}");
      stats.best = Math.max(stats.best || 0, Math.floor(this.distance));
      localStorage.setItem("rift-rotor-stats-v1", JSON.stringify(stats));
      localStorage.setItem("rift-rotor-replay-v1", JSON.stringify(this.trail.slice(-240).map((p) => Math.round(p.y))));
    } catch { /* storage is optional */ }
    this.emitHud(true);
  }

  shiftWorld(forced = false) {
    if (this.status !== "playing" || (!forced && (this.phaseEnergy < 18 || this.lastShift < 0.2))) return;
    this.dimension = this.dimension === "solar" ? "void" : "solar";
    this.phaseEnergy = Math.max(0, this.phaseEnergy - (forced ? 8 : 18));
    this.instability = forced ? 42 : Math.max(0, this.instability - 58);
    this.lastShift = 0;
    this.onEvent("shift");
    this.burst(245, this.y, this.dimension === "solar" ? SOLAR : VOID, 22);
    this.playTone(this.dimension === "solar" ? 520 : 210, 0.09, "square");
    if (this.bossHealth > 0 && this.dimension === this.bossPhase) {
      this.bossHealth = Math.max(0, this.bossHealth - 12);
      this.bossPhase = this.bossPhase === "solar" ? "void" : "solar";
      this.score += 750;
      this.setWarning("WEAK POINT STRUCK", 0.8);
      if (this.bossHealth <= 0) { this.score += 5000; this.setWarning("RIFT SERPENT NEUTRALIZED", 2); }
    }
    this.emitHud(true);
  }

  beginBoss() { this.bossHealth = 100; this.bossPhase = "void"; this.setWarning("BOSS SIGNAL — TWIN-WORLD SERPENT", 2); }

  updateBoss(delta: number) {
    if (this.bossHealth <= 0) return;
    this.bossTimer += delta;
    if (Math.floor(this.bossTimer) !== Math.floor(this.bossTimer - delta) && Math.floor(this.bossTimer) % 4 === 0) {
      this.drones.push({ x: W - 150, y: 110 + this.random() * 500, baseY: 110 + this.random() * 500, dim: this.bossPhase, phase: this.random() * 6, dead: false });
      this.setWarning(`${this.bossPhase.toUpperCase()} WEAK POINT EXPOSED`, 1.1);
    }
  }

  rewind() {
    if (this.mode !== "training" || this.history.length < 8) return;
    const snapshot = this.history[Math.max(0, this.history.length - 12)];
    Object.assign(this, copy(snapshot));
    this.history = this.history.slice(0, Math.max(1, this.history.length - 12));
    this.invulnerable = 1;
    this.setWarning("TIMELINE REWOUND 2.0s", 1);
    this.playTone(180, 0.1, "sine");
  }

  saveHistory() {
    this.history.push(copy({ y: this.y, vy: this.vy, distance: this.distance, score: this.score, phaseEnergy: this.phaseEnergy, instability: this.instability, solarFuel: this.solarFuel, voidFuel: this.voidFuel, gates: this.gates, pickups: this.pickups, drones: this.drones }));
    if (this.history.length > 50) this.history.shift();
  }

  setWarning(text: string, duration: number) { this.warning = text; this.warningTimer = duration; }

  burst(x: number, y: number, color: number, count = 12) {
    for (let i = 0; i < count; i++) {
      const angle = this.random() * Math.PI * 2;
      const speed = 70 + this.random() * 220;
      this.sparks.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.25 + this.random() * 0.6, color });
    }
  }

  playTone(freq: number, duration: number, type: OscillatorType) {
    if (this.settings.masterVolume <= 0 || this.settings.effectsVolume <= 0) return;
    try {
      this.audio ??= new AudioContext();
      const oscillator = this.audio.createOscillator();
      const gain = this.audio.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(freq, this.audio.currentTime);
      gain.gain.setValueAtTime((this.settings.masterVolume / 100) * (this.settings.effectsVolume / 100) * 0.06, this.audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audio.currentTime + duration);
      oscillator.connect(gain).connect(this.audio.destination);
      oscillator.start(); oscillator.stop(this.audio.currentTime + duration);
    } catch { /* autoplay policies may defer audio */ }
  }

  renderWorld() {
    const g = this.gfx;
    g.clear();
    const solar = this.dimension === "solar";
    const bg = solar ? 0x081c28 : 0x100619;
    g.fillStyle(bg, 1).fillRect(0, 0, W, H);
    this.drawBackdrop(g, solar);
    for (const gate of this.gates) this.drawGate(g, gate);
    for (const pickup of this.pickups) this.drawPickup(g, pickup);
    for (const drone of this.drones) this.drawDrone(g, drone);
    if (this.bossHealth > 0) this.drawBoss(g);
    this.drawEcho(g, this.echoY(), 0.2);
    if (this.powerup === "ECHO CLONE") this.drawEcho(g, this.echoY(2.1), 0.12);
    this.drawHeli(g, 245, this.y, solar ? SOLAR : VOID, false);
    this.drawFx();
  }

  drawBackdrop(g: Phaser.GameObjects.Graphics, solar: boolean) {
    const base = solar ? SOLAR_DARK : VOID_DARK;
    const accent = solar ? SOLAR : VOID;
    const scroll = (this.distance * 3.4) % 240;
    g.fillStyle(base, 0.28);
    for (let i = -1; i < 7; i++) {
      const x = i * 240 - scroll;
      const h = 120 + ((i * 91 + 300) % 190);
      g.fillRect(x, H - h, 150, h);
      g.fillStyle(accent, 0.18);
      for (let y = H - h + 25; y < H - 30; y += 38) g.fillRect(x + 20, y, 14, 7);
      g.fillStyle(base, 0.28);
    }
    g.lineStyle(1, accent, 0.11);
    for (let y = 80; y < H; y += 80) g.lineBetween(0, y, W, y);
    for (let x = -scroll % 80; x < W; x += 80) g.lineBetween(x, 0, x, H);
    g.fillStyle(accent, 0.75);
    for (let i = 0; i < 26; i++) {
      const x = (i * 173 - this.distance * (8 + (i % 3))) % (W + 40);
      const y = (i * 97) % H;
      g.fillRect(x, y, i % 4 === 0 ? 8 : 3, 2);
    }
    g.fillStyle(0x03050b, 0.76).fillRect(0, 0, W, 44).fillRect(0, H - 28, W, 28);
  }

  drawGate(g: Phaser.GameObjects.Graphics, gate: Gate) {
    const active = gate.dim === "both" || gate.dim === this.dimension;
    const color = gate.dim === "void" ? VOID : gate.dim === "solar" ? SOLAR : GOLD;
    const topH = gate.gapY - gate.gap / 2;
    const bottomY = gate.gapY + gate.gap / 2;
    const alpha = active ? 0.95 : 0.12;
    g.fillStyle(color, alpha).fillRect(gate.x, 0, gate.w, topH).fillRect(gate.x, bottomY, gate.w, H - bottomY);
    g.fillStyle(0x050812, active ? 0.82 : 0.08);
    for (let y = 20; y < topH; y += 34) g.fillRect(gate.x + 10, y, gate.w - 20, 12);
    for (let y = bottomY + 20; y < H; y += 34) g.fillRect(gate.x + 10, y, gate.w - 20, 12);
    g.lineStyle(active ? 4 : 2, color, active ? 1 : 0.35).strokeRect(gate.x, 0, gate.w, topH).strokeRect(gate.x, bottomY, gate.w, H - bottomY);
    if (gate.lock) {
      const pulse = 0.5 + Math.sin(this.elapsed * 6 + gate.pulse) * 0.25;
      g.fillStyle(0x080a14, 0.95).fillRoundedRect(gate.x - 12, gate.gapY - 34, gate.w + 24, 68, 8);
      g.lineStyle(3, SOLAR, pulse).strokeRoundedRect(gate.x - 12, gate.gapY - 34, gate.w + 24, 68, 8);
      g.fillStyle(SOLAR, pulse).fillRect(gate.x + gate.w / 2 - 4, gate.gapY - 17, 8, 34);
    }
  }

  drawPickup(g: Phaser.GameObjects.Graphics, pickup: Pickup) {
    const active = pickup.dim === "both" || pickup.dim === this.dimension || this.powerup === "REALITY MERGE";
    const color = pickup.dim === "void" ? VOID : pickup.dim === "solar" ? SOLAR : GOLD;
    const r = pickup.kind === "power" ? 17 : 12;
    g.lineStyle(active ? 4 : 2, color, active ? 0.95 : 0.18).strokeCircle(pickup.x, pickup.y, r + Math.sin(this.elapsed * 5 + pickup.seed) * 3);
    g.fillStyle(color, active ? 0.9 : 0.12);
    if (pickup.kind === "echo") g.fillTriangle(pickup.x, pickup.y - r, pickup.x + r, pickup.y + r, pickup.x - r, pickup.y + r);
    else if (pickup.kind === "fuel") g.fillRoundedRect(pickup.x - 8, pickup.y - 12, 16, 24, 3);
    else g.fillCircle(pickup.x, pickup.y, r * 0.48);
  }

  drawDrone(g: Phaser.GameObjects.Graphics, drone: Drone) {
    const active = drone.dim === this.dimension;
    const color = drone.dim === "solar" ? SOLAR : VOID;
    g.fillStyle(color, active ? 0.9 : 0.12).fillTriangle(drone.x - 24, drone.y, drone.x + 18, drone.y - 16, drone.x + 18, drone.y + 16);
    g.lineStyle(3, color, active ? 0.95 : 0.2).strokeCircle(drone.x, drone.y, 28);
    g.fillStyle(GOLD, active ? 1 : 0.15).fillCircle(drone.x + 5, drone.y, 5);
  }

  drawHeli(g: Phaser.GameObjects.Graphics, x: number, y: number, color: number, ghost: boolean) {
    const alpha = ghost ? 0.24 : this.invulnerable > 0 && Math.floor(this.elapsed * 12) % 2 === 0 ? 0.35 : 1;
    g.fillStyle(0x050812, alpha).fillRoundedRect(x - 30, y - 15, 62, 31, 8);
    g.fillStyle(color, alpha).fillTriangle(x + 4, y - 14, x + 37, y, x + 4, y + 14).fillRect(x - 57, y - 4, 31, 8).fillCircle(x - 38, y, 9);
    g.fillStyle(GOLD, alpha).fillCircle(x + 28, y, 6);
    g.lineStyle(4, color, alpha).lineBetween(x - 36, y - 24, x + 28, y - 24).lineBetween(x - 2, y - 17, x - 2, y - 25);
    g.lineStyle(3, color, alpha).lineBetween(x - 16, y + 19, x + 18, y + 19).lineBetween(x - 8, y + 14, x - 14, y + 19).lineBetween(x + 12, y + 14, x + 18, y + 19);
  }

  drawEcho(g: Phaser.GameObjects.Graphics, y: number, alpha: number) {
    const color = this.dimension === "solar" ? VOID : SOLAR;
    g.lineStyle(2, color, alpha);
    const points = this.trail.filter((_, index) => index % 4 === 0).slice(-60);
    for (let i = 1; i < points.length; i++) g.lineBetween(245 - (points.length - i) * 4, points[i - 1].y, 245 - (points.length - i - 1) * 4, points[i].y);
    this.drawHeli(g, 245, y, color, true);
  }

  drawBoss(g: Phaser.GameObjects.Graphics) {
    const color = this.bossPhase === "solar" ? SOLAR : VOID;
    const headX = W - 115;
    const headY = H * 0.5 + Math.sin(this.bossTimer * 1.3) * 185;
    g.lineStyle(28, color, 0.45);
    let lastX = headX;
    let lastY = headY;
    for (let i = 1; i < 7; i++) {
      const x = headX + i * 65;
      const y = H * 0.5 + Math.sin(this.bossTimer * 1.3 - i * 0.72) * 185;
      g.lineBetween(lastX, lastY, x, y); lastX = x; lastY = y;
    }
    g.fillStyle(0x050812, 1).fillTriangle(headX - 58, headY, headX + 35, headY - 45, headX + 35, headY + 45);
    g.lineStyle(5, color, 1).strokeCircle(headX, headY, 48);
    g.fillStyle(GOLD, 1).fillCircle(headX - 14, headY, 10);
  }

  drawFx() {
    const g = this.fx;
    g.clear();
    for (const spark of this.sparks) g.fillStyle(spark.color, clamp(spark.life * 2, 0, 1)).fillRect(spark.x, spark.y, 3 + spark.life * 7, 3);
    if (this.lastShift < 0.18 && !this.settings.reducedFlashing) {
      const color = this.dimension === "solar" ? SOLAR : VOID;
      g.fillStyle(color, (0.18 - this.lastShift) * 1.7).fillRect(0, 0, W, H);
      for (let i = 0; i < 9; i++) g.fillStyle(i % 2 ? SOLAR : VOID, 0.12).fillRect((i * 149 + this.elapsed * 900) % W, 0, 9 + i * 3, H);
    }
    if (this.bossHealth > 0) {
      g.fillStyle(0x050812, 0.85).fillRoundedRect(W / 2 - 190, 55, 380, 28, 6);
      g.fillStyle(this.bossPhase === "solar" ? SOLAR : VOID, 1).fillRoundedRect(W / 2 - 184, 61, 368 * this.bossHealth / 100, 16, 4);
    }
  }

  emitHud(force = false) {
    if (!force && this.elapsed - this.lastHud < 0.08) return;
    this.lastHud = this.elapsed;
    this.onHud({ dimension: this.dimension, distance: Math.floor(this.distance), score: Math.floor(this.score), phase: this.phaseEnergy, instability: this.instability, solarFuel: this.solarFuel, voidFuel: this.voidFuel, multiplier: this.multiplier, powerup: this.powerup, lives: this.lives, status: this.status, warning: this.warning, boss: this.bossHealth });
  }
}

export function createRiftGame(parent: HTMLElement, settings: Settings, onHud: (hud: HudState) => void, onEvent: (event: "shift" | "echo") => void): RuntimeApi {
  const scene = new RiftScene(settings, onHud, onEvent);
  const game = new Phaser.Game({
    type: Phaser.CANVAS,
    width: W,
    height: H,
    parent,
    backgroundColor: "#070a12",
    transparent: false,
    antialias: false,
    pixelArt: true,
    banner: false,
    input: { activePointers: 4 },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene,
    audio: { noAudio: true },
  });
  return {
    start: (mode) => scene.start(mode),
    pause: (paused) => scene.togglePause(paused),
    restart: () => scene.restart(),
    shift: () => scene.shiftWorld(),
    setLift: (active) => { scene.lift = active; },
    rewind: () => scene.rewind(),
    setSettings: (next) => scene.setSettings(next),
    destroy: () => game.destroy(true),
  };
}
