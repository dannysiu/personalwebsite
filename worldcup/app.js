/*
Danz World Cup League 2026
Main client-side app for:
- Google login with Firebase Auth
- Firestore saves for users, group picks, bonus answers, and admin results
- Admin controls for banned players
- Leaderboard scoring

Scoring notes:
- Group pick that finishes top 2 = 2 points
- Group pick that finishes 3rd and qualifies = 1 point
- Round of 32 correct winner = 3 points
- Round of 32 correct extra time / penalties pick = 1 point
- Opening bonus quiz = 1 point per correct answer
- Yellow card bonus question is correct if within 10 of the official total
*/

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAM-yGDbkDPLUdUI-NdHsCUm5vhlXG0Z3M",
  authDomain: "world-cup-league-2026.firebaseapp.com",
  projectId: "world-cup-league-2026",
  storageBucket: "world-cup-league-2026.firebasestorage.app",
  messagingSenderId: "253099908614",
  appId: "1:253099908614:web:782fd709ac8f7056fe6d87",
  measurementId: "G-GCP8Q7TZB3"
};

const ADMIN_EMAILS = ["chat2danny@gmail.com", "jongreenofficial@gmail.com"];
const BONUS_LOCK_TIME = new Date("2026-06-11T14:00:00-05:00");
const GROUP_LOCKS_URL = "https://worldcup-score-ticker.chat2danny21.workers.dev/group-locks";

let groupLockTimes = {};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

let currentUser = null;

const groups = {
  A: ["🇲🇽 Mexico", "🇿🇦 South Africa", "🇰🇷 South Korea", "🇨🇿 Czechia"],
  B: ["🇨🇦 Canada", "🇧🇦 Bosnia and Herzegovina", "🇶🇦 Qatar", "🇨🇭 Switzerland"],
  C: ["🇧🇷 Brazil", "🇲🇦 Morocco", "🇭🇹 Haiti", "🏴 Scotland"],
  D: ["🇺🇸 USA", "🇵🇾 Paraguay", "🇦🇺 Australia", "🇹🇷 Türkiye"],
  E: ["🇩🇪 Germany", "🇨🇼 Curaçao", "🇨🇮 Ivory Coast", "🇪🇨 Ecuador"],
  F: ["🇳🇱 Netherlands", "🇯🇵 Japan", "🇹🇳 Tunisia", "🇸🇪 Sweden"],
  G: ["🇧🇪 Belgium", "🇪🇬 Egypt", "🇮🇷 Iran", "🇳🇿 New Zealand"],
  H: ["🇪🇸 Spain", "🇨🇻 Cape Verde", "🇸🇦 Saudi Arabia", "🇺🇾 Uruguay"],
  I: ["🇫🇷 France", "🇸🇳 Senegal", "🇮🇶 Iraq", "🇳🇴 Norway"],
  J: ["🇦🇷 Argentina", "🇩🇿 Algeria", "🇦🇹 Austria", "🇯🇴 Jordan"],
  K: ["🇵🇹 Portugal", "🇨🇩 Congo DR", "🇺🇿 Uzbekistan", "🇨🇴 Colombia"],
  L: ["🏴 England", "🇭🇷 Croatia", "🇬🇭 Ghana", "🇵🇦 Panama"]
};

function cleanCountryName(team) {
  return team.replace(/^[^\p{L}\p{N}]+/u, "").trim();
}

function sortTeamsAlphabetically(teams) {
  return [...teams].sort((a, b) =>
    cleanCountryName(a).localeCompare(cleanCountryName(b))
  );
}

const countryOptions = sortTeamsAlphabetically([...new Set(Object.values(groups).flat())]);

const round32Flags = {
  "Argentina": "🇦🇷",
  "Australia": "🇦🇺",
  "Belgium": "🇧🇪",
  "Bosnia and Herzegovina": "🇧🇦",
  "Brazil": "🇧🇷",
  "Canada": "🇨🇦",
  "Cape Verde": "🇨🇻",
  "Egypt": "🇪🇬",
  "France": "🇫🇷",
  "Germany": "🇩🇪",
  "Ivory Coast": "🇨🇮",
  "Japan": "🇯🇵",
  "Mexico": "🇲🇽",
  "Morocco": "🇲🇦",
  "Netherlands": "🇳🇱",
  "Norway": "🇳🇴",
  "Paraguay": "🇵🇾",
  "South Africa": "🇿🇦",
  "Spain": "🇪🇸",
  "Sweden": "🇸🇪",
  "Switzerland": "🇨🇭",
  "United States": "🇺🇸"
};

const round32Matches = [
  {
    id: "73",
    label: "Match 73",
    home: "South Africa",
    away: "Canada",
    startTime: "2026-06-28T12:00:00-07:00",
    venue: "Los Angeles"
  },
  {
    id: "76",
    label: "Match 76",
    home: "Brazil",
    away: "Japan",
    startTime: "2026-06-29T12:00:00-05:00",
    venue: "Houston"
  },
  {
    id: "74",
    label: "Match 74",
    home: "Germany",
    away: "Paraguay",
    startTime: "2026-06-29T16:30:00-04:00",
    venue: "Boston"
  },
  {
    id: "75",
    label: "Match 75",
    home: "Netherlands",
    away: "Morocco",
    startTime: "2026-06-29T19:00:00-06:00",
    venue: "Monterrey"
  },
  {
    id: "78",
    label: "Match 78",
    home: "Ivory Coast",
    away: "Norway",
    startTime: "2026-06-30T12:00:00-05:00",
    venue: "Dallas"
  },
  {
    id: "77",
    label: "Match 77",
    home: "France",
    away: "Sweden",
    startTime: "2026-06-30T17:00:00-04:00",
    venue: "New York / New Jersey"
  },
  {
    id: "79",
    label: "Match 79",
    home: "Mexico",
    away: "3rd Group C/E",
    startTime: "2026-06-30T19:00:00-06:00",
    venue: "Mexico City"
  },
  {
    id: "80",
    label: "Match 80",
    home: "Winner Group L",
    away: "3rd Group I/J/K",
    startTime: "2026-07-01T12:00:00-04:00",
    venue: "Atlanta"
  },
  {
    id: "82",
    label: "Match 82",
    home: "Belgium",
    away: "3rd Group A/I/J",
    startTime: "2026-07-01T13:00:00-07:00",
    venue: "Santa Clara"
  },
  {
    id: "81",
    label: "Match 81",
    home: "United States",
    away: "Bosnia and Herzegovina",
    startTime: "2026-07-01T17:00:00-07:00",
    venue: "Seattle"
  },
  {
    id: "84",
    label: "Match 84",
    home: "Spain",
    away: "Runner-up Group J",
    startTime: "2026-07-02T12:00:00-07:00",
    venue: "Los Angeles"
  },
  {
    id: "83",
    label: "Match 83",
    home: "Runner-up Group K",
    away: "Runner-up Group L",
    startTime: "2026-07-02T19:00:00-04:00",
    venue: "Toronto"
  },
  {
    id: "85",
    label: "Match 85",
    home: "Switzerland",
    away: "3rd Group G/J",
    startTime: "2026-07-02T20:00:00-07:00",
    venue: "Vancouver"
  },
  {
    id: "88",
    label: "Match 88",
    home: "Australia",
    away: "Egypt",
    startTime: "2026-07-03T13:00:00-05:00",
    venue: "Dallas"
  },
  {
    id: "86",
    label: "Match 86",
    home: "Argentina",
    away: "Cape Verde",
    startTime: "2026-07-03T18:00:00-04:00",
    venue: "Miami"
  },
  {
    id: "87",
    label: "Match 87",
    home: "Winner Group K",
    away: "3rd Group E/I/L",
    startTime: "2026-07-03T20:30:00-05:00",
    venue: "Kansas City"
  }
];

