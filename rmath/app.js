const researchers = [
  {
    id: "thirtyseven",
    name: "37",
    title: "Aegean Proof Observatory",
    tag: "Numbers / Geometry",
    mission: "Decode a stormproof geometric sequence by shooting the correct calculations into her celestial proof lattice.",
    goalLabel: "Proof fragments",
    goal: 10,
    icon: "37",
    avatar: "geometry",
    art: {
      portrait: "assets/characters/37-chibi.png",
      chibi: "assets/characters/37-chibi.png",
      source: "https://reverse1999.fandom.com/wiki/37/Gallery"
    },
    cheer: "The proof is becoming visible.",
    effect: "proof glyphs",
    colors: ["#2d6cdf", "#f0c24a", "#8be4ff"],
    arena: {
      title: "Kingdom of Geometry",
      detail: "Triangles, curves, and bright formulae orbit the Aegean lab."
    }
  },
  {
    id: "x",
    name: "X",
    title: "Institutum Chain Reactor",
    tag: "Machines / Cause and Effect",
    mission: "Calibrate a Goldberg engine where every solved product releases the next iron sphere in a perfect mechanical cascade.",
    goalLabel: "Linked mechanisms",
    goal: 9,
    icon: "X",
    avatar: "machine",
    art: {
      portrait: "assets/characters/x-chibi.png",
      chibi: "assets/characters/x-chibi.png",
      source: "https://reverse1999.fandom.com/wiki/X/Gallery"
    },
    cheer: "The chain reaction is behaving.",
    effect: "gear cascade",
    colors: ["#3457d5", "#ffbf45", "#8ae8ff"],
    arena: {
      title: "No Coincidences Lab",
      detail: "Brass gears, rails, and trigger pins wait for exact answers."
    }
  },
  {
    id: "medicine",
    name: "Medicine Pocket",
    title: "Bioacoustic Trial Bay",
    tag: "Biology / Control",
    mission: "Stabilize volatile reagent cultures by ringing the correct answer through a very loud, very suspicious laboratory bell.",
    goalLabel: "Stable cultures",
    goal: 8,
    icon: "MP",
    avatar: "bio",
    art: {
      portrait: "assets/characters/medicine-pocket-chibi.png",
      chibi: "assets/characters/medicine-pocket-chibi.png",
      source: "https://reverse1999.fandom.com/wiki/Medicine_Pocket/Gallery"
    },
    cheer: "Excellent. Nothing exploded permanently.",
    effect: "vial detonation",
    colors: ["#8b2f45", "#f7e1a6", "#9be7c0"],
    arena: {
      title: "Bell of the Forest",
      detail: "Vials rattle, resin light flickers, and the lab keeps daring you to be wrong."
    }
  },
  {
    id: "ezra",
    name: "Ezra",
    title: "Myco-Serum Field Station",
    tag: "Mushrooms / Support",
    mission: "Quantify bioluminescent spore yields from rare agaric specimens to synthesize a regenerative myco-serum.",
    goalLabel: "Spore samples",
    goal: 10,
    icon: "EZ",
    avatar: "mushroom",
    art: {
      portrait: "assets/characters/ezra-chibi.png",
      chibi: "assets/characters/ezra-chibi.png",
      source: "https://reverse1999.fandom.com/wiki/Ezra/Gallery"
    },
    cheer: "The colony is blooming beautifully.",
    effect: "spore bloom",
    colors: ["#315d4b", "#ffcf70", "#d6f7c8"],
    arena: {
      title: "Fungus Ecosystem Machine",
      detail: "Mushrooms bloom and release luminous spores when the answer lands."
    }
  },
  {
    id: "mesmer",
    name: "Mesmer Jr.",
    title: "Somnambulism Stabilizer",
    tag: "Psychoanalysis / Intellect",
    mission: "Tune a rational dream-field by firing exact answers into unstable thought waves before they break patient coherence.",
    goalLabel: "Stabilized waves",
    goal: 8,
    icon: "MJ",
    avatar: "mind",
    art: {
      portrait: "assets/characters/mesmer-jr-chibi.png",
      chibi: "assets/characters/mesmer-jr-chibi.png",
      source: "https://reverse1999.fandom.com/wiki/Mesmer_Jr./Gallery"
    },
    cheer: "The waveform is rational again.",
    effect: "calm pulse",
    colors: ["#6d5dfc", "#82f7ff", "#f1b9ff"],
    arena: {
      title: "Artificial Somnambulism",
      detail: "Mint-blue waveforms drift through a clinical dream chamber."
    }
  }
];

