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
- Round of 32 bonus counts = 4 exact or 2 within 2
- Round of 32 bonus 3+ goal winners = 2 points each
- Round of 16 correct winner = 3 points
- Round of 16 correct full-time score = 2 points
- Round of 16 bonus questions are scored from official Round of 16 results
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
let latestLeaderboardRows = [];

const usaCelebrationBanner = document.getElementById("usaCelebrationBanner");

const ENGLAND_FLAG = "🏴󠁧󠁢󠁥󠁮󠁧󠁿";
const LEGACY_ENGLAND_OPTION = "🏴 England";

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
  L: [LEGACY_ENGLAND_OPTION, "🇭🇷 Croatia", "🇬🇭 Ghana", "🇵🇦 Panama"]
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

function countryOptionLabel(country) {
  return cleanCountryName(country) === "England" ? `${ENGLAND_FLAG} England` : country;
}

function renderCountryOptions() {
  return countryOptions
    .map(country => `<option value="${escapeHTML(country)}">${escapeHTML(countryOptionLabel(country))}</option>`)
    .join("");
}

function sameCountryOption(a, b) {
  if (!a || !b) return false;
  return cleanCountryName(a) === cleanCountryName(b);
}

function normalizeCountryOptionValue(country) {
  return cleanCountryName(country) === "England" ? LEGACY_ENGLAND_OPTION : country;
}

function countryFlagFromOption(country) {
  if (cleanCountryName(country) === "England") return ENGLAND_FLAG;
  return country.replace(cleanCountryName(country), "").trim();
}

const round32Flags = {
  "Algeria": "🇩🇿",
  "Argentina": "🇦🇷",
  "Australia": "🇦🇺",
  "Austria": "🇦🇹",
  "Belgium": "🇧🇪",
  "Bosnia and Herzegovina": "🇧🇦",
  "Brazil": "🇧🇷",
  "Canada": "🇨🇦",
  "Cape Verde": "🇨🇻",
  "Colombia": "🇨🇴",
  "DR Congo": "🇨🇩",
  "Croatia": "🇭🇷",
  "Ecuador": "🇪🇨",
  "Egypt": "🇪🇬",
  "England": "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  "France": "🇫🇷",
  "Germany": "🇩🇪",
  "Ghana": "🇬🇭",
  "Ivory Coast": "🇨🇮",
  "Japan": "🇯🇵",
  "Mexico": "🇲🇽",
  "Morocco": "🇲🇦",
  "Netherlands": "🇳🇱",
  "Norway": "🇳🇴",
  "Paraguay": "🇵🇾",
  "Portugal": "🇵🇹",
  "Senegal": "🇸🇳",
  "South Africa": "🇿🇦",
  "Spain": "🇪🇸",
  "Sweden": "🇸🇪",
  "Switzerland": "🇨🇭",
  "United States": "🇺🇸"
};

const round32Matches = [
  { id: "73", label: "Match 73", home: "South Africa", away: "Canada", startTime: "2026-06-28T14:00:00-05:00", venue: "Los Angeles" },
  { id: "76", label: "Match 76", home: "Brazil", away: "Japan", startTime: "2026-06-29T12:00:00-05:00", venue: "Houston" },
  { id: "74", label: "Match 74", home: "Germany", away: "Paraguay", startTime: "2026-06-29T15:30:00-05:00", venue: "Boston" },
  { id: "75", label: "Match 75", home: "Netherlands", away: "Morocco", startTime: "2026-06-29T20:00:00-05:00", venue: "Monterrey" },
  { id: "78", label: "Match 78", home: "Ivory Coast", away: "Norway", startTime: "2026-06-30T12:00:00-05:00", venue: "Dallas" },
  { id: "77", label: "Match 77", home: "France", away: "Sweden", startTime: "2026-06-30T16:00:00-05:00", venue: "New York / New Jersey" },
  { id: "79", label: "Match 79", home: "Mexico", away: "Ecuador", startTime: "2026-06-30T20:00:00-05:00", venue: "Mexico City" },
  { id: "80", label: "Match 80", home: "England", away: "DR Congo", startTime: "2026-07-01T11:00:00-05:00", venue: "Atlanta" },
  { id: "82", label: "Match 82", home: "Belgium", away: "Senegal", startTime: "2026-07-01T15:00:00-05:00", venue: "Seattle" },
  { id: "81", label: "Match 81", home: "United States", away: "Bosnia and Herzegovina", startTime: "2026-07-01T19:00:00-05:00", venue: "Santa Clara" },
  { id: "84", label: "Match 84", home: "Spain", away: "Austria", startTime: "2026-07-02T14:00:00-05:00", venue: "Los Angeles" },
  { id: "83", label: "Match 83", home: "Portugal", away: "Croatia", startTime: "2026-07-02T18:00:00-05:00", venue: "Toronto" },
  { id: "85", label: "Match 85", home: "Switzerland", away: "Algeria", startTime: "2026-07-02T22:00:00-05:00", venue: "Vancouver" },
  { id: "88", label: "Match 88", home: "Australia", away: "Egypt", startTime: "2026-07-03T13:00:00-05:00", venue: "Dallas" },
  { id: "86", label: "Match 86", home: "Argentina", away: "Cape Verde", startTime: "2026-07-03T17:00:00-05:00", venue: "Miami" },
  { id: "87", label: "Match 87", home: "Colombia", away: "Ghana", startTime: "2026-07-03T20:30:00-05:00", venue: "Kansas City" }
];

const knownRound32Winners = {
  "88": "Egypt"
};

const round32TeamOptions = sortTeamsAlphabetically([
  ...new Set(round32Matches.flatMap(match => [match.home, match.away]))
]);

function round32TeamLabel(team) {
  const flag = round32Flags[team];
  return flag ? `${flag} ${team}` : team;
}

function round32MatchupLabel(match) {
  return `${round32TeamLabel(match.home)} vs ${round32TeamLabel(match.away)}`;
}

const round16Matches = [
  { id: "89", label: "Match 89", sourceMatchIds: ["73", "75"], startTime: "2026-07-04T12:00:00-05:00", venue: "Philadelphia" },
  { id: "90", label: "Match 90", sourceMatchIds: ["74", "77"], startTime: "2026-07-04T16:00:00-05:00", venue: "Houston" },
  { id: "91", label: "Match 91", sourceMatchIds: ["76", "78"], startTime: "2026-07-05T12:00:00-05:00", venue: "New York / New Jersey" },
  { id: "92", label: "Match 92", sourceMatchIds: ["79", "80"], startTime: "2026-07-05T15:00:00-05:00", venue: "Mexico City" },
  { id: "93", label: "Match 93", sourceMatchIds: ["83", "84"], startTime: "2026-07-06T17:00:00-05:00", venue: "Dallas" },
  { id: "94", label: "Match 94", sourceMatchIds: ["81", "82"], startTime: "2026-07-06T20:00:00-05:00", venue: "Seattle" },
  { id: "95", label: "Match 95", sourceMatchIds: ["86", "88"], startTime: "2026-07-07T15:00:00-05:00", venue: "Atlanta" },
  { id: "96", label: "Match 96", sourceMatchIds: ["85", "87"], startTime: "2026-07-07T20:00:00-05:00", venue: "Vancouver" }
];

const round16RegionOptions = ["Africa", "Europe", "North America", "South America"];

const round16TeamRegions = {
  "Algeria": "Africa",
  "Argentina": "South America",
  "Austria": "Europe",
  "Belgium": "Europe",
  "Bosnia and Herzegovina": "Europe",
  "Brazil": "South America",
  "Canada": "North America",
  "Cape Verde": "Africa",
  "Colombia": "South America",
  "Croatia": "Europe",
  "DR Congo": "Africa",
  "Ecuador": "South America",
  "Egypt": "Africa",
  "England": "Europe",
  "France": "Europe",
  "Ghana": "Africa",
  "Germany": "Europe",
  "Ivory Coast": "Africa",
  "Mexico": "North America",
  "Morocco": "Africa",
  "Netherlands": "Europe",
  "Norway": "Europe",
  "Paraguay": "South America",
  "Portugal": "Europe",
  "Senegal": "Africa",
  "South Africa": "Africa",
  "Spain": "Europe",
  "Sweden": "Europe",
  "Switzerland": "Europe",
  "United States": "North America"
};

const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const userInfo = document.getElementById("userInfo");

const profileSettingsBox = document.getElementById("profileSettingsBox");
const profileSettingsContent = document.getElementById("profileSettingsContent");
const toggleProfileSettingsBtn = document.getElementById("toggleProfileSettingsBtn");
const usernameBox = document.getElementById("usernameBox");
const usernameInput = document.getElementById("usernameInput");
const saveUsernameBtn = document.getElementById("saveUsernameBtn");
const usernameStatus = document.getElementById("usernameStatus");
const saveRootingForBtn = document.getElementById("saveRootingForBtn");
const rootingForStatus = document.getElementById("rootingForStatus");

const groupPicksSection = document.getElementById("groupPicksSection");
const groupPicksContent = document.getElementById("groupPicksContent");
const toggleGroupPicksBtn = document.getElementById("toggleGroupPicksBtn");
const groupPicksForm = document.getElementById("groupPicksForm");
const saveGroupPicksBtn = document.getElementById("saveGroupPicksBtn");
const groupPicksStatus = document.getElementById("groupPicksStatus");

const round32PicksSection = document.getElementById("round32PicksSection");
const round32PicksContent = document.getElementById("round32PicksContent");
const toggleRound32PicksBtn = document.getElementById("toggleRound32PicksBtn");
const round32PicksForm = document.getElementById("round32PicksForm");
const saveRound32PicksBtn = document.getElementById("saveRound32PicksBtn");
const round32PicksStatus = document.getElementById("round32PicksStatus");
const round32BonusSection = document.getElementById("round32BonusSection");
const round32BonusContent = document.getElementById("round32BonusContent");
const toggleRound32BonusBtn = document.getElementById("toggleRound32BonusBtn");
const round32BonusForm = document.getElementById("round32BonusForm");
const saveRound32BonusBtn = document.getElementById("saveRound32BonusBtn");
const round32BonusStatus = document.getElementById("round32BonusStatus");
const round16PicksSection = document.getElementById("round16PicksSection");
const round16PicksContent = document.getElementById("round16PicksContent");
const toggleRound16PicksBtn = document.getElementById("toggleRound16PicksBtn");
const round16PicksForm = document.getElementById("round16PicksForm");
const saveRound16PicksBtn = document.getElementById("saveRound16PicksBtn");
const round16PicksStatus = document.getElementById("round16PicksStatus");
const round16BonusSection = document.getElementById("round16BonusSection");
const round16BonusContent = document.getElementById("round16BonusContent");
const toggleRound16BonusBtn = document.getElementById("toggleRound16BonusBtn");
const round16BonusForm = document.getElementById("round16BonusForm");
const saveRound16BonusBtn = document.getElementById("saveRound16BonusBtn");
const round16BonusStatus = document.getElementById("round16BonusStatus");
const viewLeaderboardBtn = document.getElementById("viewLeaderboardBtn");
const leaderboardSection = document.getElementById("leaderboardSection");

const adminSection = document.getElementById("adminSection");
const adminGroupResultsForm = document.getElementById("adminGroupResultsForm");
const saveGroupResultsBtn = document.getElementById("saveGroupResultsBtn");
const groupResultsStatus = document.getElementById("groupResultsStatus");
const adminRound32ResultsForm = document.getElementById("adminRound32ResultsForm");
const saveRound32ResultsBtn = document.getElementById("saveRound32ResultsBtn");
const round32ResultsStatus = document.getElementById("round32ResultsStatus");
const adminRound32BonusResultsForm = document.getElementById("adminRound32BonusResultsForm");
const saveRound32BonusResultsBtn = document.getElementById("saveRound32BonusResultsBtn");
const round32BonusResultsStatus = document.getElementById("round32BonusResultsStatus");
const adminRound16ResultsForm = document.getElementById("adminRound16ResultsForm");
const saveRound16ResultsBtn = document.getElementById("saveRound16ResultsBtn");
const round16ResultsStatus = document.getElementById("round16ResultsStatus");
const refreshLeaderboardBtn = document.getElementById("refreshLeaderboardBtn");
const refreshLeaderboardStatus = document.getElementById("refreshLeaderboardStatus");

const playerPicksViewer = document.getElementById("playerPicksViewer");
const playerPicksTitle = document.getElementById("playerPicksTitle");
const playerPicksContent = document.getElementById("playerPicksContent");
const closePlayerPicksBtn = document.getElementById("closePlayerPicksBtn");

let bonusSection;
let bonusContent;
let bonusForm;
let saveBonusBtn;
let bonusStatus;
let rootingCountry1;
let rootingCountry2;
let adminPlayerList;
let adminRound32PlayerList;
let adminRound16PlayerList;
let adminBonusResultsForm;
let saveBonusResultsBtn;
let bonusResultsStatus;

injectBonusSection();
injectAdminPlayerManagement();
injectAdminBonusResults();
moveRefreshLeaderboardButton();
showUsaCelebrationWhenActive();

setupCollapsibleSection(toggleRound16PicksBtn, round16PicksContent, true);
setupCollapsibleSection(toggleRound16BonusBtn, round16BonusContent, true);
setupCollapsibleSection(toggleRound32PicksBtn, round32PicksContent, false);
setupCollapsibleSection(toggleRound32BonusBtn, round32BonusContent, false);
setupCollapsibleSection(toggleGroupPicksBtn, groupPicksContent, false);

viewLeaderboardBtn?.addEventListener("click", () => {
  leaderboardSection?.scrollIntoView({ behavior: "smooth", block: "start" });
});

toggleProfileSettingsBtn?.addEventListener("click", () => {
  const isHidden = profileSettingsContent.style.display === "none";
  profileSettingsContent.style.display = isHidden ? "block" : "none";
  toggleProfileSettingsBtn.textContent = isHidden ? "Minimize" : "Expand";
});

