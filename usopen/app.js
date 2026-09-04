const firebaseConfig = {
  apiKey: "AIzaSyAM-yGDbkDPLUdUI-NdHsCUm5vhlXG0Z3M",
  authDomain: "world-cup-league-2026.firebaseapp.com",
  projectId: "world-cup-league-2026",
  storageBucket: "world-cup-league-2026.firebasestorage.app",
  messagingSenderId: "253099908614",
  appId: "1:253099908614:web:782fd709ac8f7056fe6d87"
};

const players = new Map();

function addPlayer(name, country, seed, rating, wikipediaTitle = name) {
  const record = { name, country, seed, rating, wikipediaTitle };
  players.set(name, record);
  return record;
}

[
  ["Alexander Zverev", "GER", 1, 94],
  ["Quentin Halys", "FRA", null, 59],
  ["Alejandro Tabilo", "CHI", 25, 70],
  ["Luciano Darderi", "ITA", 21, 73],
  ["Dane Sweeny", "AUS", null, 55],
  ["Yunchaokete Bu", "CHN", null, 56, "Bu Yunchaokete"],
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
  ["Gael Monfils", "FRA", null, 61, "Gaël Monfils"],
  ["Learner Tien", "USA", 14, 76],
  ["Taylor Fritz", "USA", 9, 83],
  ["Francisco Cerundolo", "ARG", 24, 72, "Francisco Cerúndolo"],
  ["Alexander Blockx", "BEL", 28, 68],
  ["Flavio Cobolli", "ITA", 5, 87],
  ["Daniil Medvedev", "—", 7, 84],
  ["Arthur Rinderknech", "FRA", 26, 68],
  ["Valentin Vacherot", "MON", 22, 75],
  ["Frances Tiafoe", "USA", 11, 80],
  ["Alex Michelsen", "USA", 16, 73],
  ["Daniel Merida", "ESP", null, 52, "Daniel Mérida"],
  ["Tomas Martin Etcheverry", "ARG", 27, 69, "Tomás Martín Etcheverry"],
  ["Mariano Navone", "ARG", null, 61],
  ["Ben Shelton", "USA", 8, 85],
  ["Denis Shapovalov", "CAN", null, 70],
  ["Jiri Lehecka", "CZE", 18, 76, "Jiří Lehečka"],
  ["Stefanos Tsitsipas", "GRE", null, 72],
  ["Alexander Bublik", "KAZ", 15, 79],
  ["Tommy Paul", "USA", 20, 77],
  ["Yibing Wu", "CHN", null, 63, "Wu Yibing"],
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
const playerDialog = document.getElementById("playerDialog");
const profileCache = new Map();
const profileDetailCache = new Map();
let photoObserver;

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

function playerInitials(name) {
  return name.split(" ").map(part => part[0]).slice(0, 2).join("").toUpperCase();
}

function normalizeImageUrl(url) {
  return url?.startsWith("//") ? `https:${url}` : url;
}

function loadPlayerSummary(player) {
  if (profileCache.has(player.name)) return profileCache.get(player.name);
  const endpoint = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(player.wikipediaTitle)}`;
  const request = fetch(endpoint, { headers: { Accept: "application/json" } })
    .then(response => {
      if (!response.ok) throw new Error(`Profile request failed: ${response.status}`);
      return response.json();
    })
    .then(data => ({
      description: data.description || "Professional tennis player",
      extract: data.extract || "",
      image: normalizeImageUrl(data.thumbnail?.source || data.originalimage?.source || ""),
      article: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(player.wikipediaTitle)}`
    }));
  profileCache.set(player.name, request);
  return request;
}

function cleanProfileValue(value) {
  return value.replace(/\[[^\]]*\]/g, "").replace(/\s+/g, " ").trim();
}

function loadPlayerDetails(player) {
  if (profileDetailCache.has(player.name)) return profileDetailCache.get(player.name);
  const params = new URLSearchParams({
    origin: "*",
    action: "parse",
    page: player.wikipediaTitle,
    prop: "text",
    format: "json",
    formatversion: "2"
  });
  const request = fetch(`https://en.wikipedia.org/w/api.php?${params}`)
    .then(response => {
      if (!response.ok) throw new Error(`Player details request failed: ${response.status}`);
      return response.json();
    })
    .then(data => {
      const documentFragment = new DOMParser().parseFromString(data.parse?.text || "", "text/html");
      const details = {};
      documentFragment.querySelectorAll("table.infobox tr").forEach(row => {
        const heading = cleanProfileValue(row.querySelector("th")?.textContent || "").toLowerCase();
        const value = cleanProfileValue(row.querySelector("td")?.textContent || "");
        if (heading && value && !details[heading]) details[heading] = value;
      });
      return details;
    });
  profileDetailCache.set(player.name, request);
  return request;
}