const difficultySettings = {
  easy: {
    label: "Easy",
    spawnRate: 3800,
    speed: 5.5,
    maxTargets: 3,
    multiplication: [10, 19],
    squares: [1, 20],
    shield: 5
  },
  medium: {
    label: "Medium",
    spawnRate: 2900,
    speed: 7.8,
    maxTargets: 4,
    multiplication: [12, 49],
    squares: [1, 35],
    shield: 4
  },
  hard: {
    label: "Hard",
    spawnRate: 2250,
    speed: 10.5,
    maxTargets: 5,
    multiplication: [20, 99],
    squares: [1, 50],
    shield: 3
  }
};

const modes = {
  multiplication: {
    label: "2-digit multiplication",
    short: "Products",
    makeProblem(range) {
      const a = randomInt(range[0], range[1]);
      const b = randomInt(range[0], range[1]);
      return {
        prompt: `${a} × ${b}`,
        answer: a * b
      };
    }
  },
  squares: {
    label: "Squares mode",
    short: "n squared",
    makeProblem(range) {
      const n = randomInt(range[0], range[1]);
      return {
        prompt: `${n}²`,
        answer: n * n
      };
    }
  }
};

const state = {
  screen: "menu",
  researcherId: researchers[0].id,
  mode: "multiplication",
  difficulty: "easy",
  running: false,
  input: "",
  targets: [],
  shots: [],
  bursts: [],
  score: 0,
  solved: 0,
  attempts: 0,
  correct: 0,
  missedProblems: [],
  missedKeys: new Set(),
  streak: 0,
  shield: 5,
  elapsed: 0,
  lastFrame: 0,
  lastSpawn: 0,
  message: "Choose a researcher mission.",
  result: null
};

const app = document.getElementById("app");
let rafId = null;

function render() {
  const researcher = getResearcher();
  const difficulty = difficultySettings[state.difficulty];

  document.body.dataset.theme = researcher.id;
  document.body.style.setProperty("--theme-a", researcher.colors[0]);
  document.body.style.setProperty("--theme-b", researcher.colors[1]);
  document.body.style.setProperty("--theme-c", researcher.colors[2]);

  if (state.screen === "menu") {
    app.innerHTML = menuTemplate(researcher, difficulty);
    bindMenu();
    return;
  }

  if (state.screen === "study") {
    app.innerHTML = studyTemplate(researcher, difficulty);
    bindStudy();
    return;
  }

  app.innerHTML = gameTemplate(researcher, difficulty);
  bindGame();
  drawArena();
}