function setupCollapsibleSection(button, content, startsExpanded) {
  if (!button || !content) return;

  content.style.display = startsExpanded ? "block" : "none";
  button.textContent = startsExpanded ? "Minimize" : "Expand";

  button.addEventListener("click", () => {
    const isHidden = content.style.display === "none";
    content.style.display = isHidden ? "block" : "none";
    button.textContent = isHidden ? "Minimize" : "Expand";
  });
}

function setupAdminPanelToggles(root = adminSection) {
  if (!root) return;

  const panels = [
    ...(root.matches?.(".admin-panel") ? [root] : []),
    ...root.querySelectorAll(".admin-panel")
  ];

  panels.forEach(panel => {
    const button = panel.querySelector(".admin-toggle-btn");
    const content = panel.querySelector(".admin-panel-content");
    if (!button || !content || button.dataset.toggleReady) return;

    button.dataset.toggleReady = "true";
    setupCollapsibleSection(button, content, true);
  });
}

function showUsaCelebrationWhenActive() {
  if (!usaCelebrationBanner) return;

  const now = new Date();
  const isCelebrationWindow =
    now.getFullYear() === 2026 &&
    now.getMonth() === 6 &&
    now.getDate() >= 3 &&
    now.getDate() <= 5;

  usaCelebrationBanner.style.display = isCelebrationWindow ? "block" : "none";
}

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

saveRootingForBtn?.addEventListener("click", saveRootingForCountries);

onAuthStateChanged(auth, async (user) => {
  currentUser = user;

  if (!user) {
    loginBtn.style.display = "inline-block";
    logoutBtn.style.display = "none";
    userInfo.textContent = "Not signed in";

    if (profileSettingsBox) profileSettingsBox.style.display = "none";
    groupPicksSection.style.display = "none";
    round32PicksSection.style.display = "none";
    round32BonusSection.style.display = "none";
    round16PicksSection.style.display = "none";
    round16BonusSection.style.display = "none";
    bonusSection.style.display = "none";
    if (adminSection) adminSection.style.display = "none";
    if (refreshLeaderboardBtn) refreshLeaderboardBtn.style.display = "none";

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

  if (profileSettingsBox) profileSettingsBox.style.display = "block";
  if (profileSettingsContent) profileSettingsContent.style.display = "block";
  if (toggleProfileSettingsBtn) toggleProfileSettingsBtn.textContent = "Minimize";
  if (userSnap.exists() && usernameInput) {
    usernameInput.value = userSnap.data().username || "";
  }

  groupPicksSection.style.display = "block";
  round32PicksSection.style.display = "block";
  round32BonusSection.style.display = "block";
  round16PicksSection.style.display = "block";
  round16BonusSection.style.display = "block";
  bonusSection.style.display = "block";

  await loadGroupLockTimes();
  renderGroupPicks();
  renderRound32Picks();
  renderRound32BonusQuestions();
  await renderRound16Picks();
  await renderRound16BonusQuestions();
  renderBonusQuiz();
  renderRootingForPicker();

  await loadExistingGroupPicks();
  await loadExistingRound32Picks();
  await loadExistingRound32BonusAnswers();
  await loadExistingRound16Picks();
  await loadExistingRound16BonusAnswers();
  await loadExistingBonusAnswers();
  await loadExistingRootingForCountries(userSnap.data());

  if (ADMIN_EMAILS.includes(user.email)) {
    round16PicksSection?.insertAdjacentElement("beforebegin", adminSection);
    adminSection.style.display = "block";
    if (refreshLeaderboardBtn) refreshLeaderboardBtn.style.display = "inline-block";
    setupAdminPanelToggles(adminSection);
    renderAdminGroupResults();
    renderAdminRound32Results();
    renderAdminRound32BonusResults();
    await renderAdminRound16Results();
    renderAdminBonusResults();
    await loadExistingGroupResults();
    await loadExistingRound32Results();
    await loadExistingRound32BonusResults();
    await loadExistingRound16Results();
    await loadExistingBonusResults();
    await renderAdminPlayerList();
    await renderLeaderboardFromFirestore();
  } else {
    if (refreshLeaderboardBtn) refreshLeaderboardBtn.style.display = "none";
    await renderPublicLeaderboard();
  }
});

function injectBonusSection() {
  bonusSection = document.createElement("section");
  bonusSection.className = "card";
  bonusSection.id = "bonusSection";
  bonusSection.style.display = "none";

  bonusSection.innerHTML = `
    <div class="section-header">
      <h2>🎯 Bonus Questions</h2>
      <button id="toggleBonusBtn" class="secondary-btn">Expand</button>
    </div>
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

  setupCollapsibleSection(document.getElementById("toggleBonusBtn"), bonusContent, false);

  saveBonusBtn.addEventListener("click", saveBonusAnswers);
}

function injectAdminPlayerManagement() {
  if (!adminSection) return;

  const box = document.createElement("div");
  box.innerHTML = `
    <div class="admin-panel">
      <div class="section-header admin-panel-header">
        <div>
          <span class="admin-panel-label">Players</span>
          <h3>Player Payment / Ban Controls</h3>
        </div>
        <button class="secondary-btn admin-toggle-btn">Minimize</button>
      </div>
      <div class="admin-panel-content">
        <p class="mini-note">All signed-in players appear on the leaderboard unless banned.</p>
        <div id="adminPlayerList"></div>
      </div>
    </div>

    <div class="admin-panel">
      <div class="section-header admin-panel-header">
        <div>
          <span class="admin-panel-label">Round of 32 tracking</span>
          <h3>Round of 32 Pick Status</h3>
        </div>
        <button class="secondary-btn admin-toggle-btn">Minimize</button>
      </div>
      <div class="admin-panel-content">
        <p class="mini-note">Quick check for who has saved every Round of 32 winner pick and completed the Round of 32 bonus questions.</p>
        <div id="adminRound32PlayerList"></div>
      </div>
    </div>

    <div class="admin-panel">
      <div class="section-header admin-panel-header">
        <div>
          <span class="admin-panel-label">Round of 16 tracking</span>
          <h3>Round of 16 Pick Status</h3>
        </div>
        <button class="secondary-btn admin-toggle-btn">Minimize</button>
      </div>
      <div class="admin-panel-content">
        <p class="mini-note">Quick check for who has saved every Round of 16 match pick and completed the Round of 16 bonus questions.</p>
        <div id="adminRound16PlayerList"></div>
      </div>
    </div>
  `;

  const adminTitle = adminSection.querySelector("h2");
  if (adminTitle) {
    adminTitle.insertAdjacentElement("afterend", box);
  } else {
    adminSection.insertBefore(box, adminSection.firstChild);
  }
  adminPlayerList = document.getElementById("adminPlayerList");
  adminRound32PlayerList = document.getElementById("adminRound32PlayerList");
  adminRound16PlayerList = document.getElementById("adminRound16PlayerList");
  setupAdminPanelToggles(box);
}

function injectAdminBonusResults() {
  if (!adminSection) return;

  const box = document.createElement("div");
  box.className = "admin-panel";
  box.innerHTML = `
    <div class="section-header admin-panel-header">
      <div>
        <span class="admin-panel-label">Opening bonus</span>
        <h3>Bonus Answer Key</h3>
      </div>
      <button class="secondary-btn admin-toggle-btn">Minimize</button>
    </div>
    <div class="admin-panel-content">
      <p class="mini-note">Set the correct bonus answers here. Each correct answer is worth 1 point.</p>
      <div id="adminBonusResultsForm"></div>
      <button id="saveBonusResultsBtn">Save Bonus Answer Key</button>
      <p id="bonusResultsStatus"></p>
    </div>
  `;

  adminSection.appendChild(box);

  adminBonusResultsForm = document.getElementById("adminBonusResultsForm");
  saveBonusResultsBtn = document.getElementById("saveBonusResultsBtn");
  bonusResultsStatus = document.getElementById("bonusResultsStatus");

  saveBonusResultsBtn.addEventListener("click", saveBonusResults);
  setupAdminPanelToggles(box);
}

function moveRefreshLeaderboardButton() {
  if (!refreshLeaderboardBtn) return;
  refreshLeaderboardBtn.style.display = "none";
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
      <p id="group-${groupName}-first-result" class="answer-result"></p>

      <label>Pick #2</label>
      <select id="group-${groupName}-second" ${locked ? "disabled" : ""}>
        <option value="">Select team</option>
        ${sortedTeams.map(team => `<option value="${team}">${team}</option>`).join("")}
      </select>
      <p id="group-${groupName}-second-result" class="answer-result"></p>
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

  await applyGroupPickIndicators();
}

async function applyGroupPickIndicators() {
  const snap = await getDoc(doc(db, "groupResults", "official"));
  if (!snap.exists()) return;

  const results = snap.data().results || {};

  Object.keys(groups).forEach(groupName => {
    ["first", "second"].forEach(slot => {
      const indicatorId = `group-${groupName}-${slot}-result`;
      clearScoringIndicator(indicatorId);

      const team = getValue(`group-${groupName}-${slot}`);
      const result = results[groupName];
      if (!team || !result) return;

      if (sameCountryOption(team, result.first) || sameCountryOption(team, result.second)) {
        setScoringIndicator(indicatorId, "correct", "Correct top 2", 2);
      } else if (sameCountryOption(team, result.third) && result.thirdQualified) {
        setScoringIndicator(indicatorId, "partial", "3rd-place qualifier", 1);
      } else if (result.first || result.second || result.third) {
        setScoringIndicator(indicatorId, "wrong", "Wrong", 0);
      }
    });
  });
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
  await applyGroupPickIndicators();
});

function round32MatchIsLocked(match) {
  return new Date() >= new Date(match.startTime);
}

function round32PickIsRevealable(match, results = {}) {
  return round32MatchIsLocked(match) || !!results[match.id]?.winner;
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
      <p id="round32-${match.id}-result" class="answer-result"></p>
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
    round32PicksStatus.className = "status-message status-locked";
    round32PicksStatus.textContent = "🔒 All Round of 32 picks are locked.";
  } else {
    round32PicksStatus.className = "status-message status-info";
    round32PicksStatus.textContent = "Loaded saved Round of 32 picks.";
  }

  await applyRound32PickIndicators();
}

async function applyRound32PickIndicators() {
  const snap = await getDoc(doc(db, "round32Results", "official"));
  if (!snap.exists()) return;

  const results = snap.data().results || {};

  round32Matches.forEach(match => {
    const indicatorId = `round32-${match.id}-result`;
    clearScoringIndicator(indicatorId);

    const result = results[match.id];
    const winner = getValue(`round32-${match.id}-winner`);
    if (!winner || !result?.winner) return;

    let points = sameCountryOption(winner, result.winner) ? 3 : 0;
    const pickedExtraTime = document.getElementById(`round32-${match.id}-extraTimeOrPenalties`)?.checked || false;
    if (pickedExtraTime) points += result.extraTimeOrPenalties ? 1 : -1;

    const winnerCorrect = sameCountryOption(winner, result.winner);
    const label = winnerCorrect ? "Winner correct" : "Winner wrong";
    setScoringIndicator(indicatorId, winnerCorrect ? pointsState(points) : "wrong", label, points);
  });
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

  round32PicksStatus.className = "status-message status-success";
  round32PicksStatus.textContent =
    "✅ Round of 32 picks saved! Now select your Round of 32 bonus answers below.";
  await applyRound32PickIndicators();
  round32BonusSection?.scrollIntoView({ behavior: "smooth", block: "start" });
});

function round32BonusAnswersAreLocked() {
  return round32MatchIsLocked(round32Matches[0]);
}

function renderRound32BonusQuestions() {
  round32BonusForm.innerHTML = `
    <div class="pick-card">
      <label>1. How many Round of 32 matches will go to extra time or penalties?</label>
      <p class="mini-note">Exact = 4 points. Within 2 = 2 points.</p>
      <input id="round32-bonus-extraTimeCount" type="number" min="0" max="16" />
      <p id="round32-bonus-extraTimeCount-result" class="answer-result"></p>
    </div>

    <div class="pick-card">
      <label>2. How many red cards will there be in the Round of 32?</label>
      <p class="mini-note">Exact = 4 points. Within 2 = 2 points.</p>
      <input id="round32-bonus-redCards" type="number" min="0" />
      <p id="round32-bonus-redCards-result" class="answer-result"></p>
    </div>

    <div class="pick-card">
      <label>3. Name two teams that will win by 3 or more goals during the Round of 32.</label>
      <p class="mini-note">Each correct team = 2 points.</p>
      <select id="round32-bonus-threeGoalWinner1">
        <option value="">Select team #1</option>
        ${renderCountryOptions()}
      </select>
      <p id="round32-bonus-threeGoalWinner1-result" class="answer-result"></p>
      <select id="round32-bonus-threeGoalWinner2">
        <option value="">Select team #2</option>
        ${renderCountryOptions()}
      </select>
      <p id="round32-bonus-threeGoalWinner2-result" class="answer-result"></p>
    </div>
  `;

  if (round32BonusAnswersAreLocked()) {
    round32BonusStatus.className = "status-message status-locked";
    round32BonusStatus.textContent = "🔒 Round of 32 bonus answers are locked.";
    saveRound32BonusBtn.disabled = true;
    saveRound32BonusBtn.textContent = "Round of 32 Bonus Locked";
    [
      "round32-bonus-extraTimeCount",
      "round32-bonus-redCards",
      "round32-bonus-threeGoalWinner1",
      "round32-bonus-threeGoalWinner2"
    ].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = true;
    });
  } else {
    round32BonusStatus.className = "";
    saveRound32BonusBtn.disabled = false;
    saveRound32BonusBtn.textContent = "Save Round of 32 Bonus Answers";
  }
}

async function loadExistingRound32BonusAnswers() {
  let snap;

  try {
    snap = await getDoc(doc(db, "round32BonusAnswers", currentUser.uid));
  } catch (error) {
    console.error("Failed to load Round of 32 bonus answers:", error);
    round32BonusStatus.className = "status-message status-error";
    round32BonusStatus.textContent =
      "Could not load saved Round of 32 bonus answers. Check Firestore rules for round32BonusAnswers.";
    return;
  }

  if (!snap.exists()) return;

  const answers = snap.data().answers || {};

  setValue("round32-bonus-extraTimeCount", answers.extraTimeOrPenaltiesCount);
  setValue("round32-bonus-redCards", answers.redCards);

  const threeGoalWinners = Array.isArray(answers.threeGoalWinners)
    ? answers.threeGoalWinners
    : [answers.threeGoalWinner].filter(Boolean);
  setValue("round32-bonus-threeGoalWinner1", threeGoalWinners[0]);
  setValue("round32-bonus-threeGoalWinner2", threeGoalWinners[1]);

  if (!round32BonusAnswersAreLocked()) {
    round32BonusStatus.className = "status-message status-info";
    round32BonusStatus.textContent = "Loaded saved Round of 32 bonus answers.";
  }

  await applyRound32BonusAnswerIndicators();
}

function setAnswerIndicator(id, isCorrect) {
  const el = document.getElementById(id);
  if (!el) return;

  el.className = `answer-result ${isCorrect ? "answer-result-correct" : "answer-result-wrong"}`;
  el.textContent = isCorrect ? "✓ Correct" : "X Wrong";
}

function clearAnswerIndicator(id) {
  const el = document.getElementById(id);
  if (!el) return;

  el.className = "answer-result";
  el.textContent = "";
}

async function applyRound32BonusAnswerIndicators() {
  const indicatorIds = [
    "round32-bonus-extraTimeCount-result",
    "round32-bonus-redCards-result",
    "round32-bonus-threeGoalWinner1-result",
    "round32-bonus-threeGoalWinner2-result"
  ];

  indicatorIds.forEach(clearAnswerIndicator);

  const snap = await getDoc(doc(db, "round32BonusResults", "official"));
  if (!snap.exists()) return;

  const results = snap.data().results || {};
  const hasOfficialCounts =
    results.extraTimeOrPenaltiesCount !== "" &&
    results.extraTimeOrPenaltiesCount != null &&
    results.redCards !== "" &&
    results.redCards != null;
  const officialThreeGoalWinners = Array.isArray(results.threeGoalWinners)
    ? results.threeGoalWinners
    : [];

  const extraTimeAnswer = getValue("round32-bonus-extraTimeCount");
  if (hasOfficialCounts && extraTimeAnswer !== "") {
    const points = scoreExactOrWithinTwo(extraTimeAnswer, results.extraTimeOrPenaltiesCount);
    setScoringIndicator(
      "round32-bonus-extraTimeCount-result",
      partialOrCorrectState(points, 4),
      points === 4 ? "Exact" : points > 0 ? "Within 2" : "Wrong",
      points
    );
  }

  const redCardsAnswer = getValue("round32-bonus-redCards");
  if (hasOfficialCounts && redCardsAnswer !== "") {
    const points = scoreExactOrWithinTwo(redCardsAnswer, results.redCards);
    setScoringIndicator(
      "round32-bonus-redCards-result",
      partialOrCorrectState(points, 4),
      points === 4 ? "Exact" : points > 0 ? "Within 2" : "Wrong",
      points
    );
  }

  [
    ["round32-bonus-threeGoalWinner1", "round32-bonus-threeGoalWinner1-result"],
    ["round32-bonus-threeGoalWinner2", "round32-bonus-threeGoalWinner2-result"]
  ].forEach(([selectId, resultId]) => {
    const selectedTeam = getValue(selectId);
    if (!selectedTeam || !officialThreeGoalWinners.length) return;

    const correct = officialThreeGoalWinners.some(team => sameCountryOption(selectedTeam, team));
    setScoringIndicator(
      resultId,
      correct ? "correct" : "wrong",
      correct ? "Correct" : "Wrong",
      correct ? 2 : 0
    );
  });
}

saveRound32BonusBtn?.addEventListener("click", async () => {
  if (!currentUser) return alert("Please sign in first.");
  if (round32BonusAnswersAreLocked()) return alert("Round of 32 bonus answers are locked.");

  const answers = {
    extraTimeOrPenaltiesCount: getValue("round32-bonus-extraTimeCount"),
    redCards: getValue("round32-bonus-redCards"),
    threeGoalWinners: [
      getValue("round32-bonus-threeGoalWinner1"),
      getValue("round32-bonus-threeGoalWinner2")
    ]
  };

  if (answers.extraTimeOrPenaltiesCount === "") {
    return alert("Enter how many Round of 32 matches will go to extra time or penalties.");
  }

  if (answers.redCards === "") {
    return alert("Enter how many red cards there will be in the Round of 32.");
  }

  if (answers.threeGoalWinners.some(team => !team)) {
    return alert("Select two teams that will win by 3 or more goals.");
  }

  if (new Set(answers.threeGoalWinners).size !== answers.threeGoalWinners.length) {
    return alert("Choose two different teams for the 3+ goal winners bonus question.");
  }

  round32BonusStatus.className = "status-message status-info";
  round32BonusStatus.textContent = "Saving Round of 32 bonus answers...";
  saveRound32BonusBtn.disabled = true;

  try {
    await setDoc(doc(db, "round32BonusAnswers", currentUser.uid), {
      uid: currentUser.uid,
      email: currentUser.email,
      answers,
      scoring: {
        countsExact: 4,
        countsWithinTwo: 2,
        threeGoalWinnerEach: 2
      },
      updatedAt: new Date().toISOString()
    }, { merge: true });

    round32BonusStatus.className = "status-message status-success";
    round32BonusStatus.textContent = "✅ Round of 32 Bonus answers saved!";
    await applyRound32BonusAnswerIndicators();
  } catch (error) {
    console.error("Failed to save Round of 32 bonus answers:", error);
    round32BonusStatus.className = "status-message status-error";
    round32BonusStatus.textContent =
      "Round of 32 bonus answers were not saved. Check Firestore rules for round32BonusAnswers.";
  } finally {
    if (!round32BonusAnswersAreLocked()) {
      saveRound32BonusBtn.disabled = false;
    }
  }
});

async function getRound32OfficialResults() {
  const snap = await getDoc(doc(db, "round32Results", "official"));
  return snap.exists() ? snap.data().results || {} : {};
}

function findRound32Match(matchId) {
  return round32Matches.find(match => match.id === matchId);
}

function round16SlotTeams(matchId, round32Results = {}) {
  const resultWinner = round32Results[matchId]?.winner;
  if (resultWinner) return [resultWinner];

  const knownWinner = knownRound32Winners[matchId];
  if (knownWinner) return [knownWinner];

  const sourceMatch = findRound32Match(matchId);
  return sourceMatch ? [sourceMatch.home, sourceMatch.away] : [];
}

function round16SlotLabel(matchId, round32Results = {}) {
  const teams = round16SlotTeams(matchId, round32Results);

  if (teams.length === 1) {
    return round32TeamLabel(teams[0]);
  }

  const sourceMatch = findRound32Match(matchId);
  const fallback = sourceMatch
    ? `${round32TeamLabel(sourceMatch.home)} / ${round32TeamLabel(sourceMatch.away)}`
    : `Match ${matchId}`;

  return `Winner Match ${matchId} (${fallback})`;
}

function round16PossibleTeams(match, round32Results = {}) {
  return sortTeamsAlphabetically([
    ...new Set(match.sourceMatchIds.flatMap(matchId => round16SlotTeams(matchId, round32Results)))
  ]);
}

function round16ResolvedParticipants(match, round32Results = {}) {
  const participants = match.sourceMatchIds.flatMap(matchId => {
    const winner = round32Results[matchId]?.winner;
    return winner ? [winner] : [];
  });

  return participants.length === 2 ? participants : [];
}

function round16MatchupLabel(match, round32Results = {}) {
  return match.sourceMatchIds.map(matchId => round16SlotLabel(matchId, round32Results)).join(" vs ");
}

function round16MatchIsLocked(match) {
  return new Date() >= new Date(match.startTime);
}

function round16PickIsRevealable(match, results = {}) {
  return round16MatchIsLocked(match) || !!results[match.id]?.winner;
}

function allRound16MatchesAreLocked() {
  return round16Matches.every(match => round16MatchIsLocked(match));
}

function round16MatchTimeLabel(match) {
  return new Date(match.startTime).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function renderRound16WinnerOptions(match, round32Results, placeholder = "Select winner") {
  return `
    <option value="">${escapeHTML(placeholder)}</option>
    ${round16PossibleTeams(match, round32Results)
      .map(team => `<option value="${escapeHTML(team)}">${escapeHTML(round32TeamLabel(team))}</option>`)
      .join("")}
  `;
}

function parseWinnerFirstScore(score) {
  const normalizedScore = normalizeWinnerFirstScore(score);
  if (!normalizedScore) return null;

  const [winnerGoals, otherGoals] = normalizedScore.split("-").map(Number);
  if (Number.isNaN(winnerGoals) || Number.isNaN(otherGoals)) return null;
  if (otherGoals > winnerGoals) return null;

  return { winnerGoals, otherGoals, totalGoals: winnerGoals + otherGoals };
}

function cleanScoreNumber(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function scorePartsFromValue(score) {
  const numbers = String(score ?? "").match(/\d+/g) || [];
  return {
    winnerGoals: numbers[0] ?? "",
    otherGoals: numbers[1] ?? ""
  };
}

function normalizeWinnerFirstScore(score) {
  const { winnerGoals, otherGoals } = scorePartsFromValue(score);
  if (winnerGoals === "" || otherGoals === "") return "";

  return `${Number(winnerGoals)}-${Number(otherGoals)}`;
}

function setRound16ScoreInputs(prefix, matchId, score) {
  const { winnerGoals, otherGoals } = scorePartsFromValue(score);
  setValue(`${prefix}-${matchId}-winnerGoals`, cleanScoreNumber(winnerGoals));
  setValue(`${prefix}-${matchId}-otherGoals`, cleanScoreNumber(otherGoals));
}

function getRound16ScoreFromInputs(prefix, matchId) {
  const winnerGoalsId = `${prefix}-${matchId}-winnerGoals`;
  const otherGoalsId = `${prefix}-${matchId}-otherGoals`;
  const winnerGoals = cleanScoreNumber(getValue(winnerGoalsId));
  const otherGoals = cleanScoreNumber(getValue(otherGoalsId));

  setValue(winnerGoalsId, winnerGoals);
  setValue(otherGoalsId, otherGoals);

  if (winnerGoals === "" && otherGoals === "") return "";
  if (winnerGoals === "" || otherGoals === "") return null;

  return `${Number(winnerGoals)}-${Number(otherGoals)}`;
}

function setupNumericScoreInputs(root) {
  if (!root) return;

  root.querySelectorAll("[data-score-number]").forEach(input => {
    const cleanInput = () => {
      input.value = cleanScoreNumber(input.value);
    };

    input.addEventListener("input", cleanInput);
    input.addEventListener("blur", cleanInput);
  });
}

function validateRound16Score(score, label) {
  const parsed = parseWinnerFirstScore(score);
  if (!parsed) {
    return `${label}: score must be formatted like 2-1, 3-0, or 1-1. No spaces, and the selected winner's score must be first.`;
  }

  return "";
}

