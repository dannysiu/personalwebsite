const firebaseConfig = {
  apiKey: "AIzaSyAM-yGDbkDPLUdUI-NdHsCUm5vhlXG0Z3M",
  authDomain: "world-cup-league-2026.firebaseapp.com",
  projectId: "world-cup-league-2026",
  storageBucket: "world-cup-league-2026.firebasestorage.app",
  messagingSenderId: "253099908614",
  appId: "1:253099908614:web:782fd709ac8f7056fe6d87"
};

const players = new Map();

function addPlayer(name, country, seed, rating) {
  const record = { name, country, seed, rating };
  players.set(name, record);
  return record;
}

[
  ["Alexander Zverev", "GER", 1, 94],
  ["Quentin Halys", "FRA", null, 59],
  ["Alejandro Tabilo", "CHI", 25, 70],
  ["Luciano Darderi", "ITA", 21, 73],
  ["Dane Sweeny", "AUS", null, 55],
  ["Yunchaokete Bu", "CHN", null, 56],
  ["Michael Zheng", "USA", null, 52],
  ["Zachary Svajda", "USA", null, 57],
  ["Arthur Gea", "FRA", null, 54],
  ["Zizou Bergs", "BEL", 31, 64],
  ["Jesper de Jong", "NED", null, 58],
  ["Botic van de Zandschulp", "NED", null, 64],
  ["Alex de Minaur", "AUS", 6, 87],
  ["Karen Khachanov", "—", null, 72],
  ["Benjamin Bonzi", "FRA", null, 61],
  ["Ignacio Buse", "PER", 32, 58],
  ["Jakub Mensik", "CZE", 17, 78],
  ["Gael Monfils", "FRA", null, 61],
  ["Learner Tien", "USA", 14, 76],
  ["Taylor Fritz", "USA", 9, 83],
  ["Francisco Cerundolo", "ARG", 24, 72],
  ["Alexander Blockx", "BEL", 28, 68],
  ["Flavio Cobolli", "ITA", 5, 87],
  ["Daniil Medvedev", "—", 7, 84],
  ["Arthur Rinderknech", "FRA", 26, 68],
  ["Valentin Vacherot", "MON", 22, 75],
  ["Frances Tiafoe", "USA", 11, 80],
  ["Alex Michelsen", "USA", 16, 73],
  ["Daniel Merida", "ESP", null, 52],
  ["Tomas Martin Etcheverry", "ARG", 27, 69],
  ["Mariano Navone", "ARG", null, 61],
  ["Ben Shelton", "USA", 8, 85],
  ["Denis Shapovalov", "CAN", null, 70],
  ["Jiri Lehecka", "CZE", 18, 76],
  ["Stefanos Tsitsipas", "GRE", null, 72],
  ["Alexander Bublik", "KAZ", 15, 79],
  ["Tommy Paul", "USA", 20, 77],
  ["Yibing Wu", "CHN", null, 63],
  ["Carlos Alcaraz", "ESP", 2, 98]
].forEach(args => addPlayer(...args));

const leaf = name => ({ player: name });
const source = id => ({ source: id });