function menuTemplate(active, difficulty) {
  const modeButtons = Object.entries(modes)
    .map(([id, mode]) => optionButton("mode", id, mode.label, state.mode === id))
    .join("");

  const difficultyButtons = Object.entries(difficultySettings)
    .map(([id, setting]) => optionButton("difficulty", id, setting.label, state.difficulty === id))
    .join("");

  const cards = researchers.map((researcher) => `
    <button class="researcher-card ${researcher.id === state.researcherId ? "selected" : ""}" data-researcher="${researcher.id}" type="button">
      <span class="card-avatar ${researcher.avatar}">${avatarMarkup(researcher)}</span>
      <span class="card-copy">
        <strong>${researcher.name}</strong>
        <small>${researcher.tag}</small>
        <span>${researcher.title}</span>
      </span>
    </button>
  `).join("");

  return `
    <section class="hero-panel">
      <div class="hero-copy">
        <p class="eyebrow">R-Math Field Console</p>
        <h1>Research Shooter</h1>
        <p class="hero-text">Enter exact answers to blast unstable equations and help each researcher complete a mission. Keyboard works fastest; mouse and touch players can use the keypad.</p>
      </div>
      <div class="mission-card">
        <span class="mission-avatar ${active.avatar}">${avatarMarkup(active, "chibi")}</span>
        <div>
          <p class="eyebrow">${active.title}</p>
          <h2>${active.name}</h2>
          <p>${active.mission}</p>
          <div class="mission-meta">
            <span>${modes[state.mode].short}</span>
            <span>${difficulty.label}</span>
            <span>${active.goal} ${active.goalLabel.toLowerCase()}</span>
          </div>
          <a class="art-source" href="${active.art.source}" target="_blank" rel="noreferrer">Artwork source: Reverse: 1999 Wiki gallery</a>
        </div>
      </div>
    </section>

    <section class="setup-grid">
      <div class="setup-panel wide">
        <div class="section-heading">
          <p class="eyebrow">Researcher</p>
          <h2>Select a Mission</h2>
        </div>
        <div class="researcher-grid">${cards}</div>
      </div>

      <div class="setup-panel">
        <div class="section-heading">
          <p class="eyebrow">Problem Set</p>
          <h2>Math Mode</h2>
        </div>
        <div class="segmented">${modeButtons}</div>
      </div>

      <div class="setup-panel">
        <div class="section-heading">
          <p class="eyebrow">Pace</p>
          <h2>Difficulty</h2>
        </div>
        <div class="segmented">${difficultyButtons}</div>
        <p class="hint">${difficultyHint()}</p>
      </div>
    </section>

    <div class="start-row">
      <button class="primary-action" id="startGame" type="button">Launch Mission</button>
      <button class="ghost-action" id="openStudy" type="button">Study Tables</button>
      <p>Answer, press Enter, and watch the field react. Wrong answers cost coherence.</p>
    </div>
  `;
}

function optionButton(group, value, label, selected) {
  return `<button class="${selected ? "selected" : ""}" data-${group}="${value}" type="button">${label}</button>`;
}

function gameTemplate(researcher, difficulty) {
  const resultClass = state.result ? ` ${state.result}` : "";
  const progress = Math.min(100, (state.solved / researcher.goal) * 100);
  const targetMarkup = state.targets.map(targetTemplate).join("");
  const shotMarkup = state.shots.map((shot) => `
    <span class="shot ${shot.kind}" style="left:${shot.x}%; top:${shot.y}%;"></span>
  `).join("");
  const burstMarkup = state.bursts.map((burst) => `
    <span class="burst ${burst.kind}" style="left:${burst.x}%; top:${burst.y}%;">${burst.label}</span>
  `).join("");

  return `
    <section class="game-layout">
      <header class="game-topbar">
        <button class="ghost-action" id="backToMenu" type="button">Menu</button>
        <div>
          <p class="eyebrow">${researcher.title}</p>
          <h1>${researcher.name}: ${researcher.arena.title}</h1>
        </div>
        <div class="topbar-actions">
          <button class="ghost-action" id="openStudyGame" type="button">Study</button>
          <button class="ghost-action" id="restartGame" type="button">Restart</button>
        </div>
      </header>

      <div class="hud">
        <div>
          <span>Goal</span>
          <strong>${state.solved}/${researcher.goal}</strong>
        </div>
        <div>
          <span>Score</span>
          <strong>${state.score}</strong>
        </div>
        <div>
          <span>Streak</span>
          <strong>${state.streak}</strong>
        </div>
        <div>
          <span>Coherence</span>
          <strong>${"◆".repeat(Math.max(0, state.shield))}${"◇".repeat(Math.max(0, difficulty.shield - state.shield))}</strong>
        </div>
      </div>

      <div class="progress-track" aria-label="Mission progress">
        <span style="width:${progress}%"></span>
      </div>

      <section class="arena ${researcher.id}${resultClass}" id="arena">
        <div class="arena-bg">${ambientMarkup(researcher)}</div>
        <div class="theme-stage ${researcher.id}" aria-hidden="true">
          ${themeStageMarkup(researcher)}
        </div>
        <div class="character-player ${researcher.avatar}">
          <span class="character-shadow"></span>
          ${avatarMarkup(researcher, "chibi")}
          <span class="speech-bubble">${state.result === "hit" ? researcher.cheer : encouragement(researcher)}</span>
        </div>
        <aside class="researcher-station">
          <span class="station-avatar ${researcher.avatar}">${avatarMarkup(researcher, "chibi")}</span>
          <strong>${researcher.name}</strong>
          <small>${researcher.arena.detail}</small>
        </aside>
        <div class="lane" id="lane">
          ${targetMarkup}
          ${shotMarkup}
          ${burstMarkup}
        </div>
      </section>

      <section class="control-deck">
        <div class="answer-console">
          <label for="answerInput">Answer</label>
          <input id="answerInput" inputmode="numeric" autocomplete="off" value="${state.input}" placeholder="Type number" ${state.running ? "" : "disabled"}>
          <button class="primary-action compact" id="submitAnswer" type="button" ${state.running ? "" : "disabled"}>Fire</button>
        </div>

        <div class="keypad" aria-label="On-screen number pad">
          ${[1,2,3,4,5,6,7,8,9,"clear",0,"back"].map(keypadButton).join("")}
        </div>

        <div class="mission-feed">
          <p class="eyebrow">${modes[state.mode].label} / ${difficulty.label}</p>
          <strong>${state.message}</strong>
          <span>${state.running ? "Press Enter to fire. Escape returns to menu." : "Mission complete. Restart or choose a new setup."}</span>
        </div>
      </section>

      ${state.running ? "" : resultsTemplate()}
    </section>
  `;
}