async function renderRound16Picks() {
  if (!round16PicksForm) return;

  const round32Results = await getRound32OfficialResults();
  round16PicksForm.innerHTML = "";

  round16Matches.forEach(match => {
    const locked = round16MatchIsLocked(match);
    const wrapper = document.createElement("div");
    wrapper.className = "pick-card";
    const matchupLabel = round16MatchupLabel(match, round32Results);

    wrapper.innerHTML = `
      <h3>${escapeHTML(matchupLabel)} ${locked ? "🔒" : ""}</h3>
      <p class="lock-note">Kickoff: <strong>${round16MatchTimeLabel(match)}</strong> · ${escapeHTML(match.venue)}</p>

      <label>Winner</label>
      <select id="round16-${match.id}-winner" ${locked ? "disabled" : ""}>
        ${renderRound16WinnerOptions(match, round32Results)}
      </select>

      <label>Full-time score</label>
      <div class="score-entry-row" aria-label="Full-time score">
        <input
          id="round16-${match.id}-winnerGoals"
          class="score-number-input"
          type="text"
          inputmode="numeric"
          pattern="[0-9]*"
          autocomplete="off"
          enterkeyhint="next"
          data-score-number
          aria-label="Selected winner full-time goals"
          ${locked ? "disabled" : ""}
        />
        <span class="score-entry-dash">-</span>
        <input
          id="round16-${match.id}-otherGoals"
          class="score-number-input"
          type="text"
          inputmode="numeric"
          pattern="[0-9]*"
          autocomplete="off"
          enterkeyhint="done"
          data-score-number
          aria-label="Opponent full-time goals"
          ${locked ? "disabled" : ""}
        />
      </div>
      <p class="mini-note">Put your winner first. Examples: 2-1, 3-0, 1-1.</p>

      <label class="checkbox-row">
        <input type="checkbox" id="round16-${match.id}-extraTimeOrPenalties" ${locked ? "disabled" : ""} />
        Goes to extra time or penalties
      </label>
      <p id="round16-${match.id}-result" class="answer-result"></p>
    `;

    round16PicksForm.appendChild(wrapper);
  });

  setupNumericScoreInputs(round16PicksForm);

  if (allRound16MatchesAreLocked()) {
    round16PicksStatus.textContent = "🔒 All Round of 16 picks are locked.";
    saveRound16PicksBtn.disabled = true;
    saveRound16PicksBtn.textContent = "Round of 16 Picks Locked";
  } else {
    saveRound16PicksBtn.disabled = false;
    saveRound16PicksBtn.textContent = "Save Round of 16 Picks";
  }
}