function round32TeamLabel(team) {
  const flag = round32Flags[team];
  return flag ? `${flag} ${team}` : team;
}

function round32MatchupLabel(match) {
  return `${round32TeamLabel(match.home)} vs ${round32TeamLabel(match.away)}`;
}

const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const userInfo = document.getElementById("userInfo");

const usernameBox = document.getElementById("usernameBox");
const usernameInput = document.getElementById("usernameInput");
const saveUsernameBtn = document.getElementById("saveUsernameBtn");
const usernameStatus = document.getElementById("usernameStatus");

const groupPicksSection = document.getElementById("groupPicksSection");
const groupPicksContent = document.getElementById("groupPicksContent");
const toggleGroupPicksBtn = document.getElementById("toggleGroupPicksBtn");
const groupPicksForm = document.getElementById("groupPicksForm");
const saveGroupPicksBtn = document.getElementById("saveGroupPicksBtn");
const groupPicksStatus = document.getElementById("groupPicksStatus");

const round32PicksSection = document.getElementById("round32PicksSection");
const round32PicksForm = document.getElementById("round32PicksForm");
const saveRound32PicksBtn = document.getElementById("saveRound32PicksBtn");
const round32PicksStatus = document.getElementById("round32PicksStatus");

const adminSection = document.getElementById("adminSection");
const adminGroupResultsForm = document.getElementById("adminGroupResultsForm");
const saveGroupResultsBtn = document.getElementById("saveGroupResultsBtn");
const groupResultsStatus = document.getElementById("groupResultsStatus");
const adminRound32ResultsForm = document.getElementById("adminRound32ResultsForm");
const saveRound32ResultsBtn = document.getElementById("saveRound32ResultsBtn");
const round32ResultsStatus = document.getElementById("round32ResultsStatus");
const refreshLeaderboardBtn = document.getElementById("refreshLeaderboardBtn");

const playerPicksViewer = document.getElementById("playerPicksViewer");
const playerPicksTitle = document.getElementById("playerPicksTitle");
const playerPicksContent = document.getElementById("playerPicksContent");
const closePlayerPicksBtn = document.getElementById("closePlayerPicksBtn");

let bonusSection;
let bonusContent;
let bonusForm;
let saveBonusBtn;
let bonusStatus;
let adminPlayerList;
let adminBonusResultsForm;
let saveBonusResultsBtn;
let bonusResultsStatus;
let resetGroupResultsBtn;

injectBonusSection();
injectAdminPlayerManagement();
injectAdminBonusResults();
injectAdminResetButtons();
moveRefreshLeaderboardButton();

toggleGroupPicksBtn?.addEventListener("click", () => {
  const isHidden = groupPicksContent.style.display === "none";
  groupPicksContent.style.display = isHidden ? "block" : "none";
  toggleGroupPicksBtn.textContent = isHidden ? "Minimize" : "Expand";
});

loginBtn.addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error("Login failed:", error);
    alert("Google login failed. Check console.");
  }
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
});

saveUsernameBtn?.addEventListener("click", async () => {
  if (!currentUser) return alert("Please sign in first.");

  const username = usernameInput.value.trim();

  if (!username) return alert("Username cannot be empty.");
  if (username.length > 20) return alert("Username must be 20 characters or less.");
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return alert("Use one word only: letters, numbers, and underscores.");
  }

  await setDoc(doc(db, "users", currentUser.uid), {
    username,
    updatedAt: new Date().toISOString()
  }, { merge: true });

  usernameStatus.textContent = `✅ Username changed to ${username}!`;

  if (ADMIN_EMAILS.includes(currentUser.email)) {
    await renderLeaderboardFromFirestore();
  } else {
    await renderPublicLeaderboard();
  }
});

onAuthStateChanged(auth, async (user) => {
  currentUser = user;

  if (!user) {
    loginBtn.style.display = "inline-block";
    logoutBtn.style.display = "none";
    userInfo.textContent = "Not signed in";

    if (usernameBox) usernameBox.style.display = "none";
    groupPicksSection.style.display = "none";
    round32PicksSection.style.display = "none";
    bonusSection.style.display = "none";
    if (adminSection) adminSection.style.display = "none";

    await renderPublicLeaderboard();
    return;
  }

  loginBtn.style.display = "none";
  logoutBtn.style.display = "inline-block";
  userInfo.textContent = `Signed in as ${user.email}`;

  const userRef = doc(db, "users", user.uid);
  let userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email,
      googleDisplayName: user.displayName || "",
      photoURL: user.photoURL || "",
      banned: false,
      lastLogin: new Date().toISOString()
    });
  } else {
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email,
      googleDisplayName: user.displayName || "",
      photoURL: user.photoURL || "",
      lastLogin: new Date().toISOString()
    }, { merge: true });
  }

  userSnap = await getDoc(userRef);

  if (usernameBox) usernameBox.style.display = "block";
  if (userSnap.exists() && usernameInput) {
    usernameInput.value = userSnap.data().username || "";
  }

  groupPicksSection.style.display = "block";
  round32PicksSection.style.display = "block";
  bonusSection.style.display = "block";

  await loadGroupLockTimes();
  renderGroupPicks();
  renderRound32Picks();
  renderBonusQuiz();

  await loadExistingGroupPicks();
  await loadExistingRound32Picks();
  await loadExistingBonusAnswers();

  if (ADMIN_EMAILS.includes(user.email)) {
    adminSection.style.display = "block";
    renderAdminGroupResults();
    renderAdminRound32Results();
    renderAdminBonusResults();
    await loadExistingGroupResults();
    await loadExistingRound32Results();
    await loadExistingBonusResults();
    await renderAdminPlayerList();
    await renderLeaderboardFromFirestore();
  } else {
    await renderPublicLeaderboard();
  }
});