function resultsTemplate() {
  const attempts = state.attempts;
  const percent = attempts ? Math.round((state.correct / attempts) * 100) : 0;
  const missedRows = state.missedProblems.length
    ? state.missedProblems.map((miss) => `
      <tr>
        <td>${miss.prompt}</td>
        <td>${miss.answer}</td>
        <td>${miss.submitted == null ? "Missed in field" : miss.submitted}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="3">No missed answers. Clean research notes.</td></tr>`;

  return `
    <section class="results-panel">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Mission Report</p>
          <h2>${state.result === "win" ? "Research Goal Reached" : "Field Notes Recovered"}</h2>
        </div>
        <button class="ghost-action" id="studyFromResults" type="button">Study This Mode</button>
      </div>
      <div class="stat-grid">
        <div><span>Correct percentage</span><strong>${percent}%</strong></div>
        <div><span>Questions answered</span><strong>${attempts}</strong></div>
        <div><span>Correct answers</span><strong>${state.correct}</strong></div>
        <div><span>Unique missed problems</span><strong>${state.missedProblems.length}</strong></div>
      </div>
      <div class="table-wrap">
        <table class="review-table">
          <thead>
            <tr>
              <th>Problem</th>
              <th>Correct answer</th>
              <th>Your answer</th>
            </tr>
          </thead>
          <tbody>${missedRows}</tbody>
        </table>
      </div>
    </section>
  `;
}

function studyTemplate(active, difficulty) {
  const modeButtons = Object.entries(modes)
    .map(([id, mode]) => optionButton("mode", id, mode.label, state.mode === id))
    .join("");

  const difficultyButtons = Object.entries(difficultySettings)
    .map(([id, setting]) => optionButton("difficulty", id, setting.label, state.difficulty === id))
    .join("");

  return `
    <section class="study-page">
      <header class="game-topbar">
        <button class="ghost-action" id="studyBack" type="button">Menu</button>
        <div>
          <p class="eyebrow">R-Math Study Console</p>
          <h1>Study Tables</h1>
        </div>
        <button class="primary-action compact" id="studyStart" type="button">Launch Mission</button>
      </header>

      <section class="setup-grid study-controls">
        <div class="setup-panel">
          <div class="section-heading">
            <p class="eyebrow">Problem Set</p>
            <h2>Math Mode</h2>
          </div>
          <div class="segmented">${modeButtons}</div>
        </div>
        <div class="setup-panel">
          <div class="section-heading">
            <p class="eyebrow">Range</p>
            <h2>Difficulty</h2>
          </div>
          <div class="segmented">${difficultyButtons}</div>
          <p class="hint">${difficultyHint()}</p>
        </div>
        <div class="setup-panel study-note">
          <span class="card-avatar ${active.avatar}">${avatarMarkup(active)}</span>
          <div>
            <p class="eyebrow">${active.name}'s Tip</p>
            <h2>${modes[state.mode].label}</h2>
            <p>${studyTip()}</p>
          </div>
        </div>
      </section>

      <section class="study-table-panel">
        <div class="section-heading">
          <div>
            <p class="eyebrow">${difficulty.label}</p>
            <h2>${state.mode === "squares" ? "Squares Reference" : "Multiplication Reference"}</h2>
          </div>
          <span class="range-pill">${studyRangeLabel()}</span>
        </div>
        ${state.mode === "squares" ? squaresStudyTable() : multiplicationStudyTable()}
      </section>
    </section>
  `;
}

function targetTemplate(target) {
  return `
    <button class="target ${target.kind}" type="button" data-target="${target.id}" style="left:${target.x}%; top:${target.y}%;">
      <span class="problem">${target.prompt}</span>
      <span class="danger">?</span>
    </button>
  `;
}

function keypadButton(value) {
  const label = value === "clear" ? "C" : value === "back" ? "⌫" : value;
  return `<button type="button" data-key="${value}">${label}</button>`;
}

function avatarMarkup(researcher, variant = "chibi") {
  const src = researcher.art?.[variant] || researcher.art?.chibi;
  const icon = researcher.icon;
  if (src) {
    return `
      <span class="art-frame" data-initial="${icon}">
        <img src="${src}" alt="${researcher.name} artwork" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentElement.classList.add('image-missing')">
      </span>
    `;
  }
  if (researcher.avatar === "geometry") {
    return `<i class="halo"></i><b>${icon}</b><i class="triangle"></i>`;
  }
  if (researcher.avatar === "machine") {
    return `<i class="gear one"></i><b>${icon}</b><i class="gear two"></i>`;
  }
  if (researcher.avatar === "bio") {
    return `<i class="vial one"></i><b>${icon}</b><i class="bell"></i>`;
  }
  if (researcher.avatar === "mushroom") {
    return `<i class="cap"></i><b>${icon}</b><i class="spores"></i>`;
  }
  return `<i class="wave one"></i><b>${icon}</b><i class="wave two"></i>`;
}

function ambientMarkup(researcher) {
  if (researcher.id === "thirtyseven") {
    return `<span>△</span><span>∑</span><span>φ</span><span>37</span><span>○</span>`;
  }
  if (researcher.id === "x") {
    return `<span>⚙</span><span>●</span><span>↘</span><span>⚙</span><span>⟲</span>`;
  }
  if (researcher.id === "medicine") {
    return `<span>✚</span><span>⚗</span><span>◌</span><span>!</span><span>♢</span>`;
  }
  if (researcher.id === "ezra") {
    return `<span>✦</span><span>☂</span><span>○</span><span>✧</span><span>☂</span>`;
  }
  return `<span>≈</span><span>Ψ</span><span>◐</span><span>≈</span><span>◇</span>`;
}

function themeStageMarkup(researcher) {
  if (researcher.id === "ezra") {
    return `
      <span class="stage-mushroom mush-a"><i></i></span>
      <span class="stage-mushroom mush-b"><i></i></span>
      <span class="stage-mushroom mush-c"><i></i></span>
      <span class="spore-cloud one"></span>
      <span class="spore-cloud two"></span>
      <span class="poison-pool"></span>
    `;
  }
  if (researcher.id === "thirtyseven") {
    return `
      <span class="proof-orbit orbit-a"></span>
      <span class="proof-orbit orbit-b"></span>
      <span class="proof-line line-a"></span>
      <span class="proof-line line-b"></span>
      <span class="broken-proof"></span>
    `;
  }
  if (researcher.id === "x") {
    return `
      <span class="rail rail-a"></span>
      <span class="rail rail-b"></span>
      <span class="machine-gear gear-a"></span>
      <span class="machine-gear gear-b"></span>
      <span class="iron-ball"></span>
      <span class="jam-smoke"></span>
    `;
  }
  if (researcher.id === "medicine") {
    return `
      <span class="lab-bell"></span>
      <span class="reagent vial-a"></span>
      <span class="reagent vial-b"></span>
      <span class="bubble-field"></span>
      <span class="acid-splash"></span>
    `;
  }
  return `
    <span class="dream-ring ring-a"></span>
    <span class="dream-ring ring-b"></span>
    <span class="brainwave wave-a"></span>
    <span class="brainwave wave-b"></span>
    <span class="static-scratches"></span>
  `;
}

function encouragement(researcher) {
  const lines = {
    thirtyseven: "Show me the answer.",
    x: "No coincidence. Calculate.",
    medicine: "Make it ring.",
    ezra: "The spores are ready.",
    mesmer: "Keep the field stable."
  };
  return lines[researcher.id] || "Ready.";
}

function bindMenu() {
  app.querySelectorAll("[data-researcher]").forEach((button) => {
    button.addEventListener("click", () => {
      state.researcherId = button.dataset.researcher;
      render();
    });
  });

  app.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.mode = button.dataset.mode;
      render();
    });
  });

  app.querySelectorAll("[data-difficulty]").forEach((button) => {
    button.addEventListener("click", () => {
      state.difficulty = button.dataset.difficulty;
      render();
    });
  });

  document.getElementById("startGame").addEventListener("click", startGame);
  document.getElementById("openStudy").addEventListener("click", showStudy);
}