const rounds = [
  {
    id: "r2",
    title: "Round 2 · Open",
    date: "Thu Sep 3",
    matches: [
      { id: "1201", number: "R2 · M1", refs: [leaf("Alexander Zverev"), leaf("Quentin Halys")], time: "6:00 PM CT", venue: "Arthur Ashe Stadium", timing: "Session start" },
      { id: "1205", number: "R2 · M5", refs: [leaf("Yunchaokete Bu"), leaf("Michael Zheng")], time: "5:40 PM CT", venue: "Court 12", timing: "Not before" },
      { id: "1206", number: "R2 · M6", refs: [leaf("Zachary Svajda"), leaf("Arthur Gea")], time: "3:00 PM CT", venue: "Court 6", timing: "Not before" },
      { id: "1207", number: "R2 · M7", refs: [leaf("Zizou Bergs"), leaf("Jesper de Jong")], time: "3:00 PM CT", venue: "Court 7", timing: "Not before" },
      { id: "1208", number: "R2 · M8", refs: [leaf("Botic van de Zandschulp"), leaf("Alex de Minaur")], time: "3:30 PM CT", venue: "Grandstand", timing: "Not before" },
      { id: "1210", number: "R2 · M10", refs: [leaf("Benjamin Bonzi"), leaf("Ignacio Buse")], time: "3:00 PM CT", venue: "Court 13", timing: "Not before" },
      { id: "1212", number: "R2 · M12", refs: [leaf("Gael Monfils"), leaf("Learner Tien")], time: "6:00 PM CT", venue: "Louis Armstrong", timing: "Session start" }
    ]
  },
  {
    id: "r3",
    title: "Round 3",
    date: "Sep 4–5 · Time TBD CT",
    matches: [
      { id: "1301", number: "R3 · M1", refs: [source("1201"), leaf("Alejandro Tabilo")] },
      { id: "1302", number: "R3 · M2", refs: [leaf("Luciano Darderi"), leaf("Dane Sweeny")] },
      { id: "1303", number: "R3 · M3", refs: [source("1205"), source("1206")] },
      { id: "1304", number: "R3 · M4", refs: [source("1207"), source("1208")] },
      { id: "1305", number: "R3 · M5", refs: [leaf("Karen Khachanov"), source("1210")] },
      { id: "1306", number: "R3 · M6", refs: [leaf("Jakub Mensik"), source("1212")] },
      { id: "1307", number: "R3 · M7", refs: [leaf("Taylor Fritz"), leaf("Francisco Cerundolo")] },
      { id: "1308", number: "R3 · M8", refs: [leaf("Alexander Blockx"), leaf("Flavio Cobolli")] },
      { id: "1309", number: "R3 · M9", refs: [leaf("Daniil Medvedev"), leaf("Arthur Rinderknech")] },
      { id: "1310", number: "R3 · M10", refs: [leaf("Valentin Vacherot"), leaf("Frances Tiafoe")] },
      { id: "1311", number: "R3 · M11", refs: [leaf("Alex Michelsen"), leaf("Daniel Merida")] },
      { id: "1312", number: "R3 · M12", refs: [leaf("Tomas Martin Etcheverry"), leaf("Mariano Navone")] },
      { id: "1313", number: "R3 · M13", refs: [leaf("Ben Shelton"), leaf("Denis Shapovalov")] },
      { id: "1314", number: "R3 · M14", refs: [leaf("Jiri Lehecka"), leaf("Stefanos Tsitsipas")] },
      { id: "1315", number: "R3 · M15", refs: [leaf("Alexander Bublik"), leaf("Tommy Paul")] },
      { id: "1316", number: "R3 · M16", refs: [leaf("Yibing Wu"), leaf("Carlos Alcaraz")] }
    ]
  }
];

function addKnockoutRound(id, title, date, priorRound, count, metadata = {}) {
  const matches = Array.from({ length: count }, (_, index) => ({
    id: `${id}-${index + 1}`,
    number: `${title.replace("Quarterfinals", "QF").replace("Semifinals", "SF").replace("Round ", "R")} · M${index + 1}`,
    refs: [source(priorRound.matches[index * 2].id), source(priorRound.matches[index * 2 + 1].id)],
    ...metadata[index]
  }));
  const round = { id, title, date, matches };
  rounds.push(round);
  return round;
}

const r4 = addKnockoutRound("r4", "Round 4", "Sep 6–7 · Time TBD CT", rounds[1], 8, {});
const qf = addKnockoutRound("qf", "Quarterfinals", "Sep 8–9 · 10:30 AM / 6:00 PM CT", r4, 4, {});
const sf = addKnockoutRound("sf", "Semifinals", "Fri Sep 11 · Central time", qf, 2, {
  0: { time: "2:00 PM CT", venue: "Arthur Ashe Stadium", timing: "Scheduled" },
  1: { time: "6:00 PM CT", venue: "Arthur Ashe Stadium", timing: "Scheduled" }
});
addKnockoutRound("f", "Final", "Sun Sep 13", sf, 1, {
  0: { time: "1:00 PM CT", venue: "Arthur Ashe Stadium", timing: "Scheduled" }
});

