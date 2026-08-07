"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { defaultHud, modes, powerups } from "./gameData";
import type { GameMode, HudState, RuntimeApi, Settings } from "./types";

const SETTINGS_KEY = "rift-rotor-settings-v1";
const STATS_KEY = "rift-rotor-stats-v1";

const defaults: Settings = {
  controlMode: "keyboard",
  masterVolume: 70,
  musicVolume: 40,
  effectsVolume: 80,
  reducedFlashing: false,
  reducedShake: false,
  gameSpeed: 1,
  difficulty: "standard",
  riseKey: "Space",
  shiftKey: "ShiftLeft",
};

type StoredStats = { flights: number; best: number; shifts: number; echoes: number };

const loadJson = <T,>(key: string, fallback: T): T => {
  if (typeof window === "undefined") return fallback;
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(key) || "{}") };
  } catch {
    return fallback;
  }
};

const KeyCap = ({ children }: { children: React.ReactNode }) => <span className="keycap">{children}</span>;

function Meter({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="meter" aria-label={`${label}: ${Math.round(value)} percent`}>
      <div className="meter-row"><span>{label}</span><b>{Math.round(value)}</b></div>
      <div className="meter-track"><i style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: tone }} /></div>
    </div>
  );
}

function IconButton({ label, children, onClick }: { label: string; children: React.ReactNode; onClick: () => void }) {
  return <button className="icon-button" aria-label={label} title={label} onClick={onClick}>{children}</button>;
}