function bindStudy() {
  document.getElementById("studyBack").addEventListener("click", showMenu);
  document.getElementById("studyStart").addEventListener("click", startGame);

  app.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.mode = button.dataset.mode;
      render();
    });
  });

  app.querySelectorAll("[data-difficulty]").forEach((button) => {
    button.addEventListener("click", () => {
      state.difficulty = button.dataset.difficulty;
      render();
    });
  });
}

function bindGame() {
  document.getElementById("backToMenu").addEventListener("click", showMenu);
  document.getElementById("restartGame").addEventListener("click", startGame);
  document.getElementById("openStudyGame").addEventListener("click", showStudy);
  document.getElementById("submitAnswer").addEventListener("click", submitAnswer);
  document.getElementById("studyFromResults")?.addEventListener("click", showStudy);

  const input = document.getElementById("answerInput");
  input.addEventListener("input", (event) => {
    state.input = event.target.value.replace(/\D/g, "").slice(0, 5);
    event.target.value = state.input;
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submitAnswer();
    }
  });

  app.querySelectorAll("[data-key]").forEach((button) => {
    button.addEventListener("click", () => pressKey(button.dataset.key));
  });

  app.querySelectorAll("[data-target]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = state.targets.find((item) => item.id === button.dataset.target);
      if (target) {
        state.message = `${target.prompt} is waiting for ${target.answer}. Type it and fire.`;
        focusAnswer();
      }
    });
  });

  focusAnswer();
}