function updatePlayerPhotos(player, summary) {
  if (!summary.image) return;
  document.querySelectorAll(`[data-player-photo="${CSS.escape(encodeURIComponent(player.name))}"]`).forEach(image => {
    image.addEventListener("load", () => image.classList.add("loaded"), { once: true });
    image.src = summary.image;
    if (image.complete) image.classList.add("loaded");
  });
}

function observePlayerPhotos() {
  if (!("IntersectionObserver" in window)) return;
  if (!photoObserver) {
    photoObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const image = entry.target;
        photoObserver.unobserve(image);
        const player = players.get(decodeURIComponent(image.dataset.playerPhoto || ""));
        if (player) loadPlayerSummary(player).then(summary => updatePlayerPhotos(player, summary)).catch(() => {});
      });
    }, { rootMargin: "240px" });
  }
  document.querySelectorAll("img[data-player-photo]:not([src])").forEach(image => photoObserver.observe(image));
}

function detailValue(details, labels, fallback = "Not listed") {
  const key = Object.keys(details).find(candidate => labels.some(label => candidate === label || candidate.startsWith(`${label} `)));
  return key ? details[key] : fallback;
}

function profileStat(label, value) {
  return `<div class="profile-stat"><span>${escapeHTML(label)}</span><strong>${escapeHTML(value)}</strong></div>`;
}

function renderProfileStats(player, details = null) {
  const titleChance = titleOdds.find(item => item.player.name === player.name)?.probability || 0;
  const ranking = details ? detailValue(details, ["current ranking"]) : "Loading…";
  const coach = details ? detailValue(details, ["coach", "coach(es)"]) : "Loading…";
  const plays = details ? detailValue(details, ["plays"]) : "Loading…";
  const born = details ? detailValue(details, ["born"]) : "Loading…";
  return [
    profileStat("Tournament entry", player.seed ? `Seed #${player.seed}` : "Unseeded"),
    profileStat("Model title odds", formatPercent(titleChance)),
    profileStat("ATP ranking", ranking),
    profileStat("Coach", coach),
    profileStat("Plays", plays),
    profileStat("Born", born)
  ].join("");
}

async function openPlayerProfile(name) {
  const player = players.get(name);
  if (!player) return;
  document.getElementById("profileName").textContent = player.name;
  document.getElementById("profileDescription").textContent = `${player.country} · Loading public profile…`;
  document.getElementById("profilePhoto").textContent = playerInitials(player.name);
  document.getElementById("profileStats").innerHTML = renderProfileStats(player);
  document.getElementById("profileBio").textContent = "Loading biography and current player information…";
  document.getElementById("profileWikipedia").href = `https://en.wikipedia.org/wiki/${encodeURIComponent(player.wikipediaTitle)}`;
  if (!playerDialog.open) playerDialog.showModal();

  const [summaryResult, detailsResult] = await Promise.allSettled([
    loadPlayerSummary(player),
    loadPlayerDetails(player)
  ]);
  if (document.getElementById("profileName").textContent !== player.name) return;

  if (summaryResult.status === "fulfilled") {
    const summary = summaryResult.value;
    document.getElementById("profileDescription").textContent = `${player.country} · ${summary.description}`;
    document.getElementById("profileBio").textContent = summary.extract || "No public biography is available yet.";
    document.getElementById("profileWikipedia").href = summary.article;
    if (summary.image) {
      document.getElementById("profilePhoto").innerHTML = `<img src="${escapeHTML(summary.image)}" alt="${escapeHTML(player.name)}">`;
      updatePlayerPhotos(player, summary);
    }
  } else {
    document.getElementById("profileDescription").textContent = `${player.country} · Professional tennis player`;
    document.getElementById("profileBio").textContent = "The public profile could not be loaded right now. Tournament and forecast details are still available below.";
  }

  document.getElementById("profileStats").innerHTML = renderProfileStats(
    player,
    detailsResult.status === "fulfilled" ? detailsResult.value : {}
  );
}