export default function GameApp() {
  const mountRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<RuntimeApi | null>(null);
  const settingsRef = useRef(defaults);
  const [hud, setHud] = useState<HudState>(defaultHud);
  const [settings, setSettingsState] = useState<Settings>(defaults);
  const [screen, setScreen] = useState<"menu" | "mode" | "settings" | "achievements" | "none">("menu");
  const [activeMode, setActiveMode] = useState<GameMode>("story");
  const [tutorial, setTutorial] = useState(0);
  const [stats, setStats] = useState<StoredStats>({ flights: 0, best: 0, shifts: 0, echoes: 0 });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const savedSettings = loadJson(SETTINGS_KEY, defaults);
    settingsRef.current = savedSettings;
    setSettingsState(savedSettings);
    setStats(loadJson(STATS_KEY, { flights: 0, best: 0, shifts: 0, echoes: 0 }));
  }, []);

  useEffect(() => {
    if (!mountRef.current) return;
    let cancelled = false;
    import("./runtime").then(({ createRiftGame }) => {
      if (cancelled || !mountRef.current) return;
      runtimeRef.current = createRiftGame(mountRef.current, settingsRef.current, (next) => {
        setHud(next);
        if (next.status === "over") setScreen("none");
        if (next.status === "paused") setScreen("settings");
        if (next.status === "playing") setScreen((current) => current === "settings" ? "none" : current);
      }, (event) => {
        if (event === "shift") setStats((old) => ({ ...old, shifts: old.shifts + 1 }));
        if (event === "echo") setStats((old) => ({ ...old, echoes: old.echoes + 1 }));
      });
      setReady(true);
    });
    return () => {
      cancelled = true;
      runtimeRef.current?.destroy();
      runtimeRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    settingsRef.current = settings;
    runtimeRef.current?.setSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  }, [stats]);

  const patchSettings = useCallback((patch: Partial<Settings>) => {
    setSettingsState((old) => ({ ...old, ...patch }));
  }, []);

  const start = (mode: GameMode) => {
    setActiveMode(mode);
    setScreen("none");
    setTutorial(stats.flights === 0 ? 1 : 0);
    setStats((old) => ({ ...old, flights: old.flights + 1 }));
    runtimeRef.current?.start(mode);
  };

  const pause = () => {
    const willPause = hud.status !== "paused";
    runtimeRef.current?.pause(willPause);
    setScreen(willPause ? "settings" : "none");
  };

  const restart = () => {
    setScreen("none");
    runtimeRef.current?.restart();
  };

  const returnToMenu = () => {
    runtimeRef.current?.pause(true);
    setScreen("menu");
  };

  const pointerLift = (active: boolean) => {
    if (hud.status === "playing") runtimeRef.current?.setLift(active);
  };

  const shift = (event?: React.SyntheticEvent) => {
    event?.stopPropagation();
    runtimeRef.current?.shift();
  };

  const fullscreen = async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch { /* browser may block programmatic fullscreen */ }
  };

  const activeModeInfo = modes.find((mode) => mode.id === activeMode)!;
  const dimensionLabel = hud.dimension === "solar" ? "SOLAR" : "VOID";

  return (
    <main className={`app-shell world-${hud.dimension} ${settings.reducedFlashing ? "reduced-flashing" : ""}`}>
      <div className="scanlines" aria-hidden="true" />
      <header className="topbar">
        <button className="brand" onClick={returnToMenu} aria-label="Rift Rotor main menu">
          <span className="brand-mark"><i /><i /></span>
          <span><b>RIFT ROTOR</b><small>TWO WORLDS · ONE FLIGHT</small></span>
        </button>
        <div className="mission-pill"><span className="signal-dot" /> {activeModeInfo.label.toUpperCase()} <em>01</em></div>
        <nav className="top-actions" aria-label="Game actions">
          <IconButton label="Achievements" onClick={() => { runtimeRef.current?.pause(true); setScreen("achievements"); }}>⌂</IconButton>
          <IconButton label="Toggle fullscreen" onClick={fullscreen}>⛶</IconButton>
          <IconButton label="Settings and pause" onClick={pause}>Ⅱ</IconButton>
        </nav>
      </header>

      <section className="game-deck" aria-label="Rift Rotor game">
        <div className="hud-top">
          <div className={`dimension-chip ${hud.dimension}`}><span>{hud.dimension === "solar" ? "✦" : "◆"}</span>{dimensionLabel} WORLD</div>
          <div className="score-block"><small>DISTANCE</small><b>{String(hud.distance).padStart(5, "0")}<em>m</em></b></div>
          <div className="score-block"><small>RIFT SCORE</small><b>{hud.score.toLocaleString()}</b></div>
          <div className="multiplier">×{hud.multiplier.toFixed(1)}</div>
        </div>

        <div
          className="game-frame"
          onPointerDown={(event) => { if ((event.target as HTMLElement).closest("button")) return; event.currentTarget.setPointerCapture(event.pointerId); pointerLift(true); }}
          onPointerUp={() => pointerLift(false)}
          onPointerCancel={() => pointerLift(false)}
          onContextMenu={(event) => { event.preventDefault(); shift(event); }}
        >
          <div ref={mountRef} className="phaser-mount" />
          {!ready && <div className="loading"><span className="loader-ring" />CALIBRATING DIMENSIONS</div>}

          <div className="corner corner-tl" /><div className="corner corner-tr" />
          <div className="corner corner-bl" /><div className="corner corner-br" />

          {hud.warning && screen === "none" && <div className="rift-warning">⚠ {hud.warning}</div>}

          {tutorial > 0 && screen === "none" && (
            <div className="tutorial-card" role="dialog" aria-label="Flight tutorial">
              <small>FLIGHT SCHOOL // {tutorial} OF 3</small>
              <b>{tutorial === 1 ? "HOLD TO RISE" : tutorial === 2 ? "SHIFT BETWEEN WORLDS" : "FOLLOW YOUR ECHO"}</b>
              <p>{tutorial === 1 ? "Hold Space, W, ↑, or the flight area. Release to descend." : tutorial === 2 ? "Solar and Void have different walls. Shift before the gate reaches you." : "Your delayed flight path exists in the other world and can trigger cyan echo switches."}</p>
              <button onPointerDown={(e) => e.stopPropagation()} onClick={() => setTutorial((step) => step === 3 ? 0 : step + 1)}>{tutorial === 3 ? "ENTER THE RIFT" : "NEXT"}</button>
            </div>
          )}

          {screen === "menu" && (
            <div className="menu-overlay title-menu">
              <div className="title-kicker"><i /> DIMENSIONAL FLIGHT SYSTEM // ONLINE</div>
              <h1><span>RIFT</span> ROTOR</h1>
              <p className="tagline">TWO WORLDS. <b>ONE FLIGHT.</b></p>
              <p className="intro">Hold to rise. Release to fall. Phase between overlapping realities before either one tears you apart.</p>
              <div className="primary-actions">
                <button className="play-button" onClick={() => start("story")} disabled={!ready}><span>▶</span><b>BEGIN CAMPAIGN</b><small>CONTINUE: THE FIRST FRACTURE</small></button>
                <button className="square-action" onClick={() => setScreen("mode")}><span>◈</span><b>SELECT MODE</b></button>
              </div>
              <button className="text-action" onClick={() => setScreen("settings")}>⚙ CONTROL & ACCESSIBILITY</button>
              <div className="menu-stats"><span>BEST RIFT <b>{stats.best.toLocaleString()}</b></span><span>FLIGHTS <b>{stats.flights}</b></span><span>SHIFTS <b>{stats.shifts}</b></span></div>
            </div>
          )}

          {screen === "mode" && (
            <div className="menu-overlay panel-overlay">
              <div className="panel-heading"><div><small>MISSION ARCHIVE</small><h2>SELECT FLIGHT MODE</h2></div><button onClick={() => setScreen("menu")}>×</button></div>
              <div className="mode-grid">
                {modes.map((mode) => <button key={mode.id} className="mode-card" onClick={() => start(mode.id)}><span className="mode-icon">{mode.icon}</span><small>{mode.eyebrow}</small><b>{mode.label}</b><p>{mode.description}</p></button>)}
              </div>
            </div>
          )}

          {screen === "settings" && (
            <div className="menu-overlay panel-overlay settings-overlay">
              <div className="panel-heading"><div><small>SYSTEM CONFIGURATION</small><h2>{hud.status === "playing" || hud.status === "paused" ? "FLIGHT PAUSED" : "SETTINGS"}</h2></div><button onClick={() => { if (hud.status === "paused") runtimeRef.current?.pause(false); setScreen(hud.status === "paused" ? "none" : "menu"); }}>×</button></div>
              <div className="settings-grid">
                <section><h3>CONTROL PROFILE</h3><div className="segmented">{(["keyboard", "touchpad", "mobile"] as const).map((mode) => <button key={mode} className={settings.controlMode === mode ? "active" : ""} onClick={() => patchSettings({ controlMode: mode })}>{mode === "keyboard" ? "KEY + MOUSE" : mode.toUpperCase()}</button>)}</div><label>RISE KEY <button className="bind-button" onKeyDown={(e) => { e.preventDefault(); patchSettings({ riseKey: e.code }); }}>{settings.riseKey}</button></label><label>SHIFT KEY <button className="bind-button" onKeyDown={(e) => { e.preventDefault(); patchSettings({ shiftKey: e.code }); }}>{settings.shiftKey}</button></label><label>DIFFICULTY <select value={settings.difficulty} onChange={(e) => patchSettings({ difficulty: e.target.value as Settings["difficulty"] })}><option value="relaxed">Relaxed</option><option value="standard">Standard</option><option value="expert">Expert</option></select></label><label>GAME SPEED <input type="range" min="0.7" max="1.3" step="0.1" value={settings.gameSpeed} onChange={(e) => patchSettings({ gameSpeed: Number(e.target.value) })} /><output>{settings.gameSpeed.toFixed(1)}×</output></label></section>
                <section><h3>AUDIO & ACCESSIBILITY</h3>{(["masterVolume", "musicVolume", "effectsVolume"] as const).map((key) => <label key={key}>{key.replace("Volume", "").toUpperCase()} <input type="range" min="0" max="100" value={settings[key]} onChange={(e) => patchSettings({ [key]: Number(e.target.value) })} /><output>{settings[key]}</output></label>)}<label className="toggle"><input type="checkbox" checked={settings.reducedFlashing} onChange={(e) => patchSettings({ reducedFlashing: e.target.checked })} /><i /> REDUCED FLASHING</label><label className="toggle"><input type="checkbox" checked={settings.reducedShake} onChange={(e) => patchSettings({ reducedShake: e.target.checked })} /><i /> REDUCED SCREEN SHAKE</label></section>
              </div>
              {hud.status === "paused" && <div className="pause-actions"><button onClick={() => { runtimeRef.current?.pause(false); setScreen("none"); }}>RESUME FLIGHT</button><button onClick={restart}>RESTART</button><button onClick={returnToMenu}>ABANDON TO MENU</button></div>}
            </div>
          )}

          {screen === "achievements" && (
            <div className="menu-overlay panel-overlay achievements-overlay">
              <div className="panel-heading"><div><small>PILOT RECORD</small><h2>ACHIEVEMENTS</h2></div><button onClick={() => setScreen(hud.status === "paused" ? "settings" : "menu")}>×</button></div>
              <div className="achievement-grid">
                {[['FIRST FRACTURE','Complete one flight',stats.flights > 0],['TWIN VISION','Shift 25 times',stats.shifts >= 25],['ECHO HANDSHAKE','Trigger 5 echo switches',stats.echoes >= 5],['RIFT WALKER','Reach 2,500m',stats.best >= 2500]].map(([name, copy, unlocked]) => <div key={String(name)} className={unlocked ? "unlocked" : ""}><span>{unlocked ? "◆" : "◇"}</span><b>{name}</b><small>{copy}</small></div>)}
              </div>
              <div className="powerup-index"><h3>RIFT SYSTEMS DISCOVERED</h3>{powerups.map((item) => <span key={item[0]}><i>{item[1].slice(0,1)}</i><b>{item[1]}</b><small>{item[2]}</small></span>)}</div>
            </div>
          )}

          {hud.status === "over" && screen === "none" && (
            <div className="game-over">
              <small>FLIGHT SIGNAL LOST</small><h2>RIFT COLLAPSE</h2><p>{hud.distance}m traversed · {hud.score.toLocaleString()} points</p>
              <div><button onClick={restart}>↻ RETRY</button><button onClick={returnToMenu}>MISSION ARCHIVE</button></div>
            </div>
          )}

          <button className="mobile-shift" onPointerDown={(e) => { e.preventDefault(); shift(e); }} aria-label="Shift dimension"><small>DIMENSION</small><b>SHIFT</b><span>{hud.phase.toFixed(0)}%</span></button>
          {activeMode === "training" && hud.status === "playing" && <button className="rewind-button" onPointerDown={(e) => { e.stopPropagation(); runtimeRef.current?.rewind(); }}>↶ REWIND</button>}
        </div>

        <div className="hud-bottom">
          <div className="fuel-pair"><Meter label="SOLAR FUEL" value={hud.solarFuel} tone="#55f7e4" /><Meter label="VOID FUEL" value={hud.voidFuel} tone="#ff2e97" /></div>
          <div className="phase-meter"><div className="phase-orb">{hud.dimension === "solar" ? "✦" : "◆"}</div><div><div className="meter-row"><span>PHASE ENERGY</span><b>{Math.round(hud.phase)}%</b></div><div className="phase-track"><i style={{ width: `${hud.phase}%` }} /></div></div></div>
          <Meter label="INSTABILITY" value={hud.instability} tone="linear-gradient(90deg,#f6c453,#ff2e97)" />
          <div className="powerup-slot"><small>ACTIVE SYSTEM</small><b>{hud.powerup}</b></div>
        </div>
      </section>

      <footer className="control-strip">
        <div><span>FLIGHT</span><KeyCap>{settings.controlMode === "keyboard" ? "SPACE / HOLD" : "HOLD LEFT"}</KeyCap><small>RISE · RELEASE TO FALL</small></div>
        <div><span>PHASE</span><KeyCap>{settings.controlMode === "keyboard" ? "SHIFT / E" : "SHIFT"}</KeyCap><small>CHANGE DIMENSION</small></div>
        <div className="world-legend"><i className="solar-dot" /> SOLAR <i className="void-dot" /> VOID <i className="echo-dot" /> ECHO</div>
      </footer>
      <div className="build-label">RIFT NETWORK // LOCAL LINK <i /> STABLE</div>
    </main>
  );
}