function startGame() {
  cancelAnimationFrame(rafId);
  const difficulty = difficultySettings[state.difficulty];
  state.screen = "game";
  state.running = true;
  state.input = "";
  state.targets = [];
  state.shots = [];
  state.bursts = [];
  state.score = 0;
  state.solved = 0;
  state.attempts = 0;
  state.correct = 0;
  state.missedProblems = [];
  state.missedKeys = new Set();
  state.streak = 0;
  state.shield = difficulty.shield;
  state.elapsed = 0;
  state.lastFrame = performance.now();
  state.lastSpawn = 0;
  state.result = null;
  state.message = getResearcher().mission;
  spawnTarget();
  render();
  rafId = requestAnimationFrame(tick);
}

function showMenu() {
  cancelAnimationFrame(rafId);
  state.screen = "menu";
  state.running = false;
  state.result = null;
  state.message = "Choose a researcher mission.";
  render();
}

function showStudy() {
  cancelAnimationFrame(rafId);
  state.screen = "study";
  state.running = false;
  state.result = null;
  state.message = "Study the mode before launching.";
  render();
}

function tick(now) {
  if (!state.running) {
    return;
  }

  const delta = Math.min(50, now - state.lastFrame);
  state.lastFrame = now;
  state.elapsed += delta;
  state.lastSpawn += delta;

  const difficulty = difficultySettings[state.difficulty];
  const speed = difficulty.speed * (delta / 1000);
  let needsRender = false;

  state.targets.forEach((target) => {
    target.x -= speed;
    target.wobble += delta / 900;
    target.y += Math.sin(target.wobble) * 0.015;
  });

  state.shots.forEach((shot) => {
    shot.x += 175 * (delta / 1000);
    shot.life -= delta;
  });

  state.bursts.forEach((burst) => {
    burst.life -= delta;
  });

  const escaped = state.targets.filter((target) => target.x < 12);
  if (escaped.length) {
    state.targets = state.targets.filter((target) => target.x >= 12);
    escaped.forEach((target) => recordMiss(target));
    state.shield -= escaped.length;
    state.streak = 0;
    state.message = `${escaped[0].prompt} destabilized the field. Coherence lost.`;
    flash("miss");
    needsRender = true;
  }

  state.shots = state.shots.filter((shot) => shot.life > 0 && shot.x < 110);
  state.bursts = state.bursts.filter((burst) => burst.life > 0);

  if (state.lastSpawn > difficulty.spawnRate && state.targets.length < difficulty.maxTargets) {
    spawnTarget();
    state.lastSpawn = 0;
    needsRender = true;
  }

  if (state.shield <= 0) {
    finishGame(false);
    return;
  }

  if (needsRender) {
    render();
  } else {
    drawArena();
  }
  rafId = requestAnimationFrame(tick);
}