function playerRow(match, ref, player) {
  const selected = player && selections[match.id] === player.name;
  const name = player?.name || sourceLabel(ref);
  const country = player?.country || "—";
  const seed = player?.seed ? `#${player.seed}` : "";
  const encodedName = player ? encodeURIComponent(player.name) : "";
  const initials = player ? player.name.split(" ").map(part => part[0]).slice(0, 2).join("") : "?";

  return `
    <div class="player-row">
      <button class="profile-trigger" type="button" data-profile="${encodedName}" ${player ? "title=\"View player profile\"" : "disabled"}
        aria-label="${player ? `Open ${escapeHTML(player.name)} profile` : "Player to be decided"}">
        <span aria-hidden="true">${escapeHTML(initials)}</span>
        ${player ? `<img data-player-photo="${encodedName}" alt="" loading="lazy">` : ""}
      </button>
      <button class="player-pick${selected ? " selected" : ""}" type="button"
        data-match="${escapeHTML(match.id)}" data-player="${encodedName}" ${player ? "" : "disabled"}
        aria-pressed="${selected ? "true" : "false"}">
        <span class="player-name">${escapeHTML(name)}</span>
        <span class="country-badge">${escapeHTML(country)}</span>
        <span class="seed">${escapeHTML(seed)}</span>
        <span class="pick-check" aria-hidden="true">✓</span>
      </button>
    </div>`;
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
  const openRound = rounds[0];
  const treeRounds = rounds.slice(1);
  const cardWidth = 254;
  const cardHeight = 158;
  const roundGap = 72;
  const basePitch = 176;
  const treeWidth = treeRounds.length * cardWidth + (treeRounds.length - 1) * roundGap;
  const treeHeight = treeRounds[0].matches.length * basePitch;

  const cardPosition = (depth, index) => {
    const center = basePitch * Math.pow(2, depth) * (index + .5);
    return { x: depth * (cardWidth + roundGap), y: center - cardHeight / 2, center };
  };

  const connectors = treeRounds.slice(0, -1).flatMap((round, depth) =>
    round.matches.map((match, index) => {
      const start = cardPosition(depth, index);
      const parent = cardPosition(depth + 1, Math.floor(index / 2));
      const x1 = start.x + cardWidth;
      const x2 = parent.x;
      const bend = x1 + roundGap / 2;
      return `<path d="M ${x1} ${start.center} H ${bend} V ${parent.center} H ${x2}" />`;
    })
  ).join("");

  const treeCards = treeRounds.flatMap((round, depth) =>
    round.matches.map((match, index) => {
      const position = cardPosition(depth, index);
      return renderMatch(round, match).replace(
        '<article class="match-card',
        `<article style="left:${position.x}px;top:${position.y}px" class="match-card`
      );
    })
  ).join("");

  bracketBoard.innerHTML = `
    <section class="open-round" aria-labelledby="heading-${openRound.id}">
      <div class="open-round-heading">
        <h2 id="heading-${openRound.id}">Today’s unfinished matches</h2>
        <span>${escapeHTML(openRound.date)} · All times Central</span>
      </div>
      <div class="open-match-grid">${openRound.matches.map(match => renderMatch(openRound, match)).join("")}</div>
    </section>
    <section class="bracket-tree" aria-label="Connected tournament bracket"
      style="--card-width:${cardWidth}px;--card-height:${cardHeight}px;--tree-gap:${roundGap}px;--tree-width:${treeWidth}px;--tree-height:${treeHeight}px">
      <div class="tree-round-headers" style="grid-template-columns:repeat(${treeRounds.length}, ${cardWidth}px)">
        ${treeRounds.map(round => `<div class="tree-round-header"><h2>${escapeHTML(round.title)}</h2><span>${escapeHTML(round.date)}</span></div>`).join("")}
      </div>
      <div class="tree-stage">
        <svg class="bracket-connectors" viewBox="0 0 ${treeWidth} ${treeHeight}" aria-hidden="true">${connectors}</svg>
        ${treeCards}
      </div>
    </section>`;

  observePlayerPhotos();
}

function renderOdds() {
  const maxOdds = titleOdds[0]?.probability || 1;
  oddsList.innerHTML = titleOdds.slice(0, 5).map(({ player, probability }) => `
    <li>
      <button class="odds-player profile-link" type="button" data-profile="${encodeURIComponent(player.name)}"><strong>${escapeHTML(player.name)}</strong><span>${escapeHTML(player.country)}${player.seed ? ` · Seed ${player.seed}` : ""}</span></button>
      <span class="odds-value">${formatPercent(probability)}</span>
    </li>`).join("");

  oddsTableBody.innerHTML = titleOdds.map(({ player, probability }, index) => `
    <tr>
      <td>${index + 1}</td>
      <td><button class="table-player profile-link" type="button" data-profile="${encodeURIComponent(player.name)}"><span class="country-badge">${escapeHTML(player.country)}</span>${escapeHTML(player.name)}</button></td>
      <td>${player.seed || "—"}</td>
      <td><strong>${formatPercent(probability)}</strong><span class="odds-bar" aria-hidden="true"><span style="width:${Math.max(1.5, probability / maxOdds * 100).toFixed(1)}%"></span></span></td>
      <td>${player.rating}</td>
    </tr>`).join("");

  observePlayerPhotos();
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

document.addEventListener("click", event => {
  const trigger = event.target.closest("[data-profile]");
  if (!trigger || trigger.disabled) return;
  openPlayerProfile(decodeURIComponent(trigger.dataset.profile));
});

document.getElementById("closeProfileBtn").addEventListener("click", () => playerDialog.close());
playerDialog.addEventListener("click", event => {
  if (event.target === playerDialog) playerDialog.close();
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
    signInBtn.title = "Gmail sign-in is temporarily unavailable";
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
        ? "Gmail sign-in is not enabled for this web address yet."
        : "Gmail sign-in is temporarily unavailable. Please try again.";
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