function injectBonusSection() {
  bonusSection = document.createElement("section");
  bonusSection.className = "card";
  bonusSection.id = "bonusSection";
  bonusSection.style.display = "none";

  bonusSection.innerHTML = `
    <h2>🎯 Bonus Questions</h2>
    <button id="toggleBonusBtn" class="secondary-btn">Show / Hide Bonus Questions</button>
    <div id="bonusContent" style="display:none;">
      <p>
        Lock these in before the World Cup starts. Opening bonus questions are worth points after the tournament ends.
      </p>
      <p>
        Weekly bonus questions will also appear here later.
      </p>
      <p class="lock-note">Bonus answers lock: <strong>June 11, 2026 at 2:00 PM CT</strong>.</p>
      <div id="bonusForm"></div>
      <button id="saveBonusBtn">Save Bonus Answers</button>
      <p id="bonusStatus"></p>
    </div>
  `;

  groupPicksSection.insertAdjacentElement("afterend", bonusSection);

  bonusContent = document.getElementById("bonusContent");
  bonusForm = document.getElementById("bonusForm");
  saveBonusBtn = document.getElementById("saveBonusBtn");
  bonusStatus = document.getElementById("bonusStatus");

  document.getElementById("toggleBonusBtn").addEventListener("click", () => {
    bonusContent.style.display = bonusContent.style.display === "none" ? "block" : "none";
  });

  saveBonusBtn.addEventListener("click", saveBonusAnswers);
}

function injectAdminPlayerManagement() {
  if (!adminSection) return;

  const box = document.createElement("div");
  box.innerHTML = `
    <h3>Player Payment / Ban Controls</h3>
    <p class="mini-note">All signed-in players appear on the leaderboard unless banned.</p>
    <div id="adminPlayerList"></div>
  `;

  adminSection.insertBefore(box, adminSection.firstChild);
  adminPlayerList = document.getElementById("adminPlayerList");
}

function injectAdminBonusResults() {
  if (!adminSection) return;

  const box = document.createElement("div");
  box.innerHTML = `
    <h3>Bonus Answer Key</h3>
    <p class="mini-note">Set the correct bonus answers here. Each correct answer is worth 1 point.</p>
    <div id="adminBonusResultsForm"></div>
    <button id="saveBonusResultsBtn">Save Bonus Answer Key</button>
    <p id="bonusResultsStatus"></p>
  `;

  adminSection.appendChild(box);

  adminBonusResultsForm = document.getElementById("adminBonusResultsForm");
  saveBonusResultsBtn = document.getElementById("saveBonusResultsBtn");
  bonusResultsStatus = document.getElementById("bonusResultsStatus");

  saveBonusResultsBtn.addEventListener("click", saveBonusResults);
}

function injectAdminResetButtons() {
  if (!adminSection) return;

  resetGroupResultsBtn = document.createElement("button");
  resetGroupResultsBtn.textContent = "Reset Group Results";

  saveGroupResultsBtn.insertAdjacentElement("afterend", resetGroupResultsBtn);
  resetGroupResultsBtn.addEventListener("click", resetGroupResults);
}

function moveRefreshLeaderboardButton() {
  if (!refreshLeaderboardBtn || !adminSection) return;

  adminSection.appendChild(refreshLeaderboardBtn);
}

async function loadGroupLockTimes() {
  try {
    const res = await fetch(GROUP_LOCKS_URL);
    const data = await res.json();
    groupLockTimes = data.locks || {};
  } catch (err) {
    console.error("Failed to load group lock times:", err);
    groupLockTimes = {};
  }
}

function groupIsLocked(groupName) {
  const lockTime = groupLockTimes[groupName];
  if (!lockTime) return false;

  return new Date() >= new Date(lockTime);
}

function allGroupPicksAreLocked() {
  return Object.keys(groups).every(groupName => groupIsLocked(groupName));
}