function spawnTarget() {
  const difficulty = difficultySettings[state.difficulty];
  const mode = modes[state.mode];
  const problem = mode.makeProblem(difficulty[state.mode]);
  const researcher = getResearcher();
  const y = randomInt(18, 72);

  state.targets.push({
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    prompt: problem.prompt,
    answer: problem.answer,
    x: randomInt(78, 94),
    y,
    wobble: Math.random() * 10,
    kind: researcher.id
  });
}

function submitAnswer() {
  if (!state.running) {
    return;
  }

  const answer = Number(state.input);
  if (!state.input) {
    state.message = "Load an answer before firing.";
    flash("miss");
    return;
  }

  const target = state.targets
    .slice()
    .sort((a, b) => a.x - b.x)
    .find((item) => item.answer === answer);

  if (!target) {
    const frontTarget = state.targets.slice().sort((a, b) => a.x - b.x)[0];
    if (frontTarget) {
      recordMiss(frontTarget, answer);
    }
    state.attempts += 1;
    state.shield -= 1;
    state.streak = 0;
    state.input = "";
    state.message = `${answer} missed. Recalculate and keep the field intact.`;
    flash("miss");
    render();
    if (state.shield <= 0) {
      finishGame(false);
    }
    return;
  }

  const researcher = getResearcher();
  state.targets = state.targets.filter((item) => item.id !== target.id);
  state.attempts += 1;
  state.correct += 1;
  state.streak += 1;
  state.solved += 1;
  state.score += 100 + state.streak * 25 + (state.difficulty === "hard" ? 50 : 0);
  state.input = "";
  state.message = `${target.prompt} = ${answer}. ${researcher.effect} secured.`;
  state.shots.push({
    x: 23,
    y: target.y + 3,
    life: 650,
    kind: researcher.id
  });
  state.bursts.push({
    x: target.x + 5,
    y: target.y + 5,
    life: 950,
    kind: researcher.id,
    label: burstLabel(researcher)
  });
  flash("hit");

  if (state.solved >= researcher.goal) {
    finishGame(true);
    return;
  }

  if (state.targets.length < 2) {
    spawnTarget();
  }
  render();
}

function finishGame(won) {
  state.running = false;
  state.result = won ? "win" : "fail";
  state.message = won
    ? `${getResearcher().name}'s mission is complete. Final score: ${state.score}.`
    : `The field collapsed, but the notes survived. Try a slower difficulty or a different mode.`;
  render();
}