async function loadExistingRound16Picks() {
  const snap = await getDoc(doc(db, "round16Picks", currentUser.uid));
  if (!snap.exists()) return;

  const data = snap.data();

  Object.entries(data.picks || {}).forEach(([matchId, pick]) => {
    setValue(`round16-${matchId}-winner`, pick.winner);
    setRound16ScoreInputs("round16", matchId, pick.score);

    const extraTimeOrPenalties = document.getElementById(`round16-${matchId}-extraTimeOrPenalties`);
    if (extraTimeOrPenalties) {
      extraTimeOrPenalties.checked = !!pick.extraTimeOrPenalties;
    }
  });

  if (allRound16MatchesAreLocked()) {
    round16PicksStatus.className = "status-message status-locked";
    round16PicksStatus.textContent = "🔒 All Round of 16 picks are locked.";
  } else {
    round16PicksStatus.className = "status-message status-info";
    round16PicksStatus.textContent = "Loaded saved Round of 16 picks.";
  }

  await applyRound16PickIndicators();
}

async function applyRound16PickIndicators() {
  const snap = await getDoc(doc(db, "round16Results", "official"));
  if (!snap.exists()) return;

  const results = snap.data().results || {};

  round16Matches.forEach(match => {
    const indicatorId = `round16-${match.id}-result`;
    clearScoringIndicator(indicatorId);

    const result = results[match.id];
    const winner = getValue(`round16-${match.id}-winner`);
    const score = getRound16ScoreFromInputs("round16", match.id);
    const resultScore = normalizeWinnerFirstScore(result?.score);
    if (!winner || !result?.winner) return;

    const winnerCorrect = sameCountryOption(winner, result.winner);
    const scoreCorrect =
      !!parseWinnerFirstScore(score) &&
      !!parseWinnerFirstScore(resultScore) &&
      score === resultScore;
    const pickedExtraTime = document.getElementById(`round16-${match.id}-extraTimeOrPenalties`)?.checked || false;

    let points = 0;
    if (winnerCorrect) points += 3;
    if (scoreCorrect) points += 2;
    if (pickedExtraTime) points += result.extraTimeOrPenalties ? 1 : -1;

    const labelParts = [];
    labelParts.push(winnerCorrect ? "Winner ✓" : "Winner X");
    if (score) labelParts.push(scoreCorrect ? "score ✓" : "score X");
    if (pickedExtraTime) labelParts.push(result.extraTimeOrPenalties ? "ET/Pens ✓" : "ET/Pens X");

    setScoringIndicator(
      indicatorId,
      pointsState(points),
      labelParts.join(", "),
      points
    );
  });
}

saveRound16PicksBtn?.addEventListener("click", async () => {
  if (!currentUser) return alert("Please sign in first.");
  if (allRound16MatchesAreLocked()) return alert("All Round of 16 picks are locked.");

  const round32Results = await getRound32OfficialResults();
  const existingSnap = await getDoc(doc(db, "round16Picks", currentUser.uid));
  const picks = existingSnap.exists() ? existingSnap.data().picks || {} : {};

  let savedAnyUnlockedMatch = false;

  for (const match of round16Matches) {
    if (round16MatchIsLocked(match)) continue;

    const winner = getValue(`round16-${match.id}-winner`);
    const score = getRound16ScoreFromInputs("round16", match.id);
    const extraTimeOrPenalties =
      document.getElementById(`round16-${match.id}-extraTimeOrPenalties`)?.checked || false;

    if (!winner) return alert(`Pick a winner for ${match.label}.`);

    const validTeams = round16PossibleTeams(match, round32Results);
    if (!validTeams.includes(winner)) return alert(`${match.label}: selected winner is not valid for this matchup.`);

    const scoreError = score === null
      ? `${match.label}: enter both score numbers.`
      : validateRound16Score(score, match.label);
    if (scoreError) return alert(scoreError);

    picks[match.id] = { winner, score, extraTimeOrPenalties };
    savedAnyUnlockedMatch = true;
  }

  if (!savedAnyUnlockedMatch) {
    return alert("No unlocked Round of 16 matches are available to save.");
  }

  await setDoc(doc(db, "round16Picks", currentUser.uid), {
    uid: currentUser.uid,
    email: currentUser.email,
    picks,
    scoring: { winner: 3, score: 2, extraTimeOrPenaltiesCorrect: 1, extraTimeOrPenaltiesWrong: -1 },
    updatedAt: new Date().toISOString()
  }, { merge: true });

  round16PicksStatus.className = "status-message status-success";
  round16PicksStatus.textContent =
    "✅ Round of 16 picks saved! Now select your Round of 16 bonus answers below.";
  await applyRound16PickIndicators();
  round16BonusSection?.scrollIntoView({ behavior: "smooth", block: "start" });
});

function round16BonusAnswersAreLocked() {
  return round16MatchIsLocked(round16Matches[0]);
}

function renderRound16MatchOptions(round32Results, placeholder = "Select match") {
  return `
    <option value="">${escapeHTML(placeholder)}</option>
    ${round16Matches
      .map(match => `<option value="${escapeHTML(match.id)}">${escapeHTML(`${match.label}: ${round16MatchupLabel(match, round32Results)}`)}</option>`)
      .join("")}
  `;
}

function renderRound16RegionOptions(placeholder = "Select region") {
  return `
    <option value="">${escapeHTML(placeholder)}</option>
    ${round16RegionOptions
      .map(region => `<option value="${escapeHTML(region)}">${escapeHTML(region)}</option>`)
      .join("")}
  `;
}

function renderRound16RegionCountryGuide(round32Results = {}) {
  const possibleTeams = sortTeamsAlphabetically([
    ...new Set(round16Matches.flatMap(match => round16PossibleTeams(match, round32Results)))
  ]);

  const teamsByRegion = Object.fromEntries(round16RegionOptions.map(region => [region, []]));
  const unassignedTeams = [];

  possibleTeams.forEach(team => {
    const region = round16TeamRegions[cleanCountryName(team)];
    if (round16RegionOptions.includes(region)) {
      teamsByRegion[region].push(team);
    } else {
      unassignedTeams.push(team);
    }
  });

  return `
    <div class="region-guide">
      ${round16RegionOptions.map(region => `
        <p><strong>${escapeHTML(region)}:</strong> ${teamsByRegion[region].map(team => escapeHTML(round32TeamLabel(team))).join(", ") || "None"}</p>
      `).join("")}
      ${unassignedTeams.length ? `
        <p><strong>Not in selected regions:</strong> ${unassignedTeams.map(team => escapeHTML(round32TeamLabel(team))).join(", ")}</p>
      ` : ""}
    </div>
  `;
}

async function renderRound16BonusQuestions() {
  if (!round16BonusForm) return;

  const round32Results = await getRound32OfficialResults();

  round16BonusForm.innerHTML = `
    <div class="pick-card">
      <label>1. Which Round of 16 match will have the most total goals?</label>
      <p class="mini-note">Correct match = 2 points.</p>
      <select id="round16-bonus-mostGoalsMatch">
        ${renderRound16MatchOptions(round32Results)}
      </select>
      <p id="round16-bonus-mostGoalsMatch-result" class="answer-result"></p>
    </div>

    <div class="pick-card">
      <label>2. How many clean sheets will there be in the Round of 16?</label>
      <p class="mini-note">Exact = 3 points. Within 1 = 2 points.</p>
      <input id="round16-bonus-cleanSheets" type="number" min="0" max="16" />
      <p id="round16-bonus-cleanSheets-result" class="answer-result"></p>
    </div>

    <div class="pick-card">
      <label>3. Order the regions by most goals scored during the Round of 16.</label>
      <p class="mini-note">Each correct spot = 1 point.</p>
      ${renderRound16RegionCountryGuide(round32Results)}
      <select id="round16-bonus-regionRank1">${renderRound16RegionOptions("1st most goals")}</select>
      <p id="round16-bonus-regionRank1-result" class="answer-result"></p>
      <select id="round16-bonus-regionRank2">${renderRound16RegionOptions("2nd most goals")}</select>
      <p id="round16-bonus-regionRank2-result" class="answer-result"></p>
      <select id="round16-bonus-regionRank3">${renderRound16RegionOptions("3rd most goals")}</select>
      <p id="round16-bonus-regionRank3-result" class="answer-result"></p>
      <select id="round16-bonus-regionRank4">${renderRound16RegionOptions("4th most goals")}</select>
      <p id="round16-bonus-regionRank4-result" class="answer-result"></p>
    </div>
  `;

  if (round16BonusAnswersAreLocked()) {
    round16BonusStatus.className = "status-message status-locked";
    round16BonusStatus.textContent = "🔒 Round of 16 bonus answers are locked.";
    saveRound16BonusBtn.disabled = true;
    saveRound16BonusBtn.textContent = "Round of 16 Bonus Locked";
    [
      "round16-bonus-mostGoalsMatch",
      "round16-bonus-cleanSheets",
      "round16-bonus-regionRank1",
      "round16-bonus-regionRank2",
      "round16-bonus-regionRank3",
      "round16-bonus-regionRank4"
    ].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = true;
    });
  } else {
    round16BonusStatus.className = "";
    saveRound16BonusBtn.disabled = false;
    saveRound16BonusBtn.textContent = "Save Round of 16 Bonus Answers";
  }
}

async function loadExistingRound16BonusAnswers() {
  let snap;

  try {
    snap = await getDoc(doc(db, "round16BonusAnswers", currentUser.uid));
  } catch (error) {
    console.error("Failed to load Round of 16 bonus answers:", error);
    round16BonusStatus.className = "status-message status-error";
    round16BonusStatus.textContent =
      "Could not load saved Round of 16 bonus answers. Check Firestore rules for round16BonusAnswers.";
    return;
  }

  if (!snap.exists()) return;

  const answers = snap.data().answers || {};
  const regionOrder = Array.isArray(answers.regionOrder) ? answers.regionOrder : [];

  setValue("round16-bonus-mostGoalsMatch", answers.mostGoalsMatch);
  setValue("round16-bonus-cleanSheets", answers.cleanSheets);
  setValue("round16-bonus-regionRank1", regionOrder[0]);
  setValue("round16-bonus-regionRank2", regionOrder[1]);
  setValue("round16-bonus-regionRank3", regionOrder[2]);
  setValue("round16-bonus-regionRank4", regionOrder[3]);

  if (!round16BonusAnswersAreLocked()) {
    round16BonusStatus.className = "status-message status-info";
    round16BonusStatus.textContent = "Loaded saved Round of 16 bonus answers.";
  }

  await applyRound16BonusIndicators();
}

async function applyRound16BonusIndicators() {
  [
    "round16-bonus-mostGoalsMatch-result",
    "round16-bonus-cleanSheets-result",
    "round16-bonus-regionRank1-result",
    "round16-bonus-regionRank2-result",
    "round16-bonus-regionRank3-result",
    "round16-bonus-regionRank4-result"
  ].forEach(clearScoringIndicator);

  const [round16Snap, round32Snap] = await Promise.all([
    getDoc(doc(db, "round16Results", "official")),
    getDoc(doc(db, "round32Results", "official"))
  ]);
  if (!round16Snap.exists()) return;

  const round16Results = round16Snap.data().results || {};
  const round32Results = round32Snap.exists() ? round32Snap.data().results || {} : {};

  const mostGoalsAnswer = getValue("round16-bonus-mostGoalsMatch");
  if (mostGoalsAnswer) {
    const correct = calculateRound16MostGoalsMatchIds(round16Results).includes(mostGoalsAnswer);
    setScoringIndicator(
      "round16-bonus-mostGoalsMatch-result",
      correct ? "correct" : "wrong",
      correct ? "Correct match" : "Wrong match",
      correct ? 2 : 0
    );
  }

  const cleanSheetsAnswer = getValue("round16-bonus-cleanSheets");
  if (cleanSheetsAnswer !== "") {
    const points = scoreExactOrWithinOne(cleanSheetsAnswer, calculateRound16CleanSheets(round16Results));
    setScoringIndicator(
      "round16-bonus-cleanSheets-result",
      partialOrCorrectState(points, 3),
      points === 3 ? "Exact" : points > 0 ? "Within 1" : "Wrong",
      points
    );
  }

  const actualRegionOrder = calculateRound16RegionOrder(round16Results, round32Results);
  [1, 2, 3, 4].forEach(position => {
    const selectId = `round16-bonus-regionRank${position}`;
    const resultId = `${selectId}-result`;
    const answer = getValue(selectId);
    if (!answer) return;

    const correct = answer === actualRegionOrder[position - 1];
    setScoringIndicator(
      resultId,
      correct ? "correct" : "wrong",
      correct ? `Spot ${position} correct` : `Spot ${position} wrong`,
      correct ? 1 : 0
    );
  });
}