const allMatches = rounds.flatMap(round => round.matches.map(match => ({ ...match, roundId: round.id })));
const matchesById = new Map(allMatches.map(match => [match.id, match]));
const roundIndexByMatch = new Map(allMatches.map(match => [match.id, rounds.findIndex(round => round.id === match.roundId)]));
const totalMatches = allMatches.length;

let selections = {};
let currentUser = null;
let toastTimer;

const bracketBoard = document.getElementById("bracketBoard");
const pickProgress = document.getElementById("pickProgress");
const completionFill = document.getElementById("completionFill");
const completionCopy = document.getElementById("completionCopy");
const championName = document.getElementById("championName");
const championMeta = document.getElementById("championMeta");
const oddsList = document.getElementById("oddsList");
const oddsTableBody = document.getElementById("oddsTableBody");
const saveState = document.getElementById("saveState");
const toast = document.getElementById("toast");

function storageKey() {
  return `usopen-2026-picks:${currentUser?.uid || "guest"}`;
}

function loadPicks() {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey()) || "{}");
    selections = parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    selections = {};
  }
  sanitizeSelections();
}

function savePicks() {
  try {
    localStorage.setItem(storageKey(), JSON.stringify(selections));
  } catch {
    saveState.textContent = "This browser could not save picks locally.";
  }
}

function resolveRef(ref) {
  if (ref.player) return players.get(ref.player) || null;
  if (ref.source && selections[ref.source]) return players.get(selections[ref.source]) || null;
  return null;
}

function sourceLabel(ref) {
  if (ref.player) return ref.player;
  const sourceMatch = matchesById.get(ref.source);
  if (!sourceMatch) return "Winner TBD";
  const resolved = resolveRef(ref);
  if (resolved) return resolved.name;
  const names = sourceMatch.refs.map(sourceRef => {
    if (sourceRef.player) return sourceRef.player.split(" ").slice(-1)[0];
    return resolveRef(sourceRef)?.name.split(" ").slice(-1)[0] || "TBD";
  });
  return `Winner · ${names.join(" / ")}`;
}

function matchParticipants(match) {
  return match.refs.map(resolveRef);
}

function sanitizeSelections() {
  for (const round of rounds) {
    for (const match of round.matches) {
      const options = matchParticipants(match).filter(Boolean).map(player => player.name);
      if (!options.includes(selections[match.id])) delete selections[match.id];
    }
  }
}

function matchDependsOn(match, targetId, seen = new Set()) {
  if (seen.has(match.id)) return false;
  seen.add(match.id);
  return match.refs.some(ref => {
    if (!ref.source) return false;
    if (ref.source === targetId) return true;
    const parent = matchesById.get(ref.source);
    return parent ? matchDependsOn(parent, targetId, seen) : false;
  });
}

function invalidateDownstream(matchId) {
  const changedRound = roundIndexByMatch.get(matchId) || 0;
  rounds.slice(changedRound + 1).forEach(round => {
    round.matches.forEach(match => {
      if (matchDependsOn(match, matchId)) delete selections[match.id];
    });
  });
}

function winProbability(playerA, playerB) {
  const probability = 1 / (1 + Math.pow(10, (playerB.rating - playerA.rating) / 33));
  return Math.max(0.08, Math.min(0.92, probability));
}

function forecastForMatch(playerA, playerB) {
  if (!playerA || !playerB) return null;
  const probabilityA = winProbability(playerA, playerB);
  return probabilityA >= 0.5
    ? { player: playerA, probability: probabilityA }
    : { player: playerB, probability: 1 - probabilityA };
}

function distributionForRef(ref, memo) {
  if (ref.player) return { [ref.player]: 1 };
  return distributionForMatch(ref.source, memo);
}