function groupLockLabel(groupName) {
  const lockTime = groupLockTimes[groupName];

  if (!lockTime) {
    return "Locks when this group's first match starts.";
  }

  return new Date(lockTime).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function bonusAnswersAreLocked() {
  return new Date() >= BONUS_LOCK_TIME;
}

function renderGroupPicks() {
  groupPicksForm.innerHTML = "";

  Object.entries(groups).forEach(([groupName, teams]) => {
    const sortedTeams = sortTeamsAlphabetically(teams);
    const locked = groupIsLocked(groupName);

    const wrapper = document.createElement("div");
    wrapper.className = "pick-card";

    wrapper.innerHTML = `
      <h3>Group ${groupName} ${locked ? "🔒" : ""}</h3>
      <p class="lock-note">Locks: <strong>${groupLockLabel(groupName)}</strong></p>

      <label>Pick #1</label>
      <select id="group-${groupName}-first" ${locked ? "disabled" : ""}>
        <option value="">Select team</option>
        ${sortedTeams.map(team => `<option value="${team}">${team}</option>`).join("")}
      </select>

      <label>Pick #2</label>
      <select id="group-${groupName}-second" ${locked ? "disabled" : ""}>
        <option value="">Select team</option>
        ${sortedTeams.map(team => `<option value="${team}">${team}</option>`).join("")}
      </select>
    `;

    groupPicksForm.appendChild(wrapper);
  });

  if (allGroupPicksAreLocked()) {
    groupPicksStatus.textContent = "🔒 All group picks are locked.";
    saveGroupPicksBtn.disabled = true;
    saveGroupPicksBtn.textContent = "Group Picks Locked";
  } else {
    saveGroupPicksBtn.disabled = false;
    saveGroupPicksBtn.textContent = "Save Group Picks";
  }
}

async function loadExistingGroupPicks() {
  const snap = await getDoc(doc(db, "groupPicks", currentUser.uid));
  if (!snap.exists()) return;

  const data = snap.data();

  Object.entries(data.picks || {}).forEach(([groupName, pick]) => {
    const first = document.getElementById(`group-${groupName}-first`);
    const second = document.getElementById(`group-${groupName}-second`);

    if (first) first.value = pick.first || "";
    if (second) second.value = pick.second || "";
  });

  if (allGroupPicksAreLocked()) {
    groupPicksStatus.textContent = "🔒 All group picks are locked.";
  } else {
    groupPicksStatus.textContent = "Loaded saved group picks.";
  }
}

saveGroupPicksBtn.addEventListener("click", async () => {
  if (allGroupPicksAreLocked()) return alert("All group picks are locked.");

  const existingSnap = await getDoc(doc(db, "groupPicks", currentUser.uid));
  const picks = existingSnap.exists() ? existingSnap.data().picks || {} : {};

  let savedAnyUnlockedGroup = false;

  for (const groupName of Object.keys(groups)) {
    if (groupIsLocked(groupName)) continue;

    const first = document.getElementById(`group-${groupName}-first`).value;
    const second = document.getElementById(`group-${groupName}-second`).value;

    if (!first || !second) return alert(`Pick both teams for Group ${groupName}.`);
    if (first === second) return alert(`Group ${groupName}: picks cannot be the same.`);

    picks[groupName] = { first, second };
    savedAnyUnlockedGroup = true;
  }

  if (!savedAnyUnlockedGroup) {
    return alert("No unlocked groups are available to save.");
  }

  await setDoc(doc(db, "groupPicks", currentUser.uid), {
    uid: currentUser.uid,
    email: currentUser.email,
    picks,
    scoring: { topTwo: 2, thirdPlaceQualifier: 1, eliminated: 0 },
    updatedAt: new Date().toISOString()
  }, { merge: true });

  groupPicksStatus.textContent = "✅ Group picks saved!";
});

function round32MatchIsLocked(match) {
  return new Date() >= new Date(match.startTime);
}

function allRound32MatchesAreLocked() {
  return round32Matches.every(match => round32MatchIsLocked(match));
}

function round32MatchTimeLabel(match) {
  return new Date(match.startTime).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function renderRound32Picks() {
  round32PicksForm.innerHTML = "";

  round32Matches.forEach(match => {
    const locked = round32MatchIsLocked(match);
    const wrapper = document.createElement("div");
    wrapper.className = "pick-card";
    const matchupLabel = round32MatchupLabel(match);
    const homeLabel = round32TeamLabel(match.home);
    const awayLabel = round32TeamLabel(match.away);

    wrapper.innerHTML = `
      <h3>${escapeHTML(matchupLabel)} ${locked ? "🔒" : ""}</h3>
      <p class="lock-note">Kickoff: <strong>${round32MatchTimeLabel(match)}</strong> · ${escapeHTML(match.venue)}</p>

      <label>Winner</label>
      <select id="round32-${match.id}-winner" ${locked ? "disabled" : ""}>
        <option value="">Select winner</option>
        <option value="${escapeHTML(match.home)}">${escapeHTML(homeLabel)}</option>
        <option value="${escapeHTML(match.away)}">${escapeHTML(awayLabel)}</option>
      </select>

      <label class="checkbox-row">
        <input type="checkbox" id="round32-${match.id}-extraTimeOrPenalties" ${locked ? "disabled" : ""} />
        Goes to extra time or penalties
      </label>
    `;

    round32PicksForm.appendChild(wrapper);
  });

  if (allRound32MatchesAreLocked()) {
    round32PicksStatus.textContent = "🔒 All Round of 32 picks are locked.";
    saveRound32PicksBtn.disabled = true;
    saveRound32PicksBtn.textContent = "Round of 32 Picks Locked";
  } else {
    saveRound32PicksBtn.disabled = false;
    saveRound32PicksBtn.textContent = "Save Round of 32 Picks";
  }
}

async function loadExistingRound32Picks() {
  const snap = await getDoc(doc(db, "round32Picks", currentUser.uid));
  if (!snap.exists()) return;

  const data = snap.data();

  Object.entries(data.picks || {}).forEach(([matchId, pick]) => {
    setValue(`round32-${matchId}-winner`, pick.winner);

    const extraTimeOrPenalties = document.getElementById(`round32-${matchId}-extraTimeOrPenalties`);
    if (extraTimeOrPenalties) {
      extraTimeOrPenalties.checked = !!pick.extraTimeOrPenalties;
    }
  });

  if (allRound32MatchesAreLocked()) {
    round32PicksStatus.textContent = "🔒 All Round of 32 picks are locked.";
  } else {
    round32PicksStatus.textContent = "Loaded saved Round of 32 picks.";
  }
}

saveRound32PicksBtn?.addEventListener("click", async () => {
  if (!currentUser) return alert("Please sign in first.");
  if (allRound32MatchesAreLocked()) return alert("All Round of 32 picks are locked.");

  const existingSnap = await getDoc(doc(db, "round32Picks", currentUser.uid));
  const picks = existingSnap.exists() ? existingSnap.data().picks || {} : {};

  let savedAnyUnlockedMatch = false;

  for (const match of round32Matches) {
    if (round32MatchIsLocked(match)) continue;

    const winner = getValue(`round32-${match.id}-winner`);
    const extraTimeOrPenalties =
      document.getElementById(`round32-${match.id}-extraTimeOrPenalties`)?.checked || false;

    if (!winner) return alert(`Pick a winner for ${match.label}.`);

    picks[match.id] = { winner, extraTimeOrPenalties };
    savedAnyUnlockedMatch = true;
  }

  if (!savedAnyUnlockedMatch) {
    return alert("No unlocked Round of 32 matches are available to save.");
  }

  await setDoc(doc(db, "round32Picks", currentUser.uid), {
    uid: currentUser.uid,
    email: currentUser.email,
    picks,
    scoring: { winner: 3, extraTimeOrPenalties: 1 },
    updatedAt: new Date().toISOString()
  }, { merge: true });

  round32PicksStatus.textContent = "✅ Round of 32 picks saved!";
});

function renderBonusQuiz() {
  bonusForm.innerHTML = `
    <div class="pick-card">
      <label>1. Which country will score the most goals in the tournament?</label>
      <select id="bonus-mostGoalsCountry">
        <option value="">Select country</option>
        ${countryOptions.map(c => `<option value="${c}">${c}</option>`).join("")}
      </select>
    </div>

    <div class="pick-card">
      <label>2. How many yellow cards total in the tournament? <span class="yellow-note">(within 10 = correct)</span></label>
      <input id="bonus-yellowCards" type="number" min="0" />
    </div>

    <div class="pick-card">
      <label>3. When will the USA get knocked out?</label>
      <select id="bonus-usaOut">
        <option value="">Select stage</option>
        <option value="Group Stage">Group Stage</option>
        <option value="Round of 32">Round of 32</option>
        <option value="Round of 16">Round of 16</option>
        <option value="Quarterfinals">Quarterfinals</option>
        <option value="Semifinals">Semifinals</option>
        <option value="Final">Final</option>
        <option value="USA wins the World Cup">USA wins the World Cup</option>
      </select>
    </div>

    <div class="pick-card">
      <label>4. Name 1 team that will make the semifinals.</label>
      <select id="bonus-semifinalist">
        <option value="">Select country</option>
        ${countryOptions.map(c => `<option value="${c}">${c}</option>`).join("")}
      </select>
    </div>

    <div class="pick-card">
      <label>5. Who will win the 2026 FIFA World Cup?</label>
      <select id="bonus-winner">
        <option value="">Select country</option>
        ${countryOptions.map(c => `<option value="${c}">${c}</option>`).join("")}
      </select>
    </div>
  `;

  if (bonusAnswersAreLocked()) {
    bonusStatus.textContent = "🔒 Bonus answers are locked.";
    saveBonusBtn.disabled = true;
    saveBonusBtn.textContent = "Bonus Answers Locked";
    ["bonus-mostGoalsCountry", "bonus-yellowCards", "bonus-usaOut", "bonus-semifinalist", "bonus-winner"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = true;
    });
  }
}

async function loadExistingBonusAnswers() {
  const snap = await getDoc(doc(db, "bonusAnswers", currentUser.uid));
  if (!snap.exists()) return;

  const answers = snap.data().answers || {};

  setValue("bonus-mostGoalsCountry", answers.mostGoalsCountry);
  setValue("bonus-yellowCards", answers.yellowCards);
  setValue("bonus-usaOut", answers.usaOut);
  setValue("bonus-semifinalist", answers.semifinalist);
  setValue("bonus-winner", answers.winner);

  if (!bonusAnswersAreLocked()) bonusStatus.textContent = "Loaded saved bonus answers.";
}

async function saveBonusAnswers() {
  if (!currentUser) return alert("Please sign in first.");
  if (bonusAnswersAreLocked()) return alert("Bonus answers are locked.");

  const answers = {
    mostGoalsCountry: getValue("bonus-mostGoalsCountry"),
    yellowCards: getValue("bonus-yellowCards"),
    usaOut: getValue("bonus-usaOut"),
    semifinalist: getValue("bonus-semifinalist"),
    winner: getValue("bonus-winner")
  };

  for (const value of Object.values(answers)) {
    if (!value) return alert("Please answer all bonus questions before saving.");
  }

  await setDoc(doc(db, "bonusAnswers", currentUser.uid), {
    uid: currentUser.uid,
    email: currentUser.email,
    answers,
    updatedAt: new Date().toISOString()
  }, { merge: true });

  bonusStatus.textContent = "✅ Bonus answers saved!";
}

function renderAdminBonusResults() {
  adminBonusResultsForm.innerHTML = `
    <div class="pick-card">
      <label>1. Country with most tournament goals</label>
      <select id="result-bonus-mostGoalsCountry">
        <option value="">Select country</option>
        ${countryOptions.map(c => `<option value="${c}">${c}</option>`).join("")}
      </select>
    </div>

    <div class="pick-card">
      <label>2. Official yellow card total</label>
      <input id="result-bonus-yellowCards" type="number" min="0" />
    </div>

    <div class="pick-card">
      <label>3. USA knockout stage</label>
      <select id="result-bonus-usaOut">
        <option value="">Select stage</option>
        <option value="Group Stage">Group Stage</option>
        <option value="Round of 32">Round of 32</option>
        <option value="Round of 16">Round of 16</option>
        <option value="Quarterfinals">Quarterfinals</option>
        <option value="Semifinals">Semifinals</option>
        <option value="Final">Final</option>
        <option value="USA wins the World Cup">USA wins the World Cup</option>
      </select>
    </div>

    <div class="pick-card">
      <label>4. Semifinalists</label>
      <select id="result-bonus-semi1"><option value="">Semi team 1</option>${countryOptions.map(c => `<option value="${c}">${c}</option>`).join("")}</select>
      <select id="result-bonus-semi2"><option value="">Semi team 2</option>${countryOptions.map(c => `<option value="${c}">${c}</option>`).join("")}</select>
      <select id="result-bonus-semi3"><option value="">Semi team 3</option>${countryOptions.map(c => `<option value="${c}">${c}</option>`).join("")}</select>
      <select id="result-bonus-semi4"><option value="">Semi team 4</option>${countryOptions.map(c => `<option value="${c}">${c}</option>`).join("")}</select>
    </div>

    <div class="pick-card">
      <label>5. World Cup winner</label>
      <select id="result-bonus-winner">
        <option value="">Select country</option>
        ${countryOptions.map(c => `<option value="${c}">${c}</option>`).join("")}
      </select>
    </div>
  `;
}

async function loadExistingBonusResults() {
  const snap = await getDoc(doc(db, "bonusResults", "official"));
  if (!snap.exists()) return;

  const results = snap.data().results || {};

  setValue("result-bonus-mostGoalsCountry", results.mostGoalsCountry);
  setValue("result-bonus-yellowCards", results.yellowCards);
  setValue("result-bonus-usaOut", results.usaOut);
  setValue("result-bonus-winner", results.winner);

  const semis = results.semifinalists || [];
  setValue("result-bonus-semi1", semis[0]);
  setValue("result-bonus-semi2", semis[1]);
  setValue("result-bonus-semi3", semis[2]);
  setValue("result-bonus-semi4", semis[3]);
}

async function saveBonusResults() {
  const semifinalists = [
    getValue("result-bonus-semi1"),
    getValue("result-bonus-semi2"),
    getValue("result-bonus-semi3"),
    getValue("result-bonus-semi4")
  ].filter(Boolean);

  if (new Set(semifinalists).size !== semifinalists.length) {
    return alert("Duplicate semifinalists selected.");
  }

  const results = {
    mostGoalsCountry: getValue("result-bonus-mostGoalsCountry"),
    yellowCards: getValue("result-bonus-yellowCards"),
    usaOut: getValue("result-bonus-usaOut"),
    semifinalists,
    winner: getValue("result-bonus-winner")
  };

  await setDoc(doc(db, "bonusResults", "official"), {
    results,
    updatedAt: new Date().toISOString(),
    updatedBy: currentUser.email
  }, { merge: true });

  bonusResultsStatus.textContent = "✅ Bonus answer key saved!";
  await renderLeaderboardFromFirestore();
}

function scoreBonusAnswers(answers, results) {
  if (!answers || !results) return 0;

  let points = 0;

  if (answers.mostGoalsCountry && answers.mostGoalsCountry === results.mostGoalsCountry) points += 1;

  const guessYellow = Number(answers.yellowCards);
  const actualYellow = Number(results.yellowCards);
  if (!Number.isNaN(guessYellow) && !Number.isNaN(actualYellow)) {
    if (Math.abs(guessYellow - actualYellow) <= 10) points += 1;
  }

  if (answers.usaOut && answers.usaOut === results.usaOut) points += 1;

  if (
    answers.semifinalist &&
    Array.isArray(results.semifinalists) &&
    results.semifinalists.includes(answers.semifinalist)
  ) {
    points += 1;
  }

  if (answers.winner && answers.winner === results.winner) points += 1;

  return points;
}

async function renderAdminGroupResults() {
  adminGroupResultsForm.innerHTML = "";

  Object.entries(groups).forEach(([groupName, teams]) => {
    const sortedTeams = sortTeamsAlphabetically(teams);
    const wrapper = document.createElement("div");
    wrapper.className = "pick-card";

    wrapper.innerHTML = `
      <h3>Group ${groupName} Official Result</h3>

      <label>1st place</label>
      <select id="result-${groupName}-first">
        <option value="">Select team</option>
        ${sortedTeams.map(team => `<option value="${team}">${team}</option>`).join("")}
      </select>

      <label>2nd place</label>
      <select id="result-${groupName}-second">
        <option value="">Select team</option>
        ${sortedTeams.map(team => `<option value="${team}">${team}</option>`).join("")}
      </select>

      <label>3rd place</label>
      <select id="result-${groupName}-third">
        <option value="">Select team</option>
        ${sortedTeams.map(team => `<option value="${team}">${team}</option>`).join("")}
      </select>

      <label class="checkbox-row">
        <input type="checkbox" id="result-${groupName}-thirdQualified" />
        3rd place qualified
      </label>
    `;

    adminGroupResultsForm.appendChild(wrapper);
  });
}

async function loadExistingGroupResults() {
  const snap = await getDoc(doc(db, "groupResults", "official"));
  if (!snap.exists()) return;

  const results = snap.data().results || {};

  Object.entries(results).forEach(([groupName, result]) => {
    setValue(`result-${groupName}-first`, result.first);
    setValue(`result-${groupName}-second`, result.second);
    setValue(`result-${groupName}-third`, result.third);

    const cb = document.getElementById(`result-${groupName}-thirdQualified`);
    if (cb) cb.checked = !!result.thirdQualified;
  });
}

saveGroupResultsBtn?.addEventListener("click", async () => {
  const results = {};

  for (const groupName of Object.keys(groups)) {
    const first = getValue(`result-${groupName}-first`);
    const second = getValue(`result-${groupName}-second`);
    const third = getValue(`result-${groupName}-third`);
    const thirdQualified = document.getElementById(`result-${groupName}-thirdQualified`).checked;

    const chosen = [first, second, third].filter(Boolean);
    if (new Set(chosen).size !== chosen.length) {
      return alert(`Group ${groupName}: duplicate teams in official result.`);
    }

    results[groupName] = { first, second, third, thirdQualified };
  }

  await setDoc(doc(db, "groupResults", "official"), {
    results,
    updatedAt: new Date().toISOString(),
    updatedBy: currentUser.email
  }, { merge: true });

  groupResultsStatus.textContent = "✅ Group results saved!";
  await renderLeaderboardFromFirestore();
});

function renderAdminRound32Results() {
  adminRound32ResultsForm.innerHTML = "";

  round32Matches.forEach(match => {
    const wrapper = document.createElement("div");
    wrapper.className = "pick-card";
    const matchupLabel = round32MatchupLabel(match);
    const homeLabel = round32TeamLabel(match.home);
    const awayLabel = round32TeamLabel(match.away);

    wrapper.innerHTML = `
      <h3>${escapeHTML(matchupLabel)} Official Result</h3>

      <label>Winner</label>
      <select id="result-round32-${match.id}-winner">
        <option value="">Select winner</option>
        <option value="${escapeHTML(match.home)}">${escapeHTML(homeLabel)}</option>
        <option value="${escapeHTML(match.away)}">${escapeHTML(awayLabel)}</option>
      </select>

      <label class="checkbox-row">
        <input type="checkbox" id="result-round32-${match.id}-extraTimeOrPenalties" />
        Went to extra time or penalties
      </label>
    `;

    adminRound32ResultsForm.appendChild(wrapper);
  });
}

async function loadExistingRound32Results() {
  const snap = await getDoc(doc(db, "round32Results", "official"));
  if (!snap.exists()) return;

  const results = snap.data().results || {};

  Object.entries(results).forEach(([matchId, result]) => {
    setValue(`result-round32-${matchId}-winner`, result.winner);

    const extraTimeOrPenalties = document.getElementById(`result-round32-${matchId}-extraTimeOrPenalties`);
    if (extraTimeOrPenalties) {
      extraTimeOrPenalties.checked = !!result.extraTimeOrPenalties;
    }
  });
}

saveRound32ResultsBtn?.addEventListener("click", async () => {
  const results = {};

  for (const match of round32Matches) {
    const winner = getValue(`result-round32-${match.id}-winner`);
    const extraTimeOrPenalties =
      document.getElementById(`result-round32-${match.id}-extraTimeOrPenalties`)?.checked || false;

    results[match.id] = { winner, extraTimeOrPenalties };
  }

  await setDoc(doc(db, "round32Results", "official"), {
    results,
    updatedAt: new Date().toISOString(),
    updatedBy: currentUser.email
  }, { merge: true });

  round32ResultsStatus.textContent = "✅ Round of 32 results saved!";
  await renderLeaderboardFromFirestore();
});

function scoreRound32Picks(picks, results) {
  if (!picks || !results) return 0;

  let points = 0;

  Object.entries(picks).forEach(([matchId, pick]) => {
    const result = results[matchId];
    if (!pick || !result?.winner) return;

    if (pick.winner === result.winner) {
      points += 3;
    }

    if (!!pick.extraTimeOrPenalties === !!result.extraTimeOrPenalties) {
      points += 1;
    }
  });

  return points;
}

async function renderAdminPlayerList() {
  if (!adminPlayerList) return;

  await loadGroupLockTimes();

  const usersSnap = await getDocs(collection(db, "users"));
  const groupPicksSnap = await getDocs(collection(db, "groupPicks"));
  const bonusAnswersSnap = await getDocs(collection(db, "bonusAnswers"));

  const unlockedGroups = Object.keys(groups).filter(groupName => !groupIsLocked(groupName));

  const groupPickUserIds = new Set();
  groupPicksSnap.forEach(docSnap => {
    const data = docSnap.data();
    const picks = data.picks || {};

    const hasSavedAvailableGroupPicks =
      unlockedGroups.length > 0 &&
      unlockedGroups.every(groupName =>
        picks[groupName]?.first && picks[groupName]?.second
      );

    if (hasSavedAvailableGroupPicks) {
      groupPickUserIds.add(data.uid || docSnap.id);
    }
  });

  const bonusAnswerUserIds = new Set();
  bonusAnswersSnap.forEach(docSnap => {
    const data = docSnap.data();
    const answers = data.answers || {};

    const hasAllBonusAnswers =
      answers.mostGoalsCountry &&
      answers.yellowCards &&
      answers.usaOut &&
      answers.semifinalist &&
      answers.winner;

    if (hasAllBonusAnswers) {
      bonusAnswerUserIds.add(data.uid || docSnap.id);
    }
  });

  const users = [];
  usersSnap.forEach(docSnap => {
    users.push(docSnap.data());
  });

  users.sort((a, b) =>
    (a.username || a.googleDisplayName || "Player").localeCompare(
      b.username || b.googleDisplayName || "Player"
    )
  );

  adminPlayerList.innerHTML = `
    <table class="admin-player-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Username</th>
          <th>Gmail</th>
          <th>Group Picks</th>
          <th>Bonus Answers</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${users.map((u, index) => {
          const uid = u.uid;
          const groupDone = groupPickUserIds.has(uid);
          const bonusDone = bonusAnswerUserIds.has(uid);

          return `
            <tr>
              <td>${index + 1}</td>
              <td>${escapeHTML(u.username || u.googleDisplayName || "Player")}</td>
              <td>${escapeHTML(u.email || "")}</td>
              <td>
                <span class="${groupDone ? "status-good" : "status-bad"}">
                  ${groupDone ? "✅ Saved" : "❌ Missing"}
                </span>
              </td>
              <td>
                <span class="${bonusDone ? "status-good" : "status-bad"}">
                  ${bonusDone ? "✅ Complete" : "❌ Missing"}
                </span>
              </td>
              <td>
                <label class="admin-ban-cell">
                  <input type="checkbox" data-uid="${uid}" data-field="banned" ${u.banned ? "checked" : ""}/>
                  Banned
                </label>
              </td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;

  adminPlayerList.querySelectorAll("input[type='checkbox']").forEach(input => {
    input.addEventListener("change", async (e) => {
      const uid = e.target.dataset.uid;
      const field = e.target.dataset.field;

      await setDoc(doc(db, "users", uid), {
        [field]: e.target.checked,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      await renderLeaderboardFromFirestore();
      await renderAdminPlayerList();
    });
  });
}

refreshLeaderboardBtn?.addEventListener("click", async () => {
  await renderAdminPlayerList();
  await renderLeaderboardFromFirestore();
});

async function resetGroupResults() {
  if (!confirm("Reset all group results?")) return;

  await setDoc(doc(db, "groupResults", "official"), {
    results: {},
    updatedAt: new Date().toISOString(),
    updatedBy: currentUser.email
  });

  renderAdminGroupResults();

  groupResultsStatus.textContent =
    "✅ Group results reset.";

  await renderLeaderboardFromFirestore();
}

async function renderPublicLeaderboard() {
  const snap = await getDoc(doc(db, "publicLeaderboard", "current"));

  if (!snap.exists()) {
    renderLeaderboard([]);
    return;
  }

  const rows = snap.data().rows || [];
  renderLeaderboard(rows);
}

async function renderLeaderboardFromFirestore() {
  const usersSnap = await getDocs(collection(db, "users"));
  const groupPicksSnap = await getDocs(collection(db, "groupPicks"));
  const round32PicksSnap = await getDocs(collection(db, "round32Picks"));
  const bonusAnswersSnap = await getDocs(collection(db, "bonusAnswers"));

  const groupResultsSnap = await getDoc(doc(db, "groupResults", "official"));
  const round32ResultsSnap = await getDoc(doc(db, "round32Results", "official"));
  const bonusResultsSnap = await getDoc(doc(db, "bonusResults", "official"));

  const groupResults = groupResultsSnap.exists() ? groupResultsSnap.data().results || {} : {};
  const round32Results = round32ResultsSnap.exists() ? round32ResultsSnap.data().results || {} : {};
  const bonusResults = bonusResultsSnap.exists() ? bonusResultsSnap.data().results || {} : {};

  const users = {};
  usersSnap.forEach(docSnap => {
    const u = docSnap.data();
    users[u.uid] = {
      username: u.username || "",
      googleDisplayName: u.googleDisplayName || "",
      email: u.email || "",
      banned: !!u.banned
    };
  });

  const scores = {};

  function ensurePlayer(uid, email) {
    const user = users[uid];
    if (!user || user.banned) return null;

    if (!scores[uid]) {
      scores[uid] = {
        uid,
        display_name: user.username || user.googleDisplayName || "Player",
        match_points: 0,
        group_points: 0,
        bonus_points: 0,
        total_points: 0
      };
    }

    return scores[uid];
  }

  groupPicksSnap.forEach(docSnap => {
    const data = docSnap.data();
    const player = ensurePlayer(data.uid, data.email);
    if (!player) return;

    Object.entries(data.picks || {}).forEach(([groupName, pick]) => {
      const result = groupResults[groupName];
      if (!result) return;

      [pick.first, pick.second].forEach(team => {
        if (!team) return;

        if (team === result.first || team === result.second) {
          player.group_points += 2;
        } else if (team === result.third && result.thirdQualified) {
          player.group_points += 1;
        }
      });
    });
  });

  round32PicksSnap.forEach(docSnap => {
    const data = docSnap.data();
    const player = ensurePlayer(data.uid, data.email);
    if (!player) return;

    player.match_points += scoreRound32Picks(data.picks, round32Results);
  });

  bonusAnswersSnap.forEach(docSnap => {
    const data = docSnap.data();
    const player = ensurePlayer(data.uid, data.email);
    if (!player) return;

    player.bonus_points += scoreBonusAnswers(data.answers, bonusResults);
  });

  Object.values(scores).forEach(player => {
    player.total_points = player.group_points + player.match_points + player.bonus_points;
  });

  const rows = Object.values(scores);
  renderLeaderboard(rows);

  if (currentUser && ADMIN_EMAILS.includes(currentUser.email)) {
    await setDoc(doc(db, "publicLeaderboard", "current"), {
      rows,
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser.email
    });
  }
}

function renderLeaderboard(rows) {
  const tbody = document.querySelector("#leaderboard tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  const sorted = rows.sort((a, b) => b.total_points - a.total_points);

  sorted.forEach((r, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>
        ${
          r.uid
            ? `<button class="player-pick-link" data-uid="${escapeHTML(r.uid)}" data-name="${escapeHTML(r.display_name)}">${escapeHTML(r.display_name)}</button>`
            : escapeHTML(r.display_name)
        }
      </td>
      <td>${r.group_points + r.match_points}</td>
      <td>${r.bonus_points}</td>
      <td><strong>${r.total_points}</strong></td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll(".player-pick-link").forEach(btn => {
    btn.addEventListener("click", async () => {
      await showPlayerGroupPicks(btn.dataset.uid, btn.dataset.name);
    });
  });

  const playerCount = document.querySelector("#playerCount");
  const lastUpdated = document.querySelector("#lastUpdated");
  const matchCount = document.querySelector("#matchCount");

  if (playerCount) playerCount.textContent = sorted.length;
  if (lastUpdated) lastUpdated.textContent = new Date().toLocaleString();
  if (matchCount) matchCount.textContent = "Live";
}

async function showPlayerGroupPicks(uid, displayName) {
  if (!currentUser) {
    alert("Please sign in to view player picks.");
    return;
  }

  await loadGroupLockTimes();

  const snap = await getDoc(doc(db, "groupPicks", uid));

  if (!snap.exists()) {
    playerPicksTitle.textContent = `${displayName}'s Group Picks`;
    playerPicksContent.innerHTML = `<p class="mini-note">No group picks found for this player.</p>`;
    playerPicksViewer.style.display = "block";
    playerPicksViewer.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  const picks = snap.data().picks || {};
  const lockedGroups = Object.keys(groups).filter(groupName => groupIsLocked(groupName));

  playerPicksTitle.textContent = `${displayName}'s Group Picks`;

  if (!lockedGroups.length) {
    playerPicksContent.innerHTML = `<p class="mini-note">No groups are locked yet, so picks are hidden for now.</p>`;
  } else {
    playerPicksContent.innerHTML = `
      <div class="public-picks-grid">
        ${lockedGroups.map(groupName => {
          const pick = picks[groupName];

          return `
            <div class="public-pick-card">
              <h3>Group ${groupName}</h3>
              ${
                pick?.first && pick?.second
                  ? `
                    <p><strong>Pick #1:</strong> ${escapeHTML(pick.first)}</p>
                    <p><strong>Pick #2:</strong> ${escapeHTML(pick.second)}</p>
                  `
                  : `<p class="mini-note">No saved pick for this group.</p>`
              }
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  playerPicksViewer.style.display = "block";
  playerPicksViewer.scrollIntoView({ behavior: "smooth", block: "start" });
}

closePlayerPicksBtn?.addEventListener("click", () => {
  playerPicksViewer.style.display = "none";
});

const MATCH_TICKER_URL = "https://worldcup-score-ticker.chat2danny21.workers.dev/matches";
let tickerRefreshTimer = null;

function getNextTickerRefreshDelay(matches) {
  const now = Date.now();

  const hasLiveMatch = matches.some(match => match.status?.type === "live");

  const hasMatchStartingSoon = matches.some(match => {
    const kickoffTime = new Date(match.date).getTime();
    const diff = kickoffTime - now;
    return diff > 0 && diff <= 2 * 60 * 60 * 1000;
  });

  if (hasLiveMatch || hasMatchStartingSoon) {
    return 5 * 60 * 1000;
  }

  return 30 * 60 * 1000;
}

function scheduleNextTickerRefresh(matches = []) {
  if (tickerRefreshTimer) {
    clearTimeout(tickerRefreshTimer);
  }

  const delay = getNextTickerRefreshDelay(matches);

  tickerRefreshTimer = setTimeout(async () => {
    await loadWorldCupTicker();
  }, delay);
}

async function loadWorldCupTicker() {
  const ticker = document.getElementById("matchTicker");
  const updated = document.getElementById("tickerUpdated");
  if (!ticker) return;

  try {
    const res = await fetch(MATCH_TICKER_URL);
    const data = await res.json();
    const matches = data.matches || [];

    if (!matches.length) {
      ticker.textContent = "No World Cup matches found right now.";
      if (updated) updated.textContent = "No matches";
      scheduleNextTickerRefresh([]);
      return;
    }

    ticker.innerHTML = matches.map(renderTickerMatch).join("");
    scheduleNextTickerRefresh(matches);

    if (updated && data.updatedAt) {
      updated.textContent = `Updated ${new Date(data.updatedAt).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit"
      })}`;
    }
  } catch (err) {
    console.error("Failed to load match ticker:", err);
    ticker.textContent = "Could not load match ticker.";
    if (updated) updated.textContent = "Error";
  }
}

function renderTickerMatch(match) {
  const matchDate = new Date(match.date);

  const localDay = matchDate.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric"
  });

  const localTime = matchDate.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });

  const dateTimeLabel = `${localDay} • ${localTime}`;

  const status = match.status || {};
  const isLive = status.type === "live";
  const isFinal = status.type === "final";
  const showScore = isLive || isFinal;

  const statusLabel = isLive
    ? `<span class="live-pill">LIVE</span>`
    : isFinal
      ? `<span class="final-pill">FINAL</span>`
      : "UPCOMING";

  const scoreHome = showScore ? Number(match.home.score ?? 0) : "";
  const scoreAway = showScore ? Number(match.away.score ?? 0) : "";

  return `
    <div class="match-card ${escapeHTML(status.type || "")}">
      <div class="match-card-top">
        <span>${statusLabel}</span>
        <span></span>
      </div>

      <div class="matchup">
        <div class="team-flag">${escapeHTML(match.home.flag)}</div>
        <div class="team-code">${escapeHTML(match.home.code)}</div>
        <div class="team-name">${escapeHTML(match.home.name)}</div>
        <div class="team-score">${escapeHTML(scoreHome)}</div>
      </div>

      <div class="matchup">
        <div class="team-flag">${escapeHTML(match.away.flag)}</div>
        <div class="team-code">${escapeHTML(match.away.code)}</div>
        <div class="team-name">${escapeHTML(match.away.name)}</div>
        <div class="team-score">${escapeHTML(scoreAway)}</div>
      </div>

      <div class="match-footer">
        ${isLive ? "Ongoing" : isFinal ? "Final" : "Kickoff"} · ${dateTimeLabel}
      </div>
    </div>
  `;
}

loadWorldCupTicker();

function getValue(id) {
  return document.getElementById(id)?.value || "";
}

function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value || "";
}

function escapeHTML(str) {
  return String(str ?? "").replace(/[&<>"']/g, s => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[s]));
}