saveRound16BonusBtn?.addEventListener("click", async () => {
  if (!currentUser) return alert("Please sign in first.");
  if (round16BonusAnswersAreLocked()) return alert("Round of 16 bonus answers are locked.");

  const regionOrder = [
    getValue("round16-bonus-regionRank1"),
    getValue("round16-bonus-regionRank2"),
    getValue("round16-bonus-regionRank3"),
    getValue("round16-bonus-regionRank4")
  ];

  const answers = {
    mostGoalsMatch: getValue("round16-bonus-mostGoalsMatch"),
    cleanSheets: getValue("round16-bonus-cleanSheets"),
    regionOrder
  };

  if (!answers.mostGoalsMatch) return alert("Select the Round of 16 match with the most total goals.");
  if (answers.cleanSheets === "") return alert("Enter how many clean sheets there will be in the Round of 16.");
  if (regionOrder.some(region => !region)) return alert("Fill all four region ranking spots.");
  if (new Set(regionOrder).size !== regionOrder.length) {
    return alert("Use each region exactly once in the Round of 16 region order.");
  }

  round16BonusStatus.className = "status-message status-info";
  round16BonusStatus.textContent = "Saving Round of 16 bonus answers...";
  saveRound16BonusBtn.disabled = true;

  try {
    await setDoc(doc(db, "round16BonusAnswers", currentUser.uid), {
      uid: currentUser.uid,
      email: currentUser.email,
      answers,
      scoring: {
        mostGoalsMatch: 2,
        cleanSheetsExact: 3,
        cleanSheetsWithinOne: 2,
        regionOrderEachSpot: 1
      },
      updatedAt: new Date().toISOString()
    }, { merge: true });

    round16BonusStatus.className = "status-message status-success";
    round16BonusStatus.textContent = "✅ Round of 16 bonus answers saved!";
    await applyRound16BonusIndicators();
  } catch (error) {
    console.error("Failed to save Round of 16 bonus answers:", error);
    round16BonusStatus.className = "status-message status-error";
    round16BonusStatus.textContent =
      "Round of 16 bonus answers were not saved. Check Firestore rules for round16BonusAnswers.";
  } finally {
    if (!round16BonusAnswersAreLocked()) {
      saveRound16BonusBtn.disabled = false;
    }
  }
});

function renderBonusQuiz() {
  bonusForm.innerHTML = `
    <div class="pick-card">
      <label>1. Which country will score the most goals in the tournament?</label>
      <select id="bonus-mostGoalsCountry">
        <option value="">Select country</option>
        ${renderCountryOptions()}
      </select>
      <p id="bonus-mostGoalsCountry-result" class="answer-result"></p>
    </div>

    <div class="pick-card">
      <label>2. How many yellow cards total in the tournament? <span class="yellow-note">(within 10 = correct)</span></label>
      <input id="bonus-yellowCards" type="number" min="0" />
      <p id="bonus-yellowCards-result" class="answer-result"></p>
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
      <p id="bonus-usaOut-result" class="answer-result"></p>
    </div>

    <div class="pick-card">
      <label>4. Name 1 team that will make the semifinals.</label>
      <select id="bonus-semifinalist">
        <option value="">Select country</option>
        ${renderCountryOptions()}
      </select>
      <p id="bonus-semifinalist-result" class="answer-result"></p>
    </div>

    <div class="pick-card">
      <label>5. Who will win the 2026 FIFA World Cup?</label>
      <select id="bonus-winner">
        <option value="">Select country</option>
        ${renderCountryOptions()}
      </select>
      <p id="bonus-winner-result" class="answer-result"></p>
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

  await applyBonusAnswerIndicators();
}

async function applyBonusAnswerIndicators() {
  [
    "bonus-mostGoalsCountry-result",
    "bonus-yellowCards-result",
    "bonus-usaOut-result",
    "bonus-semifinalist-result",
    "bonus-winner-result"
  ].forEach(clearScoringIndicator);

  const snap = await getDoc(doc(db, "bonusResults", "official"));
  if (!snap.exists()) return;

  const results = snap.data().results || {};

  const mostGoalsCountry = getValue("bonus-mostGoalsCountry");
  if (mostGoalsCountry && results.mostGoalsCountry) {
    const correct = sameCountryOption(mostGoalsCountry, results.mostGoalsCountry);
    setScoringIndicator("bonus-mostGoalsCountry-result", correct ? "correct" : "wrong", correct ? "Correct" : "Wrong", correct ? 1 : 0);
  }

  const yellowCards = getValue("bonus-yellowCards");
  if (yellowCards !== "" && results.yellowCards !== "" && results.yellowCards != null) {
    const guess = Number(yellowCards);
    const actual = Number(results.yellowCards);
    const correct = !Number.isNaN(guess) && !Number.isNaN(actual) && Math.abs(guess - actual) <= 10;
    setScoringIndicator("bonus-yellowCards-result", correct ? "correct" : "wrong", correct ? "Within 10" : "Wrong", correct ? 1 : 0);
  }

  const usaOut = getValue("bonus-usaOut");
  if (usaOut && results.usaOut) {
    const correct = usaOut === results.usaOut;
    setScoringIndicator("bonus-usaOut-result", correct ? "correct" : "wrong", correct ? "Correct" : "Wrong", correct ? 1 : 0);
  }

  const semifinalist = getValue("bonus-semifinalist");
  if (semifinalist && Array.isArray(results.semifinalists) && results.semifinalists.length) {
    const correct = results.semifinalists.some(team => sameCountryOption(semifinalist, team));
    setScoringIndicator("bonus-semifinalist-result", correct ? "correct" : "wrong", correct ? "Correct semifinalist" : "Wrong", correct ? 1 : 0);
  } else if (semifinalist) {
    const eliminated = await bonusSemifinalistIsEliminated(semifinalist);
    if (eliminated) {
      setScoringIndicator("bonus-semifinalist-result", "wrong", "Knocked out", 0);
    }
  }

  const winner = getValue("bonus-winner");
  if (winner && results.winner) {
    const correct = sameCountryOption(winner, results.winner);
    setScoringIndicator("bonus-winner-result", correct ? "correct" : "wrong", correct ? "Correct" : "Wrong", correct ? 1 : 0);
  }
}

async function bonusSemifinalistIsEliminated(team) {
  const [round32Snap, round16Snap] = await Promise.all([
    getDoc(doc(db, "round32Results", "official")),
    getDoc(doc(db, "round16Results", "official"))
  ]);

  const round32Results = round32Snap.exists() ? round32Snap.data().results || {} : {};
  const round16Results = round16Snap.exists() ? round16Snap.data().results || {} : {};

  const round32Match = round32Matches.find(match =>
    sameCountryOption(team, match.home) || sameCountryOption(team, match.away)
  );

  if (round32Match) {
    const result = round32Results[round32Match.id];
    const knownWinner = result?.winner || knownRound32Winners[round32Match.id];
    if (knownWinner && !sameCountryOption(team, knownWinner)) return true;
    if (!knownWinner) return false;
  }

  const round16Match = round16Matches.find(match =>
    round16PossibleTeams(match, round32Results).some(possibleTeam => sameCountryOption(team, possibleTeam))
  );

  if (round16Match) {
    const result = round16Results[round16Match.id];
    if (result?.winner && !sameCountryOption(team, result.winner)) return true;
  }

  return false;
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
  await applyBonusAnswerIndicators();
}

function renderRootingForPicker() {
  const form = document.getElementById("rootingForForm");
  if (!form) return;

  form.innerHTML = `
    <select id="rooting-country-1">
      <option value="">Select country #1</option>
      ${renderCountryOptions()}
    </select>
    <select id="rooting-country-2">
      <option value="">Select country #2 optional</option>
      ${renderCountryOptions()}
    </select>
  `;

  rootingCountry1 = document.getElementById("rooting-country-1");
  rootingCountry2 = document.getElementById("rooting-country-2");
}

async function loadExistingRootingForCountries(userData = {}) {
  let rootingForCountries = Array.isArray(userData.rootingForCountries)
    ? userData.rootingForCountries
    : [];

  if (!rootingForCountries.length && currentUser) {
    try {
      const publicSnap = await getDoc(doc(db, "publicRootingFor", currentUser.uid));
      if (publicSnap.exists() && Array.isArray(publicSnap.data().rootingForCountries)) {
        rootingForCountries = publicSnap.data().rootingForCountries;
      }
    } catch (error) {
      console.warn("Could not load public rooting-for fallback:", error);
    }
  }

  setValue("rooting-country-1", rootingForCountries[0]);
  setValue("rooting-country-2", rootingForCountries[1]);

  if (rootingForCountries.length && rootingForStatus) {
    rootingForStatus.className = "status-message status-info";
    rootingForStatus.textContent = "Loaded saved rooting-for countries.";
  }
}

async function saveRootingForCountries() {
  if (!currentUser) return alert("Please sign in first.");

  const rootingForCountries = [
    getValue("rooting-country-1"),
    getValue("rooting-country-2")
  ].filter(Boolean);

  if (!rootingForCountries.length) {
    return alert("Pick at least one country you're rooting for.");
  }

  if (new Set(rootingForCountries).size !== rootingForCountries.length) {
    return alert("Choose two different countries, or leave the second one blank.");
  }

  const updatedAt = new Date().toISOString();

  try {
    await setDoc(doc(db, "users", currentUser.uid), {
      rootingForCountries,
      updatedAt
    }, { merge: true });

    await setDoc(doc(db, "publicRootingFor", currentUser.uid), {
      uid: currentUser.uid,
      rootingForCountries,
      updatedAt
    }, { merge: true });
  } catch (error) {
    console.error("Failed to save rooting-for countries:", error);
    rootingForStatus.className = "status-message status-error";
    rootingForStatus.textContent =
      "Rooting-for countries were not saved. Check Firestore rules for publicRootingFor.";
    return;
  }

  rootingForStatus.className = "status-message status-success";
  rootingForStatus.textContent = "✅ Rooting-for countries saved!";

  if (ADMIN_EMAILS.includes(currentUser.email)) {
    await renderLeaderboardFromFirestore();
  } else {
    await renderPublicLeaderboard();
  }
}

function renderAdminBonusResults() {
  adminBonusResultsForm.innerHTML = `
    <div class="pick-card">
      <label>1. Country with most tournament goals</label>
      <select id="result-bonus-mostGoalsCountry">
        <option value="">Select country</option>
        ${renderCountryOptions()}
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
      <select id="result-bonus-semi1"><option value="">Semi team 1</option>${renderCountryOptions()}</select>
      <select id="result-bonus-semi2"><option value="">Semi team 2</option>${renderCountryOptions()}</select>
      <select id="result-bonus-semi3"><option value="">Semi team 3</option>${renderCountryOptions()}</select>
      <select id="result-bonus-semi4"><option value="">Semi team 4</option>${renderCountryOptions()}</select>
    </div>

    <div class="pick-card">
      <label>5. World Cup winner</label>
      <select id="result-bonus-winner">
        <option value="">Select country</option>
        ${renderCountryOptions()}
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
  await applyBonusAnswerIndicators();
  await renderLeaderboardFromFirestore();
}

function scoreBonusAnswers(answers, results) {
  if (!answers || !results) return 0;

  let points = 0;

  if (sameCountryOption(answers.mostGoalsCountry, results.mostGoalsCountry)) points += 1;

  const guessYellow = Number(answers.yellowCards);
  const actualYellow = Number(results.yellowCards);
  if (!Number.isNaN(guessYellow) && !Number.isNaN(actualYellow)) {
    if (Math.abs(guessYellow - actualYellow) <= 10) points += 1;
  }

  if (answers.usaOut && answers.usaOut === results.usaOut) points += 1;

  if (
    answers.semifinalist &&
    Array.isArray(results.semifinalists) &&
    results.semifinalists.some(team => sameCountryOption(answers.semifinalist, team))
  ) {
    points += 1;
  }

  if (sameCountryOption(answers.winner, results.winner)) points += 1;

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
  await applyGroupPickIndicators();
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
  await applyRound32PickIndicators();
  await renderRound16Picks();
  await loadExistingRound16Picks();
  await renderLeaderboardFromFirestore();
});

function scoreRound32Picks(picks, results) {
  if (!picks || !results) return 0;

  let points = 0;

  Object.entries(picks).forEach(([matchId, pick]) => {
    const result = results[matchId];
    if (!pick || !result?.winner) return;

    // Winner prediction
    if (pick.winner === result.winner) {
      points += 3;
    }

    // Extra Time / Penalties prediction
    // Checked & correct = +1
    // Checked & wrong = -1
    // Unchecked = 0
    if (pick.extraTimeOrPenalties) {
      if (result.extraTimeOrPenalties) {
        points += 1;
      } else {
        points -= 1;
      }
    }
  });

  return points;
}

async function renderAdminRound16Results() {
  if (!adminRound16ResultsForm) return;

  const round32Results = await getRound32OfficialResults();
  adminRound16ResultsForm.innerHTML = "";

  round16Matches.forEach(match => {
    const wrapper = document.createElement("div");
    wrapper.className = "pick-card";
    const matchupLabel = round16MatchupLabel(match, round32Results);

    wrapper.innerHTML = `
      <h3>${escapeHTML(matchupLabel)} Official Result</h3>

      <label>Winner</label>
      <select id="result-round16-${match.id}-winner">
        ${renderRound16WinnerOptions(match, round32Results)}
      </select>

      <label>Full-time score</label>
      <div class="score-entry-row" aria-label="Official full-time score">
        <input
          id="result-round16-${match.id}-winnerGoals"
          class="score-number-input"
          type="text"
          inputmode="numeric"
          pattern="[0-9]*"
          autocomplete="off"
          enterkeyhint="next"
          data-score-number
          aria-label="Official winner full-time goals"
        />
        <span class="score-entry-dash">-</span>
        <input
          id="result-round16-${match.id}-otherGoals"
          class="score-number-input"
          type="text"
          inputmode="numeric"
          pattern="[0-9]*"
          autocomplete="off"
          enterkeyhint="done"
          data-score-number
          aria-label="Official opponent full-time goals"
        />
      </div>
      <p class="mini-note">Put the winner's full-time score first. Use 1-1 for matches tied after full time.</p>

      <label class="checkbox-row">
        <input type="checkbox" id="result-round16-${match.id}-extraTimeOrPenalties" />
        Went to extra time or penalties
      </label>
    `;

    adminRound16ResultsForm.appendChild(wrapper);
  });

  setupNumericScoreInputs(adminRound16ResultsForm);
}