function distributionForMatch(matchId, memo = new Map()) {
  if (memo.has(matchId)) return memo.get(matchId);
  const match = matchesById.get(matchId);
  if (!match) return {};
  const left = distributionForRef(match.refs[0], memo);
  const right = distributionForRef(match.refs[1], memo);
  const result = {};

  Object.entries(left).forEach(([leftName, leftPath]) => {
    Object.entries(right).forEach(([rightName, rightPath]) => {
      const pairPath = leftPath * rightPath;
      const leftPlayer = players.get(leftName);
      const rightPlayer = players.get(rightName);
      const leftWins = winProbability(leftPlayer, rightPlayer);
      result[leftName] = (result[leftName] || 0) + pairPath * leftWins;
      result[rightName] = (result[rightName] || 0) + pairPath * (1 - leftWins);
    });
  });

  memo.set(matchId, result);
  return result;
}

const finalMatch = rounds.at(-1).matches[0];
const titleOdds = Object.entries(distributionForMatch(finalMatch.id))
  .map(([name, probability]) => ({ player: players.get(name), probability }))
  .sort((a, b) => b.probability - a.probability);

function formatPercent(value) {
  if (value < 0.001) return "<0.1%";
  if (value < 0.01) return `${(value * 100).toFixed(1)}%`;
  return `${Math.round(value * 100)}%`;
}