function pressKey(key) {
  if (!state.running) {
    return;
  }

  if (key === "clear") {
    state.input = "";
  } else if (key === "back") {
    state.input = state.input.slice(0, -1);
  } else {
    state.input = `${state.input}${key}`.slice(0, 5);
  }
  render();
}

function drawArena() {
  const lane = document.getElementById("lane");
  if (!lane) {
    return;
  }

  state.targets.forEach((target) => {
    const element = lane.querySelector(`[data-target="${target.id}"]`);
    if (element) {
      element.style.left = `${target.x}%`;
      element.style.top = `${target.y}%`;
    }
  });

  state.shots.forEach((shot, index) => {
    const element = lane.querySelectorAll(".shot")[index];
    if (element) {
      element.style.left = `${shot.x}%`;
      element.style.top = `${shot.y}%`;
    }
  });
}

function focusAnswer() {
  window.setTimeout(() => {
    const input = document.getElementById("answerInput");
    if (input && !input.disabled) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }, 0);
}

function flash(result) {
  state.result = result;
  window.setTimeout(() => {
    if (state.running && state.result === result) {
      state.result = null;
      const arena = document.getElementById("arena");
      if (arena) {
        arena.classList.remove(result);
      }
    }
  }, 1050);
}

function difficultyHint() {
  if (state.mode === "squares") {
    const range = difficultySettings[state.difficulty].squares;
    return `Squares from ${range[0]} to ${range[1]}.`;
  }
  const range = difficultySettings[state.difficulty].multiplication;
  return `Factors from ${range[0]} to ${range[1]}.`;
}

function studyTip() {
  if (state.mode === "squares") {
    return "Read the table in short runs: 1-10, 11-20, then the higher squares. The fast wins come from recognizing the shape before typing.";
  }
  return "Use the row and column headers like coordinates. Practice one decade band at a time, then jump into the mission when the products start feeling automatic.";
}

function studyRangeLabel() {
  const range = difficultySettings[state.difficulty][state.mode];
  return `${range[0]}-${range[1]}`;
}

function squaresStudyTable() {
  const range = difficultySettings[state.difficulty].squares;
  const rows = rangeNumbers(range[0], range[1]).map((n) => `
    <tr>
      <th>${n}</th>
      <td>${n}²</td>
      <td>${n * n}</td>
    </tr>
  `).join("");

  return `
    <div class="table-wrap study-wrap compact-table">
      <table class="review-table study-table">
        <thead>
          <tr>
            <th>n</th>
            <th>Problem</th>
            <th>Answer</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function multiplicationStudyTable() {
  const range = difficultySettings[state.difficulty].multiplication;
  const numbers = rangeNumbers(range[0], range[1]);
  const header = numbers.map((n) => `<th>${n}</th>`).join("");
  const rows = numbers.map((row) => `
    <tr>
      <th>${row}</th>
      ${numbers.map((column) => `<td>${row * column}</td>`).join("")}
    </tr>
  `).join("");

  return `
    <div class="table-wrap study-wrap multiplication-wrap">
      <table class="review-table study-table multiplication-table">
        <thead>
          <tr>
            <th>×</th>
            ${header}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function rangeNumbers(min, max) {
  return Array.from({ length: max - min + 1 }, (_, index) => min + index);
}

function burstLabel(researcher) {
  const labels = {
    thirtyseven: "∴",
    x: "clink",
    medicine: "ring",
    ezra: "spores",
    mesmer: "calm"
  };
  return labels[researcher.id];
}

function recordMiss(target, submitted = null) {
  const key = target.prompt;
  if (state.missedKeys.has(key)) {
    return;
  }

  state.missedKeys.add(key);
  state.missedProblems.push({
    prompt: target.prompt,
    answer: target.answer,
    submitted
  });
}

function getResearcher() {
  return researchers.find((researcher) => researcher.id === state.researcherId) || researchers[0];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

window.addEventListener("keydown", (event) => {
  if (state.screen !== "game") {
    return;
  }

  if (event.key === "Escape") {
    showMenu();
  }
});

render();