async function loadExistingRound16Results() {
  const snap = await getDoc(doc(db, "round16Results", "official"));
  if (!snap.exists()) return;

  const results = snap.data().results || {};

  Object.entries(results).forEach(([matchId, result]) => {
    setValue(`result-round16-${matchId}-winner`, result.winner);
    setRound16ScoreInputs("result-round16", matchId, result.score);

    const extraTimeOrPenalties = document.getElementById(`result-round16-${matchId}-extraTimeOrPenalties`);
    if (extraTimeOrPenalties) {
      extraTimeOrPenalties.checked = !!result.extraTimeOrPenalties;
    }
  });
}

saveRound16ResultsBtn?.addEventListener("click", async () => {
  const round32Results = await getRound32OfficialResults();
  const results = {};

  for (const match of round16Matches) {
    const winner = getValue(`result-round16-${match.id}-winner`);
    const score = getRound16ScoreFromInputs("result-round16", match.id);
    const extraTimeOrPenalties =
      document.getElementById(`result-round16-${match.id}-extraTimeOrPenalties`)?.checked || false;

    if (winner) {
      const validTeams = round16PossibleTeams(match, round32Results);
      if (!validTeams.includes(winner)) {
        return alert(`${match.label}: selected winner is not valid for this matchup.`);
      }

      const scoreError = score === null
        ? `${match.label}: enter both score numbers.`
        : validateRound16Score(score, match.label);
      if (scoreError) return alert(scoreError);
    } else if (score !== "") {
      return alert(`${match.label}: select a winner before entering a score.`);
    }

    const participants = round16ResolvedParticipants(match, round32Results);
    const uncoveredRegionTeams = getRound16RegionCoverageGaps(participants);
    if (winner && uncoveredRegionTeams.length) {
      return alert(
        `${match.label}: Round of 16 region bonus choices do not include ${uncoveredRegionTeams.join(", ")}. Add the missing region before saving this result.`
      );
    }

    results[match.id] = {
      winner,
      score,
      extraTimeOrPenalties,
      participants
    };
  }

  await setDoc(doc(db, "round16Results", "official"), {
    results,
    updatedAt: new Date().toISOString(),
    updatedBy: currentUser.email
  }, { merge: true });

  round16ResultsStatus.textContent = "✅ Round of 16 results saved!";
  await renderRound16Picks();
  await renderRound16BonusQuestions();
  await loadExistingRound16Picks();
  await loadExistingRound16BonusAnswers();
  await renderLeaderboardFromFirestore();
});

function scoreRound16Picks(picks, results) {
  if (!picks || !results) return 0;

  let points = 0;

  Object.entries(picks).forEach(([matchId, pick]) => {
    const result = results[matchId];
    if (!pick || !result?.winner) return;

    if (sameCountryOption(pick.winner, result.winner)) {
      points += 3;
    }

    const pickScore = normalizeWinnerFirstScore(pick.score);
    const resultScore = normalizeWinnerFirstScore(result.score);
    if (
      parseWinnerFirstScore(pickScore) &&
      parseWinnerFirstScore(resultScore) &&
      pickScore === resultScore
    ) {
      points += 2;
    }

    if (pick.extraTimeOrPenalties) {
      points += result.extraTimeOrPenalties ? 1 : -1;
    }
  });

  return points;
}

function renderAdminRound32BonusResults() {
  adminRound32BonusResultsForm.innerHTML = `
    <div class="pick-card">
      <label>Official number of Round of 32 matches that went to extra time or penalties</label>
      <input id="result-round32-bonus-extraTimeCount" type="number" min="0" max="16" />
    </div>

    <div class="pick-card">
      <label>Official Round of 32 red card total</label>
      <input id="result-round32-bonus-redCards" type="number" min="0" />
    </div>

    <div class="pick-card">
      <label>Teams that won by 3+ goals during the Round of 32</label>
      <p class="mini-note">Select every valid answer. Each matching user pick earns 2 points.</p>
      <div class="admin-checkbox-grid">
        ${countryOptions.map(team => `
          <label class="checkbox-row">
            <input type="checkbox" data-round32-bonus-team="${escapeHTML(team)}" />
            ${escapeHTML(countryOptionLabel(team))}
          </label>
        `).join("")}
      </div>
    </div>
  `;
}

async function loadExistingRound32BonusResults() {
  const snap = await getDoc(doc(db, "round32BonusResults", "official"));
  if (!snap.exists()) return;

  const results = snap.data().results || {};

  setValue("result-round32-bonus-extraTimeCount", results.extraTimeOrPenaltiesCount);
  setValue("result-round32-bonus-redCards", results.redCards);

  const threeGoalWinners = new Set(results.threeGoalWinners || []);
  adminRound32BonusResultsForm
    .querySelectorAll("[data-round32-bonus-team]")
    .forEach(input => {
      input.checked = Array.from(threeGoalWinners).some(team =>
        sameCountryOption(team, input.dataset.round32BonusTeam)
      );
    });
}

saveRound32BonusResultsBtn?.addEventListener("click", async () => {
  const threeGoalWinners = Array.from(
    adminRound32BonusResultsForm.querySelectorAll("[data-round32-bonus-team]:checked")
  ).map(input => input.dataset.round32BonusTeam);

  const results = {
    extraTimeOrPenaltiesCount: getValue("result-round32-bonus-extraTimeCount"),
    redCards: getValue("result-round32-bonus-redCards"),
    threeGoalWinners
  };

  await setDoc(doc(db, "round32BonusResults", "official"), {
    results,
    updatedAt: new Date().toISOString(),
    updatedBy: currentUser.email
  }, { merge: true });

  round32BonusResultsStatus.textContent = "✅ Round of 32 bonus results saved!";
  await applyRound32BonusAnswerIndicators();
  await renderLeaderboardFromFirestore();
});

function scoreRound32BonusAnswers(answers, results) {
  if (!answers || !results) return 0;

  let points = 0;

  points += scoreExactOrWithinTwo(
    answers.extraTimeOrPenaltiesCount,
    results.extraTimeOrPenaltiesCount
  );
  points += scoreExactOrWithinTwo(answers.redCards, results.redCards);

  const userThreeGoalWinners = Array.isArray(answers.threeGoalWinners)
    ? answers.threeGoalWinners
    : [answers.threeGoalWinner].filter(Boolean);

  if (Array.isArray(results.threeGoalWinners)) {
    const uniquePicks = [...new Set(userThreeGoalWinners.filter(Boolean))];
    uniquePicks.forEach(team => {
      if (results.threeGoalWinners.some(resultTeam => sameCountryOption(team, resultTeam))) {
        points += 2;
      }
    });
  }

  return points;
}

function getRound16OfficialScores(results = {}) {
  return round16Matches
    .map(match => {
      const result = results[match.id];
      const parsed = result?.score ? parseWinnerFirstScore(result.score) : null;
      if (!result?.winner || !parsed) return null;
      return { match, result, parsed };
    })
    .filter(Boolean);
}

function calculateRound16CleanSheets(results = {}) {
  return getRound16OfficialScores(results).reduce((total, { parsed }) => {
    if (parsed.winnerGoals === 0 && parsed.otherGoals === 0) return total + 2;
    if (parsed.otherGoals === 0) return total + 1;
    return total;
  }, 0);
}

function calculateRound16MostGoalsMatchIds(results = {}) {
  const scoredMatches = getRound16OfficialScores(results);
  if (!scoredMatches.length) return [];

  const maxGoals = Math.max(...scoredMatches.map(({ parsed }) => parsed.totalGoals));
  return scoredMatches
    .filter(({ parsed }) => parsed.totalGoals === maxGoals)
    .map(({ match }) => match.id);
}

function getRound16ResultParticipants(match, result, round32Results = {}) {
  if (Array.isArray(result?.participants) && result.participants.length === 2) {
    return result.participants;
  }

  return round16ResolvedParticipants(match, round32Results);
}

function getRound16RegionCoverageGaps(participants = []) {
  return participants.filter(team => {
    const region = round16TeamRegions[cleanCountryName(team)];
    return !round16RegionOptions.includes(region);
  });
}

function calculateRound16RegionOrder(results = {}, round32Results = {}) {
  const goalsByRegion = Object.fromEntries(round16RegionOptions.map(region => [region, 0]));

  getRound16OfficialScores(results).forEach(({ match, result, parsed }) => {
    const participants = getRound16ResultParticipants(match, result, round32Results);
    if (participants.length !== 2) return;

    const winner = participants.find(team => sameCountryOption(team, result.winner));
    const other = participants.find(team => !sameCountryOption(team, result.winner));
    const winnerRegion = round16TeamRegions[cleanCountryName(winner || "")];
    const otherRegion = round16TeamRegions[cleanCountryName(other || "")];

    if (round16RegionOptions.includes(winnerRegion)) {
      goalsByRegion[winnerRegion] += parsed.winnerGoals;
    }

    if (round16RegionOptions.includes(otherRegion)) {
      goalsByRegion[otherRegion] += parsed.otherGoals;
    }
  });

  return [...round16RegionOptions].sort((a, b) => {
    const goalDiff = goalsByRegion[b] - goalsByRegion[a];
    if (goalDiff !== 0) return goalDiff;
    return round16RegionOptions.indexOf(a) - round16RegionOptions.indexOf(b);
  });
}

function scoreExactOrWithinOne(answer, result) {
  if (answer === "" || answer == null || result === "" || result == null) return 0;

  const guess = Number(answer);
  const actual = Number(result);
  if (Number.isNaN(guess) || Number.isNaN(actual)) return 0;

  if (guess === actual) return 3;
  if (Math.abs(guess - actual) <= 1) return 2;
  return 0;
}

function scoreRound16BonusAnswers(answers, round16Results, round32Results) {
  if (!answers || !round16Results) return 0;

  let points = 0;

  const mostGoalsMatchIds = calculateRound16MostGoalsMatchIds(round16Results);
  if (answers.mostGoalsMatch && mostGoalsMatchIds.includes(answers.mostGoalsMatch)) {
    points += 2;
  }

  points += scoreExactOrWithinOne(
    answers.cleanSheets,
    calculateRound16CleanSheets(round16Results)
  );

  const actualRegionOrder = calculateRound16RegionOrder(round16Results, round32Results);
  const answerRegionOrder = Array.isArray(answers.regionOrder) ? answers.regionOrder : [];
  answerRegionOrder.forEach((region, index) => {
    if (region && region === actualRegionOrder[index]) {
      points += 1;
    }
  });

  return points;
}

function scoreExactOrWithinTwo(answer, result) {
  if (answer === "" || answer == null || result === "" || result == null) return 0;

  const guess = Number(answer);
  const actual = Number(result);
  if (Number.isNaN(guess) || Number.isNaN(actual)) return 0;

  if (guess === actual) return 4;
  if (Math.abs(guess - actual) <= 2) return 2;
  return 0;
}

function setScoringIndicator(id, state, label, points) {
  const el = document.getElementById(id);
  if (!el) return;

  const pointLabel = points > 0 ? `+${points}` : String(points);
  el.className = `answer-result answer-result-${state}`;
  el.textContent = `${label} (${pointLabel} pts)`;
}

function clearScoringIndicator(id) {
  const el = document.getElementById(id);
  if (!el) return;

  el.className = "answer-result";
  el.textContent = "";
}

function pointsState(points) {
  if (points > 0) return "correct";
  if (points < 0) return "wrong";
  return "wrong";
}

function partialOrCorrectState(points, maxPoints) {
  if (points >= maxPoints) return "correct";
  if (points > 0) return "partial";
  return "wrong";
}