function escapeHTML(value) {
  return String(value).replace(/[&<>'"]/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[character]);
}

function playerRow(match, ref, player) {
  const selected = player && selections[match.id] === player.name;
  const name = player?.name || sourceLabel(ref);
  const country = player?.country || "—";
  const seed = player?.seed ? `#${player.seed}` : "";
  const encodedName = player ? encodeURIComponent(player.name) : "";

  return `
    <button class="player-pick${selected ? " selected" : ""}" type="button"
      data-match="${escapeHTML(match.id)}" data-player="${encodedName}" ${player ? "" : "disabled"}
      aria-pressed="${selected ? "true" : "false"}">
      <span class="country-badge">${escapeHTML(country)}</span>
      <span class="player-name">${escapeHTML(name)}</span>
      <span class="seed">${escapeHTML(seed)}</span>
      <span class="pick-check" aria-hidden="true">✓</span>
    </button>`;
}

function matchMetadata(round, match) {
  if (match.time) return `${match.timing || "Scheduled"} · ${match.time}`;
  return round.date;
}

function renderMatch(round, match) {
  const [left, right] = matchParticipants(match);
  const forecast = forecastForMatch(left, right);
  const selected = selections[match.id];
  let modelCopy = "Pick earlier matches to unlock";

  if (selected) {
    modelCopy = `Your pick · ${selected.split(" ").slice(-1)[0]}`;
  } else if (forecast) {
    modelCopy = `Forecast · ${forecast.player.name.split(" ").slice(-1)[0]} ${formatPercent(forecast.probability)}`;
  }

  return `
    <article class="match-card${selected ? " complete" : ""}">
      <div class="match-meta">
        <span>${escapeHTML(match.number)}</span>
        <span>${escapeHTML(matchMetadata(round, match))}</span>
      </div>
      ${playerRow(match, match.refs[0], left)}
      ${playerRow(match, match.refs[1], right)}
      <div class="match-model">
        <strong>${escapeHTML(modelCopy)}</strong>
        <span>${escapeHTML(match.venue || "Court TBD")}</span>
      </div>
    </article>`;
}

function renderBracket() {
  bracketBoard.innerHTML = `<div class="bracket-grid">${rounds.map(round => `
    <section class="round-column" aria-labelledby="heading-${round.id}">
      <div class="round-header">
        <h2 id="heading-${round.id}">${escapeHTML(round.title)}</h2>
        <span>${round.matches.length} ${round.matches.length === 1 ? "match" : "matches"}</span>
      </div>
      <div class="match-stack">${round.matches.map(match => renderMatch(round, match)).join("")}</div>
    </section>`).join("")}</div>`;
}

function renderOdds() {
  const maxOdds = titleOdds[0]?.probability || 1;
  oddsList.innerHTML = titleOdds.slice(0, 5).map(({ player, probability }) => `
    <li>
      <span class="odds-player"><strong>${escapeHTML(player.name)}</strong><span>${escapeHTML(player.country)}${player.seed ? ` · Seed ${player.seed}` : ""}</span></span>
      <span class="odds-value">${formatPercent(probability)}</span>
    </li>`).join("");

  oddsTableBody.innerHTML = titleOdds.map(({ player, probability }, index) => `
    <tr>
      <td>${index + 1}</td>
      <td><span class="table-player"><span class="country-badge">${escapeHTML(player.country)}</span>${escapeHTML(player.name)}</span></td>
      <td>${player.seed || "—"}</td>
      <td><strong>${formatPercent(probability)}</strong><span class="odds-bar" aria-hidden="true"><span style="width:${Math.max(1.5, probability / maxOdds * 100).toFixed(1)}%"></span></span></td>
      <td>${player.rating}</td>
    </tr>`).join("");
}

function renderSummary() {
  const picked = Object.keys(selections).filter(id => matchesById.has(id)).length;
  const percent = Math.round(picked / totalMatches * 100);
  pickProgress.textContent = `${picked} / ${totalMatches}`;
  completionFill.style.width = `${percent}%`;
  completionCopy.textContent = `${percent}% of draw picked`;

  const champion = selections[finalMatch.id];
  if (champion) {
    const player = players.get(champion);
    const odds = titleOdds.find(item => item.player.name === champion)?.probability || 0;
    championName.textContent = champion;
    championMeta.textContent = `${player.country}${player.seed ? ` · Seed ${player.seed}` : ""} · ${formatPercent(odds)} model title chance`;
  } else {
    championName.textContent = "Make your picks";
    championMeta.textContent = "Complete the final to lock in a champion.";
  }

  saveState.textContent = currentUser
    ? `Saved for ${currentUser.displayName || currentUser.email} on this device.`
    : "Picks save automatically on this device.";
}

function render() {
  sanitizeSelections();
  savePicks();
  renderBracket();
  renderSummary();
}

function selectWinner(matchId, playerName) {
  const match = matchesById.get(matchId);
  if (!match) return;
  const options = matchParticipants(match).filter(Boolean).map(player => player.name);
  if (!options.includes(playerName)) return;
  if (selections[matchId] !== playerName) invalidateDownstream(matchId);
  selections[matchId] = playerName;
  render();
}

function projectDraw() {
  selections = {};
  rounds.forEach(round => {
    round.matches.forEach(match => {
      const [left, right] = matchParticipants(match);
      const forecast = forecastForMatch(left, right);
      if (forecast) selections[match.id] = forecast.player.name;
    });
  });
  render();
  showToast(`Projection complete: ${selections[finalMatch.id]} wins the model bracket.`);
  bracketBoard.scrollTo({ left: 0, behavior: "smooth" });
}

function clearPicks() {
  selections = {};
  render();
  showToast("Your bracket has been cleared.");
}

function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("show");
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
}

function showView(view) {
  const showBracket = view === "bracket";
  document.getElementById("bracketView").classList.toggle("hidden", !showBracket);
  document.getElementById("oddsView").classList.toggle("hidden", showBracket);
  document.getElementById("bracketTab").classList.toggle("active", showBracket);
  document.getElementById("oddsTab").classList.toggle("active", !showBracket);
  document.getElementById("bracketTab").setAttribute("aria-selected", String(showBracket));
  document.getElementById("oddsTab").setAttribute("aria-selected", String(!showBracket));
}

bracketBoard.addEventListener("click", event => {
  const button = event.target.closest(".player-pick[data-player]");
  if (!button || button.disabled) return;
  selectWinner(button.dataset.match, decodeURIComponent(button.dataset.player));
});

document.getElementById("projectBtn").addEventListener("click", projectDraw);
document.getElementById("clearBtn").addEventListener("click", clearPicks);
document.getElementById("bracketTab").addEventListener("click", () => showView("bracket"));
document.getElementById("oddsTab").addEventListener("click", () => showView("odds"));
document.getElementById("openOddsBtn").addEventListener("click", () => {
  showView("odds");
  document.querySelector(".workspace-main").scrollIntoView({ behavior: "smooth", block: "start" });
});

const accountPanel = document.getElementById("accountPanel");
const accountMenu = document.getElementById("accountMenu");
const accountButton = document.getElementById("accountButton");
const signInBtn = document.getElementById("signInBtn");

accountButton.addEventListener("click", () => {
  const willOpen = accountMenu.classList.contains("hidden");
  accountMenu.classList.toggle("hidden", !willOpen);
  accountButton.setAttribute("aria-expanded", String(willOpen));
});

document.addEventListener("click", event => {
  if (!accountPanel.contains(event.target)) {
    accountMenu.classList.add("hidden");
    accountButton.setAttribute("aria-expanded", "false");
  }
});

let firebaseModulesPromise;
let authInstancePromise;

async function firebaseModules() {
  if (!firebaseModulesPromise) {
    firebaseModulesPromise = Promise.all([
      import("https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js")
    ]).then(([app, auth]) => ({ app, auth }));
  }
  return firebaseModulesPromise;
}

async function getAuthInstance() {
  if (!authInstancePromise) {
    authInstancePromise = firebaseModules().then(({ app, auth }) => {
      const firebaseApp = app.getApps().some(candidate => candidate.name === "usopen-forecast")
        ? app.getApp("usopen-forecast")
        : app.initializeApp(firebaseConfig, "usopen-forecast");
      const instance = auth.getAuth(firebaseApp);
      instance.useDeviceLanguage();
      return instance;
    });
  }
  return authInstancePromise;
}

function updateAccount(user) {
  const guestPicks = !currentUser ? { ...selections } : null;
  currentUser = user ? {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName?.trim() || user.email?.split("@")[0] || "Player",
    photoURL: user.photoURL
  } : null;

  signInBtn.classList.toggle("hidden", Boolean(currentUser));
  accountPanel.classList.toggle("hidden", !currentUser);
  if (currentUser) {
    document.getElementById("accountName").textContent = currentUser.displayName;
    document.getElementById("accountEmail").textContent = currentUser.email || "Google account";
    const avatar = document.getElementById("accountAvatar");
    avatar.src = currentUser.photoURL || `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" rx="32" fill="#d8ff3e"/><text x="32" y="40" text-anchor="middle" font-family="Arial" font-size="25" font-weight="700" fill="#071837">${currentUser.displayName.charAt(0).toUpperCase()}</text></svg>`)}`;
    avatar.alt = `${currentUser.displayName} profile photo`;
  }
  if (currentUser && guestPicks && Object.keys(guestPicks).length && !localStorage.getItem(storageKey())) {
    selections = guestPicks;
    savePicks();
  } else {
    loadPicks();
  }
  render();
}

async function initializeAuth() {
  try {
    const [{ auth }, instance] = await Promise.all([firebaseModules(), getAuthInstance()]);
    await auth.getRedirectResult(instance);
    auth.onAuthStateChanged(instance, updateAccount);
  } catch {
    signInBtn.title = "Google sign-in is temporarily unavailable";
  }
}

signInBtn.addEventListener("click", async () => {
  signInBtn.disabled = true;
  try {
    const [{ auth }, instance] = await Promise.all([firebaseModules(), getAuthInstance()]);
    const provider = new auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    try {
      await auth.signInWithPopup(instance, provider);
    } catch (error) {
      const code = String(error?.code || "");
      if (["auth/popup-blocked", "auth/cancelled-popup-request", "auth/operation-not-supported-in-this-environment"].includes(code)) {
        await auth.signInWithRedirect(instance, provider);
        return;
      }
      throw error;
    }
  } catch (error) {
    const code = String(error?.code || "");
    const message = code === "auth/popup-closed-by-user"
      ? "Sign-in was closed before it finished."
      : code === "auth/unauthorized-domain"
        ? "Google sign-in is not enabled for this web address yet."
        : "Google sign-in is temporarily unavailable. Please try again.";
    showToast(message);
  } finally {
    signInBtn.disabled = false;
  }
});

document.getElementById("signOutBtn").addEventListener("click", async () => {
  try {
    const [{ auth }, instance] = await Promise.all([firebaseModules(), getAuthInstance()]);
    await auth.signOut(instance);
    accountMenu.classList.add("hidden");
    showToast("Signed out. Your guest bracket is still available on this device.");
  } catch {
    showToast("Sign-out did not finish. Please try again.");
  }
});

loadPicks();
renderOdds();
render();
initializeAuth();