async function renderAdminPlayerList() {
  if (!adminPlayerList) return;

  await loadGroupLockTimes();

  const usersSnap = await getDocs(collection(db, "users"));
  const groupPicksSnap = await getDocs(collection(db, "groupPicks"));
  const bonusAnswersSnap = await getDocs(collection(db, "bonusAnswers"));
  const round32PicksSnap = await getDocs(collection(db, "round32Picks"));
  const round32BonusAnswersSnap = await getDocs(collection(db, "round32BonusAnswers"));
  const round16PicksSnap = await getDocs(collection(db, "round16Picks"));
  const round16BonusAnswersSnap = await getDocs(collection(db, "round16BonusAnswers"));

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

  const round32PickStatusByUserId = {};
  round32PicksSnap.forEach(docSnap => {
    const data = docSnap.data();
    const picks = data.picks || {};
    const savedCount = round32Matches.filter(match => picks[match.id]?.winner).length;
    const uid = data.uid || docSnap.id;

    round32PickStatusByUserId[uid] = {
      savedCount,
      complete: savedCount === round32Matches.length
    };
  });

  const round32BonusStatusByUserId = {};
  round32BonusAnswersSnap.forEach(docSnap => {
    const data = docSnap.data();
    const answers = data.answers || {};
    const threeGoalWinners = Array.isArray(answers.threeGoalWinners)
      ? answers.threeGoalWinners.filter(Boolean)
      : [answers.threeGoalWinner].filter(Boolean);
    const uniqueThreeGoalWinners = [...new Set(threeGoalWinners)];
    const complete =
      answers.extraTimeOrPenaltiesCount !== "" &&
      answers.extraTimeOrPenaltiesCount != null &&
      answers.redCards !== "" &&
      answers.redCards != null &&
      uniqueThreeGoalWinners.length >= 2;

    round32BonusStatusByUserId[data.uid || docSnap.id] = {
      answerCount:
        Number(answers.extraTimeOrPenaltiesCount !== "" && answers.extraTimeOrPenaltiesCount != null) +
        Number(answers.redCards !== "" && answers.redCards != null) +
        Math.min(uniqueThreeGoalWinners.length, 2),
      complete
    };
  });

  const round16PickStatusByUserId = {};
  round16PicksSnap.forEach(docSnap => {
    const data = docSnap.data();
    const picks = data.picks || {};
    const savedCount = round16Matches.filter(match =>
      picks[match.id]?.winner && picks[match.id]?.score
    ).length;
    const uid = data.uid || docSnap.id;

    round16PickStatusByUserId[uid] = {
      savedCount,
      complete: savedCount === round16Matches.length
    };
  });

  const round16BonusStatusByUserId = {};
  round16BonusAnswersSnap.forEach(docSnap => {
    const data = docSnap.data();
    const answers = data.answers || {};
    const regionOrder = Array.isArray(answers.regionOrder)
      ? answers.regionOrder.filter(Boolean)
      : [];
    const uniqueRegionOrder = [...new Set(regionOrder)];
    const complete =
      !!answers.mostGoalsMatch &&
      answers.cleanSheets !== "" &&
      answers.cleanSheets != null &&
      uniqueRegionOrder.length === round16RegionOptions.length;

    round16BonusStatusByUserId[data.uid || docSnap.id] = {
      answerCount:
        Number(!!answers.mostGoalsMatch) +
        Number(answers.cleanSheets !== "" && answers.cleanSheets != null) +
        Math.min(uniqueRegionOrder.length, round16RegionOptions.length),
      complete
    };
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

  if (adminRound32PlayerList) {
    adminRound32PlayerList.innerHTML = `
      <table class="admin-player-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Username</th>
            <th>Round of 32 Picks</th>
            <th>Round of 32 Bonus</th>
          </tr>
        </thead>
        <tbody>
          ${users.map((u, index) => {
            const uid = u.uid;
            const picks = round32PickStatusByUserId[uid] || { savedCount: 0, complete: false };
            const bonus = round32BonusStatusByUserId[uid] || { answerCount: 0, complete: false };

            return `
              <tr>
                <td>${index + 1}</td>
                <td>${escapeHTML(u.username || u.googleDisplayName || "Player")}</td>
                <td>
                  <span class="${picks.complete ? "status-good" : "status-bad"}">
                    ${picks.complete ? "✅ Complete" : `❌ ${picks.savedCount}/${round32Matches.length}`}
                  </span>
                </td>
                <td>
                  <span class="${bonus.complete ? "status-good" : "status-bad"}">
                    ${bonus.complete ? "✅ Complete" : `❌ ${bonus.answerCount}/4`}
                  </span>
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    `;
  }

  if (adminRound16PlayerList) {
    adminRound16PlayerList.innerHTML = `
      <table class="admin-player-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Username</th>
            <th>Round of 16 Picks</th>
            <th>Round of 16 Bonus</th>
          </tr>
        </thead>
        <tbody>
          ${users.map((u, index) => {
            const uid = u.uid;
            const picks = round16PickStatusByUserId[uid] || { savedCount: 0, complete: false };
            const bonus = round16BonusStatusByUserId[uid] || { answerCount: 0, complete: false };

            return `
              <tr>
                <td>${index + 1}</td>
                <td>${escapeHTML(u.username || u.googleDisplayName || "Player")}</td>
                <td>
                  <span class="${picks.complete ? "status-good" : "status-bad"}">
                    ${picks.complete ? "✅ Complete" : `❌ ${picks.savedCount}/${round16Matches.length}`}
                  </span>
                </td>
                <td>
                  <span class="${bonus.complete ? "status-good" : "status-bad"}">
                    ${bonus.complete ? "✅ Complete" : `❌ ${bonus.answerCount}/6`}
                  </span>
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    `;
  }

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
  if (refreshLeaderboardStatus) {
    refreshLeaderboardStatus.className = "refresh-leaderboard-status status-message status-info";
    refreshLeaderboardStatus.textContent = "Refreshing leaderboard...";
  }

  refreshLeaderboardBtn.disabled = true;

  try {
    await renderAdminPlayerList();
    await renderLeaderboardFromFirestore();

    if (refreshLeaderboardStatus) {
      refreshLeaderboardStatus.className = "refresh-leaderboard-status status-message status-success";
      refreshLeaderboardStatus.textContent = "✅ Leaderboard refreshed!";
    }
  } catch (error) {
    console.error("Failed to refresh leaderboard:", error);
    if (refreshLeaderboardStatus) {
      refreshLeaderboardStatus.className = "refresh-leaderboard-status status-message status-error";
      refreshLeaderboardStatus.textContent = "Leaderboard refresh failed.";
    }
  } finally {
    refreshLeaderboardBtn.disabled = false;
  }
});

async function renderPublicLeaderboard() {
  const snap = await getDoc(doc(db, "publicLeaderboard", "current"));

  if (!snap.exists()) {
    renderLeaderboard([]);
    return;
  }

  let rows = snap.data().rows || [];
  rows = await attachPublicRootingForCountries(rows);
  if (currentUser) rows = await attachRootingForCountries(rows);
  renderLeaderboard(rows);
}

async function attachPublicRootingForCountries(rows) {
  try {
    const rootingSnap = await getDocs(collection(db, "publicRootingFor"));
    const rootingByUid = {};

    rootingSnap.forEach(docSnap => {
      const data = docSnap.data();
      if (data.uid && Array.isArray(data.rootingForCountries)) {
        rootingByUid[data.uid] = data.rootingForCountries;
      }
    });

    return rows.map(row => ({
      ...row,
      rootingForCountries: rootingByUid[row.uid] || row.rootingForCountries || []
    }));
  } catch (error) {
    console.warn("Could not load public rooting-for flags:", error);
    return rows;
  }
}

async function attachRootingForCountries(rows) {
  const usersSnap = await getDocs(collection(db, "users"));
  const rootingByUid = {};

  usersSnap.forEach(docSnap => {
    const user = docSnap.data();
    if (user.uid && Array.isArray(user.rootingForCountries)) {
      rootingByUid[user.uid] = user.rootingForCountries;
    }
  });

  return rows.map(row => ({
    ...row,
    rootingForCountries: rootingByUid[row.uid] || row.rootingForCountries || []
  }));
}

function leaderboardDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function compareLeaderboardRows(a, b) {
  const pointDiff = (b.total_points || 0) - (a.total_points || 0);
  if (pointDiff !== 0) return pointDiff;

  return (a.display_name || "Player").localeCompare(b.display_name || "Player");
}

function buildLeaderboardBaseline(rows, dateKey) {
  const sorted = [...rows].sort(compareLeaderboardRows);
  const players = {};

  sorted.forEach((row, index) => {
    players[row.uid] = {
      rank: index + 1,
      match_points: (row.group_points || 0) + (row.match_points || 0),
      bonus_points: row.bonus_points || 0,
      total_points: row.total_points || 0
    };
  });

  return {
    dateKey,
    capturedAt: new Date().toISOString(),
    players
  };
}

async function applyDailyLeaderboardMovement(rows) {
  const dateKey = leaderboardDateKey();
  const baselineRef = doc(db, "leaderboardDailyBaselines", dateKey);

  try {
    const baselineSnap = await getDoc(baselineRef);

    let baseline;
    if (baselineSnap.exists()) {
      baseline = baselineSnap.data();
    } else {
      const previousLeaderboardSnap = await getDoc(doc(db, "publicLeaderboard", "current"));
      const previousRows = previousLeaderboardSnap.exists()
        ? previousLeaderboardSnap.data().rows || []
        : [];
      baseline = buildLeaderboardBaseline(previousRows.length ? previousRows : rows, dateKey);
      await setDoc(baselineRef, baseline);
    }

    const currentRankByUid = {};
    [...rows].sort(compareLeaderboardRows).forEach((row, index) => {
      currentRankByUid[row.uid] = index + 1;
    });

    return rows.map(row => {
      const currentMatchPoints = (row.group_points || 0) + (row.match_points || 0);
      const currentBonusPoints = row.bonus_points || 0;
      const baselinePlayer = baseline.players?.[row.uid];

      if (!baselinePlayer) {
        return {
          ...row,
          rank_movement: 0,
          match_points_delta: 0,
          bonus_points_delta: 0
        };
      }

      return {
        ...row,
        rank_movement: baselinePlayer.rank - currentRankByUid[row.uid],
        match_points_delta: currentMatchPoints - (baselinePlayer.match_points || 0),
        bonus_points_delta: currentBonusPoints - (baselinePlayer.bonus_points || 0)
      };
    });
  } catch (error) {
    console.warn("Could not apply daily leaderboard movement:", error);
    return rows.map(row => ({
      ...row,
      rank_movement: 0,
      match_points_delta: 0,
      bonus_points_delta: 0
    }));
  }
}

async function renderLeaderboardFromFirestore() {
  const usersSnap = await getDocs(collection(db, "users"));
  const groupPicksSnap = await getDocs(collection(db, "groupPicks"));
  const round32PicksSnap = await getDocs(collection(db, "round32Picks"));
  const round32BonusAnswersSnap = await getDocs(collection(db, "round32BonusAnswers"));
  const round16PicksSnap = await getDocs(collection(db, "round16Picks"));
  const round16BonusAnswersSnap = await getDocs(collection(db, "round16BonusAnswers"));
  const bonusAnswersSnap = await getDocs(collection(db, "bonusAnswers"));

  const groupResultsSnap = await getDoc(doc(db, "groupResults", "official"));
  const round32ResultsSnap = await getDoc(doc(db, "round32Results", "official"));
  const round32BonusResultsSnap = await getDoc(doc(db, "round32BonusResults", "official"));
  const round16ResultsSnap = await getDoc(doc(db, "round16Results", "official"));
  const bonusResultsSnap = await getDoc(doc(db, "bonusResults", "official"));

  const groupResults = groupResultsSnap.exists() ? groupResultsSnap.data().results || {} : {};
  const round32Results = round32ResultsSnap.exists() ? round32ResultsSnap.data().results || {} : {};
  const publicRound32RevealableMatchIds = round32Matches
    .filter(match => round32PickIsRevealable(match, round32Results))
    .map(match => match.id);
  const round32BonusResults =
    round32BonusResultsSnap.exists() ? round32BonusResultsSnap.data().results || {} : {};
  const round16Results = round16ResultsSnap.exists() ? round16ResultsSnap.data().results || {} : {};
  const publicRound16RevealableMatchIds = round16Matches
    .filter(match => round16PickIsRevealable(match, round16Results))
    .map(match => match.id);
  const bonusResults = bonusResultsSnap.exists() ? bonusResultsSnap.data().results || {} : {};

  const users = {};
  usersSnap.forEach(docSnap => {
    const u = docSnap.data();
    users[u.uid] = {
      username: u.username || "",
      googleDisplayName: u.googleDisplayName || "",
      email: u.email || "",
      rootingForCountries: Array.isArray(u.rootingForCountries) ? u.rootingForCountries : [],
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
        rootingForCountries: user.rootingForCountries,
        publicRound32Picks: {},
        publicRound32RevealableMatchIds,
        publicRound16Picks: {},
        publicRound16RevealableMatchIds,
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

        if (
          sameCountryOption(team, result.first) ||
          sameCountryOption(team, result.second)
        ) {
          player.group_points += 2;
        } else if (sameCountryOption(team, result.third) && result.thirdQualified) {
          player.group_points += 1;
        }
      });
    });
  });

  round32PicksSnap.forEach(docSnap => {
    const data = docSnap.data();
    const player = ensurePlayer(data.uid, data.email);
    if (!player) return;

    Object.entries(data.picks || {}).forEach(([matchId, pick]) => {
      if (!pick?.winner) return;

      player.publicRound32Picks[matchId] = {
        winner: pick.winner,
        extraTimeOrPenalties: !!pick.extraTimeOrPenalties
      };
    });

    player.match_points += scoreRound32Picks(data.picks, round32Results);
  });

  round16PicksSnap.forEach(docSnap => {
    const data = docSnap.data();
    const player = ensurePlayer(data.uid, data.email);
    if (!player) return;

    Object.entries(data.picks || {}).forEach(([matchId, pick]) => {
      if (!pick?.winner) return;

      player.publicRound16Picks[matchId] = {
        winner: pick.winner,
        score: normalizeWinnerFirstScore(pick.score),
        extraTimeOrPenalties: !!pick.extraTimeOrPenalties
      };
    });

    player.match_points += scoreRound16Picks(data.picks, round16Results);
  });

  round32BonusAnswersSnap.forEach(docSnap => {
    const data = docSnap.data();
    const player = ensurePlayer(data.uid, data.email);
    if (!player) return;

    player.bonus_points += scoreRound32BonusAnswers(data.answers, round32BonusResults);
  });

  round16BonusAnswersSnap.forEach(docSnap => {
    const data = docSnap.data();
    const player = ensurePlayer(data.uid, data.email);
    if (!player) return;

    player.bonus_points += scoreRound16BonusAnswers(data.answers, round16Results, round32Results);
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

  let rows = Object.values(scores);
  if (currentUser && ADMIN_EMAILS.includes(currentUser.email)) {
    rows = await applyDailyLeaderboardMovement(rows);
  }

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

  const sorted = rows.sort(compareLeaderboardRows);
  latestLeaderboardRows = sorted;
  const showPointDeltas = currentUser && ADMIN_EMAILS.includes(currentUser.email);

  sorted.forEach((r, i) => {
    const tr = document.createElement("tr");
    const matchPoints = r.group_points + r.match_points;
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td class="leaderboard-country-cell">${renderRootingForFlags(r.rootingForCountries)}</td>
      <td>
        ${
          r.uid
            ? `<button class="player-pick-link" data-uid="${escapeHTML(r.uid)}" data-name="${escapeHTML(r.display_name)}">${renderLeaderboardDisplayName(r.display_name)}</button>`
            : renderLeaderboardDisplayName(r.display_name)
        }
      </td>
      <td>${matchPoints}${showPointDeltas ? renderPointDelta(r.match_points_delta) : ""}</td>
      <td>${r.bonus_points}${showPointDeltas ? renderPointDelta(r.bonus_points_delta) : ""}</td>
      <td><strong>${r.total_points}</strong></td>
      <td class="daily-change-table-cell">${renderDailyChange(r)}</td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll(".player-pick-link").forEach(btn => {
    btn.addEventListener("click", async () => {
      await showPlayerRound32Picks(btn.dataset.uid, btn.dataset.name);
    });
  });

  const playerCount = document.querySelector("#playerCount");
  const lastUpdated = document.querySelector("#lastUpdated");
  const matchCount = document.querySelector("#matchCount");

  if (playerCount) playerCount.textContent = sorted.length;
  if (lastUpdated) lastUpdated.textContent = new Date().toLocaleString();
  if (matchCount) matchCount.textContent = "Live";
}

function renderLeaderboardDisplayName(displayName = "Player") {
  const safeName = escapeHTML(displayName || "Player");
  return cleanCountryName(displayName || "") === "FIFATom" ? `🤖 ${safeName}` : safeName;
}

function renderRankMovement(movement = 0) {
  const amount = Number(movement || 0);

  if (amount > 0) {
    return `<span class="leaderboard-delta leaderboard-delta-up">↑ +${amount}</span>`;
  }

  if (amount < 0) {
    return `<span class="leaderboard-delta leaderboard-delta-down">↓ ${amount}</span>`;
  }

  return `<span class="leaderboard-delta leaderboard-delta-flat">0</span>`;
}

function renderDailyChange(row = {}) {
  const dailyPoints =
    Number(row.match_points_delta || 0) +
    Number(row.bonus_points_delta || 0);

  return `
    <div class="daily-change-cell">
      <span class="daily-change-points ${dailyPoints > 0 ? "daily-change-positive" : dailyPoints < 0 ? "daily-change-negative" : "daily-change-flat"}">
        ${dailyPoints > 0 ? "+" : ""}${dailyPoints} pts
      </span>
      ${renderRankMovement(row.rank_movement)}
    </div>
  `;
}

function renderPointDelta(delta = 0) {
  const amount = Number(delta || 0);

  if (amount > 0) {
    return `<span class="point-delta point-delta-up">+${amount} today</span>`;
  }

  if (amount < 0) {
    return `<span class="point-delta point-delta-down">${amount} today</span>`;
  }

  return `<span class="point-delta point-delta-flat">+0 today</span>`;
}

function renderRootingForFlags(rootingForCountries = []) {
  if (!Array.isArray(rootingForCountries) || !rootingForCountries.length) {
    return `<span class="rooting-flags-empty">—</span>`;
  }

  const flags = rootingForCountries
    .slice(0, 2)
    .map(countryFlagFromOption)
    .filter(Boolean);

  return flags.length
    ? `<span class="rooting-flags">${flags.map(flag => escapeHTML(flag)).join(" ")}</span>`
    : `<span class="rooting-flags-empty">—</span>`;
}

async function showPlayerRound32Picks(uid, displayName) {
  const publicRow = latestLeaderboardRows.find(row => row.uid === uid);

  if (!currentUser) {
    showPublicRound32PicksFromLeaderboard(publicRow, displayName);
    return;
  }

  const [picksSnap, resultsSnap, round16PicksSnap, round16ResultsSnap] = await Promise.all([
    getDoc(doc(db, "round32Picks", uid)),
    getDoc(doc(db, "round32Results", "official")),
    getDoc(doc(db, "round16Picks", uid)),
    getDoc(doc(db, "round16Results", "official"))
  ]);

  if (!picksSnap.exists() && !round16PicksSnap.exists()) {
    playerPicksTitle.textContent = `${displayName}'s Knockout Picks`;
    playerPicksContent.innerHTML = `<p class="mini-note">No knockout picks found for this player.</p>`;
    playerPicksViewer.style.display = "block";
    playerPicksViewer.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  const picks = picksSnap.exists() ? picksSnap.data().picks || {} : {};
  const results = resultsSnap.exists() ? resultsSnap.data().results || {} : {};
  const round16Picks = round16PicksSnap.exists() ? round16PicksSnap.data().picks || {} : {};
  const round16Results = round16ResultsSnap.exists() ? round16ResultsSnap.data().results || {} : {};

  playerPicksTitle.textContent = `${displayName}'s Knockout Picks`;
  playerPicksContent.innerHTML = `
    <h3>Round of 32</h3>
    <div class="public-picks-grid">
      ${round32Matches.map(match =>
        renderPublicRound32PickCard(match, picks[match.id], round32PickIsRevealable(match, results))
      ).join("")}
    </div>

    <h3>Round of 16</h3>
    <div class="public-picks-grid">
      ${round16Matches.map(match =>
        renderPublicRound16PickCard(match, round16Picks[match.id], round16PickIsRevealable(match, round16Results), results)
      ).join("")}
    </div>
  `;

  playerPicksViewer.style.display = "block";
  playerPicksViewer.scrollIntoView({ behavior: "smooth", block: "start" });
}

function showPublicRound32PicksFromLeaderboard(row, displayName) {
  playerPicksTitle.textContent = `${displayName}'s Knockout Picks`;

  if (!row) {
    playerPicksContent.innerHTML = `<p class="mini-note">Could not find this player on the public leaderboard.</p>`;
  } else {
    const picks = row.publicRound32Picks || {};
    const revealableMatchIds = Array.isArray(row.publicRound32RevealableMatchIds)
      ? row.publicRound32RevealableMatchIds
      : Array.isArray(row.publicRound32FinishedMatchIds)
        ? row.publicRound32FinishedMatchIds
      : [];
    const round16Picks = row.publicRound16Picks || {};
    const round16RevealableMatchIds = Array.isArray(row.publicRound16RevealableMatchIds)
      ? row.publicRound16RevealableMatchIds
      : [];

    playerPicksContent.innerHTML = `
      <h3>Round of 32</h3>
      <div class="public-picks-grid">
        ${round32Matches.map(match =>
          renderPublicRound32PickCard(match, picks[match.id], revealableMatchIds.includes(match.id))
        ).join("")}
      </div>

      <h3>Round of 16</h3>
      <div class="public-picks-grid">
        ${round16Matches.map(match =>
          renderPublicRound16PickCard(match, round16Picks[match.id], round16RevealableMatchIds.includes(match.id))
        ).join("")}
      </div>
    `;
  }

  playerPicksViewer.style.display = "block";
  playerPicksViewer.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderPublicRound32PickCard(match, pick, isRevealable) {
  const matchupLabel = round32MatchupLabel(match);

  if (!isRevealable) {
    return `
      <div class="public-pick-card public-pick-hidden">
        <h3>${escapeHTML(matchupLabel)}</h3>
        <p class="hidden-pick-marker">Hidden until match has started</p>
      </div>
    `;
  }

  return `
    <div class="public-pick-card">
      <h3>${escapeHTML(matchupLabel)}</h3>
      ${
        pick?.winner
          ? `
            <p><strong>Winner pick:</strong> ${escapeHTML(round32TeamLabel(pick.winner))}</p>
            <p><strong>Extra time / penalties:</strong> ${pick.extraTimeOrPenalties ? "Yes" : "No"}</p>
          `
          : `<p class="mini-note">No saved pick for this match.</p>`
      }
    </div>
  `;
}

function renderPublicRound16PickCard(match, pick, isRevealable, round32Results = {}) {
  const matchupLabel = round16MatchupLabel(match, round32Results);

  if (!isRevealable) {
    return `
      <div class="public-pick-card public-pick-hidden">
        <h3>${escapeHTML(matchupLabel)}</h3>
        <p class="hidden-pick-marker">Hidden until match has started</p>
      </div>
    `;
  }

  return `
    <div class="public-pick-card">
      <h3>${escapeHTML(matchupLabel)}</h3>
      ${
        pick?.winner
          ? `
            <p><strong>Winner pick:</strong> ${escapeHTML(round32TeamLabel(pick.winner))}</p>
            <p><strong>Full-time score:</strong> ${escapeHTML(normalizeWinnerFirstScore(pick.score))}</p>
            <p><strong>Extra time / penalties:</strong> ${pick.extraTimeOrPenalties ? "Yes" : "No"}</p>
          `
          : `<p class="mini-note">No saved pick for this match.</p>`
      }
    </div>
  `;
}

closePlayerPicksBtn?.addEventListener("click", () => {
  playerPicksViewer.style.display = "none";
});

const MATCH_TICKER_URL = "https://worldcup-score-ticker.chat2danny21.workers.dev/matches";
let tickerRefreshTimer = null;

const tickerWinnerOverrides = {
  "Australia|Egypt": {
    winnerName: "Egypt",
    method: "penalties",
    penalties: "4-2"
  }
};

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
  const winnerName = getTickerWinnerName(match);
  const winnerLabel = winnerName ? getTickerWinnerLabel(match, winnerName) : "";
  const homeIsWinner = winnerName && sameTickerTeam(match.home.name, winnerName);
  const awayIsWinner = winnerName && sameTickerTeam(match.away.name, winnerName);

  return `
    <div class="match-card ${escapeHTML(status.type || "")}">
      <div class="match-card-top">
        <span>${statusLabel}</span>
        <span>${escapeHTML(status.detail || "")}</span>
      </div>

      <div class="matchup ${homeIsWinner ? "match-winner" : ""}">
        <div class="team-flag">${escapeHTML(match.home.flag)}</div>
        <div class="team-code">${escapeHTML(match.home.code)}</div>
        <div class="team-name">${escapeHTML(match.home.name)}</div>
        <div class="team-score">${escapeHTML(scoreHome)}</div>
        <div class="team-winner-mark">${homeIsWinner ? "✓" : ""}</div>
      </div>

      <div class="matchup ${awayIsWinner ? "match-winner" : ""}">
        <div class="team-flag">${escapeHTML(match.away.flag)}</div>
        <div class="team-code">${escapeHTML(match.away.code)}</div>
        <div class="team-name">${escapeHTML(match.away.name)}</div>
        <div class="team-score">${escapeHTML(scoreAway)}</div>
        <div class="team-winner-mark">${awayIsWinner ? "✓" : ""}</div>
      </div>

      <div class="match-footer">
        ${winnerLabel ? `${escapeHTML(winnerLabel)} · ` : ""}${isLive ? "Ongoing" : isFinal ? "Final" : "Kickoff"} · ${dateTimeLabel}
      </div>
    </div>
  `;
}

function getTickerWinnerName(match) {
  const directWinner =
    match.winner?.name ||
    match.winnerName ||
    match.winner_name ||
    match.status?.winner?.name ||
    match.status?.winnerName ||
    "";

  if (directWinner) return directWinner;

  const winnerCode =
    match.winner?.code ||
    match.winnerCode ||
    match.winner_code ||
    match.status?.winner?.code ||
    match.status?.winnerCode ||
    "";

  if (winnerCode) {
    if (match.home?.code === winnerCode) return match.home.name;
    if (match.away?.code === winnerCode) return match.away.name;
  }

  const override = getTickerWinnerOverride(match);
  if (override?.winnerName) return override.winnerName;

  const homeScore = Number(match.home?.score);
  const awayScore = Number(match.away?.score);
  if (match.status?.type === "final" && !Number.isNaN(homeScore) && !Number.isNaN(awayScore) && homeScore !== awayScore) {
    return homeScore > awayScore ? match.home.name : match.away.name;
  }

  return "";
}

function getTickerWinnerLabel(match, winnerName) {
  const penalties = getTickerPenaltyScore(match);
  const override = getTickerWinnerOverride(match);
  const detail = String(match.status?.detail || "").toUpperCase();

  if (penalties) {
    return `${winnerName} advance on penalties (${penalties})`;
  }

  if (override?.method === "penalties" || detail.includes("PEN")) {
    return `${winnerName} advance on penalties`;
  }

  if (detail.includes("AET") || detail.includes("ET")) {
    return `${winnerName} advance after extra time`;
  }

  return `${winnerName} win`;
}

function getTickerPenaltyScore(match) {
  const override = getTickerWinnerOverride(match);
  if (override?.penalties) return override.penalties;

  const penaltyData =
    match.penalties ||
    match.penaltyScore ||
    match.penalty_score ||
    match.shootout ||
    match.status?.penalties ||
    null;

  if (!penaltyData) return "";

  if (typeof penaltyData === "string") return penaltyData;

  const homePens =
    penaltyData.home ??
    penaltyData.homeScore ??
    penaltyData.home_score ??
    penaltyData[match.home?.code];
  const awayPens =
    penaltyData.away ??
    penaltyData.awayScore ??
    penaltyData.away_score ??
    penaltyData[match.away?.code];

  if (homePens == null || awayPens == null) return "";
  return `${homePens}-${awayPens}`;
}

function getTickerWinnerOverride(match) {
  return tickerWinnerOverrides[`${match.home?.name}|${match.away?.name}`] ||
    tickerWinnerOverrides[`${match.away?.name}|${match.home?.name}`] ||
    null;
}

function sameTickerTeam(a, b) {
  return cleanCountryName(a || "").toLowerCase() === cleanCountryName(b || "").toLowerCase();
}

loadWorldCupTicker();

function getValue(id) {
  return document.getElementById(id)?.value || "";
}

function setValue(id, value) {
  const el = document.getElementById(id);
  if (!el) return;

  const nextValue = value || "";
  el.value = nextValue;

  if (el.tagName === "SELECT" && nextValue && el.value !== nextValue) {
    const normalizedValue = normalizeCountryOptionValue(nextValue);
    const hasNormalizedOption = Array.from(el.options).some(option => option.value === normalizedValue);
    if (hasNormalizedOption) {
      el.value = normalizedValue;
      return;
    }

    const cleanValue = cleanCountryName(nextValue);
    const matchingOption = Array.from(el.options).find(option =>
      cleanCountryName(option.value) === cleanValue ||
      cleanCountryName(option.textContent || "") === cleanValue
    );

    if (matchingOption) el.value = matchingOption.value;
  }
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
