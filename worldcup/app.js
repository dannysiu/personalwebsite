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
- Round of 16 correct final score = 2 points only when winner is correct
- Round of 16 bonus questions are scored from official Round of 16 results
- Quarterfinals correct winner = 3 points
- Quarterfinals correct final score = 2 points only when winner is correct
- Quarterfinals bonus questions are scored from the admin answer key
- Semifinals correct winner = 3 points
- Semifinals correct final score = 2 points only when winner is correct
- Semifinal bonus questions are scored from the admin answer key
- Opening bonus quiz = 1 point per correct answer
- Yellow card bonus question is correct if within 10 of the official total
*/

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
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
let latestTickerMatches = [];

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

function openingMostGoalsCountryValues(results = {}) {
  const values = Array.isArray(results.mostGoalsCountries)
    ? results.mostGoalsCountries
    : [results.mostGoalsCountry];

  return [...new Set(values.filter(Boolean).map(canonicalCountryOptionValue))];
}

function openingMostGoalsCountryIsCorrect(answer, results = {}) {
  return Boolean(answer) &&
    openingMostGoalsCountryValues(results).some(country => sameCountryOption(answer, country));
}

function normalizeCountryOptionValue(country) {
  return cleanCountryName(country) === "England" ? LEGACY_ENGLAND_OPTION : country;
}

function canonicalCountryOptionValue(country) {
  if (!country) return "";
  const cleanValue = cleanCountryName(country);
  return countryOptions.find(option => cleanCountryName(option) === cleanValue) ||
    normalizeCountryOptionValue(country);
}

function countryFlagFromOption(country) {
  if (cleanCountryName(country) === "England") return ENGLAND_FLAG;
  return country.replace(cleanCountryName(country), "").trim();
}

function currentUserIsAdmin() {
  return !!currentUser && ADMIN_EMAILS.includes(currentUser.email);
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
  "73": "Canada",
  "76": "Brazil",
  "74": "Paraguay",
  "75": "Morocco",
  "78": "Norway",
  "77": "France",
  "79": "Mexico",
  "80": "England",
  "82": "Belgium",
  "81": "United States",
  "84": "Spain",
  "83": "Portugal",
  "85": "Switzerland",
  "88": "Egypt",
  "86": "Argentina",
  "87": "Colombia"
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
  { id: "93", label: "Match 93", sourceMatchIds: ["83", "84"], startTime: "2026-07-06T19:00:00.000Z", venue: "Dallas" },
  { id: "94", label: "Match 94", sourceMatchIds: ["81", "82"], startTime: "2026-07-07T00:00:00.000Z", venue: "Seattle" },
  { id: "95", label: "Match 95", sourceMatchIds: ["86", "88"], startTime: "2026-07-07T16:00:00.000Z", venue: "Atlanta" },
  { id: "96", label: "Match 96", sourceMatchIds: ["85", "87"], startTime: "2026-07-07T20:00:00.000Z", venue: "Vancouver" }
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

const quarterfinalMatches = [
  { id: "97", label: "Match 97", sourceMatchIds: ["89", "90"], startTime: "2026-07-09T16:00:00-04:00", venue: "Boston" },
  { id: "98", label: "Match 98", sourceMatchIds: ["93", "94"], startTime: "2026-07-10T12:00:00-07:00", venue: "Los Angeles" },
  { id: "99", label: "Match 99", sourceMatchIds: ["91", "92"], startTime: "2026-07-11T17:00:00-04:00", venue: "Miami" },
  { id: "100", label: "Match 100", sourceMatchIds: ["95", "96"], startTime: "2026-07-11T20:00:00-05:00", venue: "Kansas City" }
];

const QUARTERFINAL_BONUS_POINTS = 2;

const semifinalMatches = [
  { id: "101", label: "Match 101", matchupId: "france-spain", home: "France", away: "Spain", startTime: "2026-07-14T14:00:00-05:00", venue: "Dallas", tickerVenue: "AT&T Stadium", tickerLocation: "Arlington, Texas" },
  { id: "102", label: "Match 102", matchupId: "england-argentina", home: "England", away: "Argentina", startTime: "2026-07-15T15:00:00-04:00", venue: "Atlanta", tickerVenue: "Mercedes-Benz Stadium", tickerLocation: "Atlanta, Georgia" }
];

const completedSemifinalTickerResults = {
  "101": { homeScore: 0, awayScore: 2, winner: "Spain" },
  "102": { homeScore: 1, awayScore: 2, winner: "Argentina" }
};

const finalMatch = {
  id: "104",
  label: "Final",
  home: "Spain",
  away: "Argentina",
  startTime: "2026-07-19T15:00:00-04:00",
  venue: "MetLife Stadium",
  tickerVenue: "MetLife Stadium",
  tickerLocation: "East Rutherford, New Jersey"
};

const thirdPlaceMatch = {
  id: "103",
  label: "Match for Third Place",
  home: "England",
  away: "France",
  startTime: "2026-07-18T17:00:00-04:00",
  venue: "Hard Rock Stadium",
  tickerVenue: "Hard Rock Stadium",
  tickerLocation: "Miami Gardens, Florida"
};

const finalsMatches = [thirdPlaceMatch, finalMatch];

const SEMIFINAL_BONUS_POINTS = 2;
const FINALS_BONUS_POINTS = 2;
const SEMIFINAL_TEAM_OPTIONS = ["France", "Spain", "England", "Argentina"];
const FINAL_TEAM_OPTIONS = ["Spain", "Argentina"];
const TICKER_COUNTRY_CODES = {
  Argentina: "ARG",
  England: "ENG",
  France: "FRA",
  Spain: "ESP"
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
const round32BonusAnswerKey = document.getElementById("round32BonusAnswerKey");
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
const round16BonusAnswerKey = document.getElementById("round16BonusAnswerKey");
const quarterfinalPicksSection = document.getElementById("quarterfinalPicksSection");
const quarterfinalPicksContent = document.getElementById("quarterfinalPicksContent");
const toggleQuarterfinalPicksBtn = document.getElementById("toggleQuarterfinalPicksBtn");
const quarterfinalPicksForm = document.getElementById("quarterfinalPicksForm");
const saveQuarterfinalPicksBtn = document.getElementById("saveQuarterfinalPicksBtn");
const quarterfinalPicksStatus = document.getElementById("quarterfinalPicksStatus");
const quarterfinalBonusSection = document.getElementById("quarterfinalBonusSection");
const quarterfinalBonusContent = document.getElementById("quarterfinalBonusContent");
const toggleQuarterfinalBonusBtn = document.getElementById("toggleQuarterfinalBonusBtn");
const quarterfinalBonusForm = document.getElementById("quarterfinalBonusForm");
const saveQuarterfinalBonusBtn = document.getElementById("saveQuarterfinalBonusBtn");
const quarterfinalBonusStatus = document.getElementById("quarterfinalBonusStatus");
const quarterfinalBonusAnswerKey = document.getElementById("quarterfinalBonusAnswerKey");
const finalsPicksSection = document.getElementById("finalsPicksSection");
const finalsPicksContent = document.getElementById("finalsPicksContent");
const toggleFinalsPicksBtn = document.getElementById("toggleFinalsPicksBtn");
const finalsPicksForm = document.getElementById("finalsPicksForm");
const saveFinalsPicksBtn = document.getElementById("saveFinalsPicksBtn");
const finalsPicksStatus = document.getElementById("finalsPicksStatus");
const finalsBonusSection = document.getElementById("finalsBonusSection");
const finalsBonusContent = document.getElementById("finalsBonusContent");
const toggleFinalsBonusBtn = document.getElementById("toggleFinalsBonusBtn");
const finalsBonusForm = document.getElementById("finalsBonusForm");
const saveFinalsBonusBtn = document.getElementById("saveFinalsBonusBtn");
const finalsBonusStatus = document.getElementById("finalsBonusStatus");
const semifinalPicksSection = document.getElementById("semifinalPicksSection");
const semifinalPicksContent = document.getElementById("semifinalPicksContent");
const toggleSemifinalPicksBtn = document.getElementById("toggleSemifinalPicksBtn");
const semifinalPicksForm = document.getElementById("semifinalPicksForm");
const saveSemifinalPicksBtn = document.getElementById("saveSemifinalPicksBtn");
const semifinalPicksStatus = document.getElementById("semifinalPicksStatus");
const semifinalBonusSection = document.getElementById("semifinalBonusSection");
const semifinalBonusContent = document.getElementById("semifinalBonusContent");
const toggleSemifinalBonusBtn = document.getElementById("toggleSemifinalBonusBtn");
const semifinalBonusForm = document.getElementById("semifinalBonusForm");
const saveSemifinalBonusBtn = document.getElementById("saveSemifinalBonusBtn");
const semifinalBonusStatus = document.getElementById("semifinalBonusStatus");
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
const adminRound16BonusQuestions = document.getElementById("adminRound16BonusQuestions");
const adminRound16BonusKey = document.getElementById("adminRound16BonusKey");
const saveRound16ResultsBtn = document.getElementById("saveRound16ResultsBtn");
const round16ResultsStatus = document.getElementById("round16ResultsStatus");
const adminQuarterfinalResultsForm = document.getElementById("adminQuarterfinalResultsForm");
const adminQuarterfinalBonusQuestions = document.getElementById("adminQuarterfinalBonusQuestions");
const adminQuarterfinalBonusKey = document.getElementById("adminQuarterfinalBonusKey");
const adminQuarterfinalBonusResultsForm = document.getElementById("adminQuarterfinalBonusResultsForm");
const saveQuarterfinalBonusResultsBtn = document.getElementById("saveQuarterfinalBonusResultsBtn");
const quarterfinalBonusResultsStatus = document.getElementById("quarterfinalBonusResultsStatus");
const saveQuarterfinalResultsBtn = document.getElementById("saveQuarterfinalResultsBtn");
const quarterfinalResultsStatus = document.getElementById("quarterfinalResultsStatus");
const adminSemifinalResultsForm = document.getElementById("adminSemifinalResultsForm");
const saveSemifinalResultsBtn = document.getElementById("saveSemifinalResultsBtn");
const semifinalResultsStatus = document.getElementById("semifinalResultsStatus");
const adminSemifinalBonusResultsForm = document.getElementById("adminSemifinalBonusResultsForm");
const saveSemifinalBonusResultsBtn = document.getElementById("saveSemifinalBonusResultsBtn");
const semifinalBonusResultsStatus = document.getElementById("semifinalBonusResultsStatus");
const adminFinalsResultsForm = document.getElementById("adminFinalsResultsForm");
const saveFinalsResultsBtn = document.getElementById("saveFinalsResultsBtn");
const finalsResultsStatus = document.getElementById("finalsResultsStatus");
const adminFinalsBonusResultsForm = document.getElementById("adminFinalsBonusResultsForm");
const saveFinalsBonusResultsBtn = document.getElementById("saveFinalsBonusResultsBtn");
const finalsBonusResultsStatus = document.getElementById("finalsBonusResultsStatus");
const adminFinalsSurveySummary = document.getElementById("adminFinalsSurveySummary");
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
let adminQuarterfinalPlayerList;
let adminSemifinalPlayerList;
let adminFinalsPlayerList;
let adminBonusResultsForm;
let saveBonusResultsBtn;
let bonusResultsStatus;

injectBonusSection();
injectAdminPlayerManagement();
injectAdminBonusResults();
moveRefreshLeaderboardButton();
showUsaCelebrationWhenActive();

setupCollapsibleSection(toggleRound16PicksBtn, round16PicksContent, false);
setupCollapsibleSection(toggleRound16BonusBtn, round16BonusContent, false);
setupCollapsibleSection(toggleFinalsPicksBtn, finalsPicksContent, true);
setupCollapsibleSection(toggleFinalsBonusBtn, finalsBonusContent, true);
setupCollapsibleSection(toggleSemifinalPicksBtn, semifinalPicksContent, false);
setupCollapsibleSection(toggleSemifinalBonusBtn, semifinalBonusContent, false);
setupCollapsibleSection(toggleQuarterfinalPicksBtn, quarterfinalPicksContent, false);
setupCollapsibleSection(toggleQuarterfinalBonusBtn, quarterfinalBonusContent, false);
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

  setCollapsibleSectionState(button, content, startsExpanded);

  button.addEventListener("click", () => {
    const isHidden = content.style.display === "none";
    setCollapsibleSectionState(button, content, isHidden);
  });
}

function setCollapsibleSectionState(button, content, expanded) {
  if (!button || !content) return;

  content.style.display = expanded ? "block" : "none";
  button.textContent = expanded ? "Minimize" : "Expand";
}

function setupAdminPanelToggles(root = adminSection, startsExpanded = false) {
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
    setupCollapsibleSection(button, content, startsExpanded);
  });
}

function minimizeAdminDefaultSections() {
  setCollapsibleSectionState(toggleProfileSettingsBtn, profileSettingsContent, false);
  setCollapsibleSectionState(toggleFinalsPicksBtn, finalsPicksContent, false);
  setCollapsibleSectionState(toggleFinalsBonusBtn, finalsBonusContent, false);
  setCollapsibleSectionState(toggleSemifinalPicksBtn, semifinalPicksContent, false);
  setCollapsibleSectionState(toggleSemifinalBonusBtn, semifinalBonusContent, false);
  setCollapsibleSectionState(toggleQuarterfinalPicksBtn, quarterfinalPicksContent, false);
  setCollapsibleSectionState(toggleQuarterfinalBonusBtn, quarterfinalBonusContent, false);
  setCollapsibleSectionState(toggleRound16PicksBtn, round16PicksContent, false);
  setCollapsibleSectionState(toggleRound16BonusBtn, round16BonusContent, false);
  setCollapsibleSectionState(toggleRound32PicksBtn, round32PicksContent, false);
  setCollapsibleSectionState(toggleRound32BonusBtn, round32BonusContent, false);
  setCollapsibleSectionState(toggleGroupPicksBtn, groupPicksContent, false);
  setCollapsibleSectionState(document.getElementById("toggleBonusBtn"), bonusContent, false);
  setupAdminPanelToggles(adminSection, false);

  adminSection?.querySelectorAll(".admin-panel").forEach(panel => {
    setCollapsibleSectionState(
      panel.querySelector(".admin-toggle-btn"),
      panel.querySelector(".admin-panel-content"),
      false
    );
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
    const popupFallbackCodes = new Set([
      "auth/popup-blocked",
      "auth/popup-closed-by-user",
      "auth/cancelled-popup-request",
      "auth/operation-not-supported-in-this-environment"
    ]);

    if (popupFallbackCodes.has(error.code)) {
      try {
        await signInWithRedirect(auth, provider);
        return;
      } catch (redirectError) {
        console.error("Redirect login failed:", redirectError);
        alert(`Google login failed: ${redirectError.code || redirectError.message}`);
        return;
      }
    }

    alert(`Google login failed: ${error.code || error.message}`);
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

  await renderLeaderboardFromFirestore();
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
    finalsPicksSection.style.display = "none";
    finalsBonusSection.style.display = "none";
    semifinalPicksSection.style.display = "none";
    semifinalBonusSection.style.display = "none";
    round32PicksSection.style.display = "none";
    round32BonusSection.style.display = "none";
    quarterfinalPicksSection.style.display = "none";
    quarterfinalBonusSection.style.display = "none";
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
  if (profileSettingsContent) profileSettingsContent.style.display = "none";
  if (toggleProfileSettingsBtn) toggleProfileSettingsBtn.textContent = "Expand";
  if (userSnap.exists() && usernameInput) {
    usernameInput.value = userSnap.data().username || "";
  }

  groupPicksSection.style.display = "block";
  finalsPicksSection.style.display = "block";
  finalsBonusSection.style.display = "block";
  semifinalPicksSection.style.display = "block";
  semifinalBonusSection.style.display = "block";
  quarterfinalPicksSection.style.display = "block";
  quarterfinalBonusSection.style.display = "block";
  round32PicksSection.style.display = "block";
  round32BonusSection.style.display = "block";
  round16PicksSection.style.display = "block";
  round16BonusSection.style.display = "block";
  bonusSection.style.display = "block";

  await loadGroupLockTimes();
  renderGroupPicks();
  renderRound32Picks();
  renderRound32BonusQuestions();
  renderFinalsPicks();
  renderFinalsBonusQuestions();
  renderSemifinalPicks();
  renderSemifinalBonusQuestions();
  await renderQuarterfinalPicks();
  await renderQuarterfinalBonusQuestions();
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
  await loadExistingFinalsPicks();
  await loadExistingFinalsBonusAnswers();
  await loadExistingSemifinalPicks();
  await loadExistingSemifinalBonusAnswers();
  await loadExistingQuarterfinalPicks();
  await loadExistingQuarterfinalBonusAnswers();
  await renderUserBonusAnswerKeys();

  if (ADMIN_EMAILS.includes(user.email)) {
    round16PicksSection?.insertAdjacentElement("beforebegin", adminSection);
    adminSection.style.display = "block";
    if (refreshLeaderboardBtn) refreshLeaderboardBtn.style.display = "inline-block";
    setupAdminPanelToggles(adminSection, false);
    minimizeAdminDefaultSections();
    renderAdminGroupResults();
    renderAdminRound32Results();
    renderAdminRound32BonusResults();
    renderAdminFinalsResults();
    renderAdminFinalsBonusResults();
    renderAdminSemifinalResults();
    renderAdminSemifinalBonusResults();
    await renderAdminQuarterfinalResults();
    await renderAdminQuarterfinalBonusQuestions();
    await renderAdminQuarterfinalBonusResults();
    await renderAdminRound16Results();
    await renderAdminRound16BonusQuestions();
    renderAdminBonusResults();
    await loadExistingGroupResults();
    await loadExistingRound32Results();
    await loadExistingRound32BonusResults();
    await loadExistingFinalsResults();
    await loadExistingFinalsBonusResults();
    await loadExistingSemifinalResults();
    await loadExistingSemifinalBonusResults();
    await loadExistingQuarterfinalResults();
    await loadExistingQuarterfinalBonusResults();
    await loadExistingRound16Results();
    await loadExistingBonusResults();
    await renderAdminFinalsSurveySummary();
    await renderAdminPlayerList();
    await renderLeaderboardFromFirestore();
  } else {
    if (refreshLeaderboardBtn) refreshLeaderboardBtn.style.display = "none";
    await renderLeaderboardFromFirestore();
  }
});

function injectBonusSection() {
  bonusSection = document.createElement("section");
  bonusSection.className = "card";
  bonusSection.id = "bonusSection";
  bonusSection.style.display = "none";

  bonusSection.innerHTML = `
    <div class="section-header">
      <h2>🎯 Opening Bonus Questions</h2>
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

    <div class="admin-panel">
      <div class="section-header admin-panel-header">
        <div>
          <span class="admin-panel-label">Quarterfinals tracking</span>
          <h3>Quarterfinals Pick Status</h3>
        </div>
        <button class="secondary-btn admin-toggle-btn">Minimize</button>
      </div>
      <div class="admin-panel-content">
        <p class="mini-note">Quick check for who has saved every Quarterfinals match pick and completed the Quarterfinals bonus questions.</p>
        <div id="adminQuarterfinalPlayerList"></div>
      </div>
    </div>

    <div class="admin-panel">
      <div class="section-header admin-panel-header">
        <div>
          <span class="admin-panel-label">Semifinals tracking</span>
          <h3>Semifinals Pick Status</h3>
        </div>
        <button class="secondary-btn admin-toggle-btn">Minimize</button>
      </div>
      <div class="admin-panel-content">
        <p class="mini-note">Quick check for who has saved every Semifinals match pick and completed the Semifinal bonus questions.</p>
        <div id="adminSemifinalPlayerList"></div>
      </div>
    </div>

    <div class="admin-panel">
      <div class="section-header admin-panel-header">
        <div>
          <span class="admin-panel-label">Finals tracking</span>
          <h3>Finals Pick Status</h3>
        </div>
        <button class="secondary-btn admin-toggle-btn">Minimize</button>
      </div>
      <div class="admin-panel-content">
        <p class="mini-note">Quick check for who has saved every Finals match pick, completed the Finals bonus questions, and submitted the survey.</p>
        <div id="adminFinalsPlayerList"></div>
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
  adminQuarterfinalPlayerList = document.getElementById("adminQuarterfinalPlayerList");
  adminSemifinalPlayerList = document.getElementById("adminSemifinalPlayerList");
  adminFinalsPlayerList = document.getElementById("adminFinalsPlayerList");
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

function emptyDocsSnapshot() {
  return { forEach() {} };
}

async function getOptionalCollectionDocs(collectionName) {
  try {
    return await getDocs(collection(db, collectionName));
  } catch (error) {
    console.warn(`Could not load optional collection ${collectionName}:`, error);
    return emptyDocsSnapshot();
  }
}

async function getOptionalDoc(collectionName, docId) {
  try {
    return await getDoc(doc(db, collectionName, docId));
  } catch (error) {
    console.warn(`Could not load optional document ${collectionName}/${docId}:`, error);
    return null;
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
  const knownWinner = knownRound32Winners[matchId];
  if (knownWinner) return [knownWinner];

  const resultWinner = round32Results[matchId]?.winner;
  if (resultWinner) return [resultWinner];

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
    const teams = round16SlotTeams(matchId, round32Results);
    return teams.length === 1 ? teams : [];
  });

  return participants.length === 2 ? participants : [];
}

function round16MatchupLabel(match, round32Results = {}) {
  return match.sourceMatchIds.map(matchId => round16SlotLabel(matchId, round32Results)).join(" vs ");
}

async function getRound16OfficialResults() {
  const snap = await getDoc(doc(db, "round16Results", "official"));
  return snap.exists() ? snap.data().results || {} : {};
}

function findRound16Match(matchId) {
  return round16Matches.find(match => match.id === matchId);
}

function quarterfinalSlotTeams(matchId, round16Results = {}, round32Results = {}) {
  const resultWinner = round16Results[matchId]?.winner;
  if (resultWinner) return [resultWinner];

  const sourceMatch = findRound16Match(matchId);
  return sourceMatch ? round16PossibleTeams(sourceMatch, round32Results) : [];
}

function quarterfinalSlotLabel(matchId, round16Results = {}, round32Results = {}) {
  const teams = quarterfinalSlotTeams(matchId, round16Results, round32Results);

  if (teams.length === 1) {
    return round32TeamLabel(teams[0]);
  }

  const sourceMatch = findRound16Match(matchId);
  const fallback = sourceMatch
    ? round16MatchupLabel(sourceMatch, round32Results)
    : `Match ${matchId}`;

  return `Winner Match ${matchId} (${fallback})`;
}

function quarterfinalPossibleTeams(match, round16Results = {}, round32Results = {}) {
  return sortTeamsAlphabetically([
    ...new Set(match.sourceMatchIds.flatMap(matchId =>
      quarterfinalSlotTeams(matchId, round16Results, round32Results)
    ))
  ]);
}

function quarterfinalResolvedParticipants(match, round16Results = {}, round32Results = {}) {
  const participants = match.sourceMatchIds.flatMap(matchId => {
    const teams = quarterfinalSlotTeams(matchId, round16Results, round32Results);
    return teams.length === 1 ? teams : [];
  });

  return participants.length === 2 ? participants : [];
}

function quarterfinalMatchupLabel(match, round16Results = {}, round32Results = {}) {
  return match.sourceMatchIds
    .map(matchId => quarterfinalSlotLabel(matchId, round16Results, round32Results))
    .join(" vs ");
}

function quarterfinalTeamOptions(round16Results = {}, round32Results = {}) {
  return sortTeamsAlphabetically([
    ...new Set(quarterfinalMatches.flatMap(match =>
      quarterfinalPossibleTeams(match, round16Results, round32Results)
    ))
  ]);
}

function getTickerMatchForRound16Match(match) {
  const participants = round16ResolvedParticipants(match);
  if (participants.length !== 2 || !latestTickerMatches.length) return null;

  return latestTickerMatches.find(tickerMatch => {
    if (String(tickerMatch.round || "").toLowerCase() !== "r16") return false;

    const home = tickerMatch.home?.name || "";
    const away = tickerMatch.away?.name || "";

    return (
      sameTickerTeam(home, participants[0]) && sameTickerTeam(away, participants[1])
    ) || (
      sameTickerTeam(home, participants[1]) && sameTickerTeam(away, participants[0])
    );
  }) || null;
}

function tickerMatchHasStarted(match) {
  const statusType = String(match?.status?.type || "").toLowerCase();
  if (statusType === "live" || statusType === "final") return true;

  const kickoffTime = new Date(match?.date).getTime();
  return !Number.isNaN(kickoffTime) && Date.now() >= kickoffTime;
}

function round16MatchIsLocked(match) {
  const tickerMatch = getTickerMatchForRound16Match(match);
  if (tickerMatch) return tickerMatchHasStarted(tickerMatch);

  return new Date() >= new Date(match.startTime);
}

function round16PickIsRevealable(match) {
  return round16MatchIsLocked(match);
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

      <label>Final score</label>
      <div class="score-entry-row" aria-label="Final score">
        <input
          id="round16-${match.id}-winnerGoals"
          class="score-number-input"
          type="text"
          inputmode="numeric"
          pattern="[0-9]*"
          autocomplete="off"
          enterkeyhint="next"
          data-score-number
          aria-label="Selected winner final goals"
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
          aria-label="Opponent final goals"
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
      winnerCorrect &&
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
    if (score) labelParts.push(scoreCorrect ? "score ✓" : winnerCorrect ? "score X" : "score needs winner");
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
    scoring: { winner: 3, score: 2, scoreRequiresCorrectWinner: true, extraTimeOrPenaltiesCorrect: 1, extraTimeOrPenaltiesWrong: -1 },
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

async function renderAdminRound16BonusQuestions() {
  if (!adminRound16BonusQuestions) return;

  const round32Results = await getRound32OfficialResults();

  adminRound16BonusQuestions.innerHTML = `
    <div class="pick-card">
      <label>1. Which Round of 16 match will have the most total goals?</label>
      <p class="mini-note">Correct match = 2 points.</p>
      <select disabled>
        ${renderRound16MatchOptions(round32Results)}
      </select>
    </div>

    <div class="pick-card">
      <label>2. How many clean sheets will there be in the Round of 16?</label>
      <p class="mini-note">Exact = 3 points. Within 1 = 2 points.</p>
      <input type="number" min="0" max="16" disabled />
    </div>

    <div class="pick-card">
      <label>3. Order the regions by most goals scored during the Round of 16.</label>
      <p class="mini-note">Each correct spot = 1 point.</p>
      ${renderRound16RegionCountryGuide(round32Results)}
      <select disabled>${renderRound16RegionOptions("1st most goals")}</select>
      <select disabled>${renderRound16RegionOptions("2nd most goals")}</select>
      <select disabled>${renderRound16RegionOptions("3rd most goals")}</select>
      <select disabled>${renderRound16RegionOptions("4th most goals")}</select>
    </div>
  `;
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

  if (!round16BonusResultsAreComplete(round16Results)) {
    return;
  }

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

function quarterfinalMatchIsLocked(match) {
  return new Date() >= new Date(match.startTime);
}

function quarterfinalPickIsRevealable(match) {
  return quarterfinalMatchIsLocked(match);
}

function allQuarterfinalMatchesAreLocked() {
  return quarterfinalMatches.every(match => quarterfinalMatchIsLocked(match));
}

function quarterfinalMatchTimeLabel(match) {
  return new Date(match.startTime).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short"
  });
}

function renderQuarterfinalWinnerOptions(match, round16Results, round32Results, placeholder = "Select winner") {
  return `
    <option value="">${escapeHTML(placeholder)}</option>
    ${quarterfinalPossibleTeams(match, round16Results, round32Results)
      .map(team => `<option value="${escapeHTML(team)}">${escapeHTML(round32TeamLabel(team))}</option>`)
      .join("")}
  `;
}

function renderQuarterfinalMatchOptions(round16Results, round32Results, placeholder = "Select match") {
  return `
    <option value="">${escapeHTML(placeholder)}</option>
    ${quarterfinalMatches
      .map(match => `<option value="${escapeHTML(match.id)}">${escapeHTML(`${match.label}: ${quarterfinalMatchupLabel(match, round16Results, round32Results)}`)}</option>`)
      .join("")}
  `;
}

function renderQuarterfinalTeamSelectOptions(round16Results, round32Results, placeholder = "Select team") {
  return `
    <option value="">${escapeHTML(placeholder)}</option>
    ${quarterfinalTeamOptions(round16Results, round32Results)
      .map(team => `<option value="${escapeHTML(team)}">${escapeHTML(round32TeamLabel(team))}</option>`)
      .join("")}
  `;
}

async function getQuarterfinalSourceResults() {
  const [round16Results, round32Results] = await Promise.all([
    getRound16OfficialResults(),
    getRound32OfficialResults()
  ]);

  return { round16Results, round32Results };
}

async function renderQuarterfinalPicks() {
  if (!quarterfinalPicksForm) return;

  const { round16Results, round32Results } = await getQuarterfinalSourceResults();
  quarterfinalPicksForm.innerHTML = "";

  quarterfinalMatches.forEach(match => {
    const locked = quarterfinalMatchIsLocked(match);
    const wrapper = document.createElement("div");
    wrapper.className = "pick-card";
    const matchupLabel = quarterfinalMatchupLabel(match, round16Results, round32Results);

    wrapper.innerHTML = `
      <h3>${escapeHTML(matchupLabel)} ${locked ? "🔒" : ""}</h3>
      <p class="lock-note">Kickoff: <strong>${quarterfinalMatchTimeLabel(match)}</strong> · ${escapeHTML(match.venue)}</p>

      <label>Winner</label>
      <select id="quarterfinal-${match.id}-winner" ${locked ? "disabled" : ""}>
        ${renderQuarterfinalWinnerOptions(match, round16Results, round32Results)}
      </select>

      <label class="quarterfinal-score-label">Final score</label>
      <div class="score-entry-row" aria-label="Final score">
        <input
          id="quarterfinal-${match.id}-winnerGoals"
          class="score-number-input"
          type="text"
          inputmode="numeric"
          pattern="[0-9]*"
          autocomplete="off"
          enterkeyhint="next"
          data-score-number
          aria-label="Selected winner final goals"
          ${locked ? "disabled" : ""}
        />
        <span class="score-entry-dash">-</span>
        <input
          id="quarterfinal-${match.id}-otherGoals"
          class="score-number-input"
          type="text"
          inputmode="numeric"
          pattern="[0-9]*"
          autocomplete="off"
          enterkeyhint="done"
          data-score-number
          aria-label="Opponent final goals"
          ${locked ? "disabled" : ""}
        />
      </div>
      <label class="checkbox-row">
        <input type="checkbox" id="quarterfinal-${match.id}-extraTimeOrPenalties" ${locked ? "disabled" : ""} />
        Goes to extra time or penalties
      </label>
      <p id="quarterfinal-${match.id}-result" class="answer-result"></p>
    `;

    quarterfinalPicksForm.appendChild(wrapper);
  });

  setupNumericScoreInputs(quarterfinalPicksForm);

  if (allQuarterfinalMatchesAreLocked()) {
    quarterfinalPicksStatus.textContent = "🔒 All Quarterfinals picks are locked.";
    saveQuarterfinalPicksBtn.disabled = true;
    saveQuarterfinalPicksBtn.textContent = "Quarterfinals Picks Locked";
  } else {
    saveQuarterfinalPicksBtn.disabled = false;
    saveQuarterfinalPicksBtn.textContent = "Save Quarterfinals Picks";
  }
}

async function loadExistingQuarterfinalPicks() {
  let snap;

  try {
    snap = await getDoc(doc(db, "quarterfinalPicks", currentUser.uid));
  } catch (error) {
    console.error("Failed to load Quarterfinals picks:", error);
    quarterfinalPicksStatus.className = "status-message status-error";
    quarterfinalPicksStatus.textContent =
      "Could not load saved Quarterfinals picks. Check Firestore rules for quarterfinalPicks.";
    return;
  }

  if (!snap.exists()) return;

  const data = snap.data();

  Object.entries(data.picks || {}).forEach(([matchId, pick]) => {
    setValue(`quarterfinal-${matchId}-winner`, pick.winner);
    setRound16ScoreInputs("quarterfinal", matchId, pick.score);

    const extraTimeOrPenalties = document.getElementById(`quarterfinal-${matchId}-extraTimeOrPenalties`);
    if (extraTimeOrPenalties) {
      extraTimeOrPenalties.checked = !!pick.extraTimeOrPenalties;
    }
  });

  if (allQuarterfinalMatchesAreLocked()) {
    quarterfinalPicksStatus.className = "status-message status-locked";
    quarterfinalPicksStatus.textContent = "🔒 All Quarterfinals picks are locked.";
  } else {
    quarterfinalPicksStatus.className = "status-message status-info";
    quarterfinalPicksStatus.textContent = "Loaded saved Quarterfinals picks.";
  }

  await applyQuarterfinalPickIndicators();
}

async function applyQuarterfinalPickIndicators() {
  let snap;

  try {
    snap = await getDoc(doc(db, "quarterfinalResults", "official"));
  } catch (error) {
    console.warn("Could not load Quarterfinals official results for indicators:", error);
    return;
  }

  if (!snap.exists()) return;

  const results = snap.data().results || {};

  quarterfinalMatches.forEach(match => {
    const indicatorId = `quarterfinal-${match.id}-result`;
    clearScoringIndicator(indicatorId);

    const result = results[match.id];
    const winner = getValue(`quarterfinal-${match.id}-winner`);
    const score = getRound16ScoreFromInputs("quarterfinal", match.id);
    const resultScore = normalizeWinnerFirstScore(result?.score);
    if (!winner || !result?.winner) return;

    const winnerCorrect = sameCountryOption(winner, result.winner);
    const scoreCorrect =
      winnerCorrect &&
      !!parseWinnerFirstScore(score) &&
      !!parseWinnerFirstScore(resultScore) &&
      score === resultScore;
    const pickedExtraTime = document.getElementById(`quarterfinal-${match.id}-extraTimeOrPenalties`)?.checked || false;

    let points = 0;
    if (winnerCorrect) points += 3;
    if (scoreCorrect) points += 2;
    if (pickedExtraTime) points += result.extraTimeOrPenalties ? 1 : -1;

    const labelParts = [];
    labelParts.push(winnerCorrect ? "Winner ✓" : "Winner X");
    if (score) labelParts.push(scoreCorrect ? "score ✓" : winnerCorrect ? "score X" : "score needs winner");
    if (pickedExtraTime) labelParts.push(result.extraTimeOrPenalties ? "ET/Pens ✓" : "ET/Pens X");

    setScoringIndicator(
      indicatorId,
      pointsState(points),
      labelParts.join(", "),
      points
    );
  });
}

saveQuarterfinalPicksBtn?.addEventListener("click", async () => {
  if (!currentUser) return alert("Please sign in first.");
  if (allQuarterfinalMatchesAreLocked()) return alert("All Quarterfinals picks are locked.");

  const { round16Results, round32Results } = await getQuarterfinalSourceResults();
  const existingSnap = await getOptionalDoc("quarterfinalPicks", currentUser.uid);
  const picks = existingSnap?.exists() ? existingSnap.data().picks || {} : {};

  let savedAnyUnlockedMatch = false;

  for (const match of quarterfinalMatches) {
    if (quarterfinalMatchIsLocked(match)) continue;

    const winner = getValue(`quarterfinal-${match.id}-winner`);
    const score = getRound16ScoreFromInputs("quarterfinal", match.id);
    const extraTimeOrPenalties =
      document.getElementById(`quarterfinal-${match.id}-extraTimeOrPenalties`)?.checked || false;

    if (!winner) return alert(`Pick a winner for ${match.label}.`);

    const validTeams = quarterfinalPossibleTeams(match, round16Results, round32Results);
    if (!validTeams.includes(winner)) return alert(`${match.label}: selected winner is not valid for this matchup.`);

    const scoreError = score === null
      ? `${match.label}: enter both score numbers.`
      : validateRound16Score(score, match.label);
    if (scoreError) return alert(scoreError);

    picks[match.id] = { winner, score, extraTimeOrPenalties };
    savedAnyUnlockedMatch = true;
  }

  if (!savedAnyUnlockedMatch) {
    return alert("No unlocked Quarterfinals matches are available to save.");
  }

  quarterfinalPicksStatus.className = "status-message status-info";
  quarterfinalPicksStatus.textContent = "Saving Quarterfinals picks...";
  saveQuarterfinalPicksBtn.disabled = true;

  try {
    await setDoc(doc(db, "quarterfinalPicks", currentUser.uid), {
      uid: currentUser.uid,
      email: currentUser.email,
      picks,
      scoring: { winner: 3, score: 2, scoreRequiresCorrectWinner: true, extraTimeOrPenaltiesCorrect: 1, extraTimeOrPenaltiesWrong: -1 },
      updatedAt: new Date().toISOString()
    }, { merge: true });

    quarterfinalPicksStatus.className = "status-message status-success";
    quarterfinalPicksStatus.textContent =
      "✅ Quarterfinals picks saved! Your answers are saved.";
    await applyQuarterfinalPickIndicators();
    quarterfinalBonusSection?.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    console.error("Failed to save Quarterfinals picks:", error);
    quarterfinalPicksStatus.className = "status-message status-error";
    quarterfinalPicksStatus.textContent =
      "Quarterfinals picks were not saved. Check Firestore rules for quarterfinalPicks.";
  } finally {
    if (!allQuarterfinalMatchesAreLocked()) {
      saveQuarterfinalPicksBtn.disabled = false;
    }
  }
});

function quarterfinalBonusAnswersAreLocked() {
  return quarterfinalMatchIsLocked(quarterfinalMatches[0]);
}

function quarterfinalBonusAnswersAreRevealable() {
  return quarterfinalMatchIsLocked(quarterfinalMatches[0]);
}

async function renderQuarterfinalBonusQuestions() {
  if (!quarterfinalBonusForm) return;

  const { round16Results, round32Results } = await getQuarterfinalSourceResults();

  quarterfinalBonusForm.innerHTML = `
    <div class="pick-card">
      <label>1. Will any team keep a clean sheet in the quarterfinals?</label>
      <select id="quarterfinal-bonus-anyCleanSheet">
        <option value="">Select answer</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
      <p id="quarterfinal-bonus-anyCleanSheet-result" class="answer-result"></p>
    </div>

    <div class="pick-card">
      <label>2. Which quarterfinal team will score the most goals?</label>
      <p class="mini-note">Tied top scorer counts.</p>
      <select id="quarterfinal-bonus-mostGoalsTeam">
        ${renderQuarterfinalTeamSelectOptions(round16Results, round32Results)}
      </select>
      <p id="quarterfinal-bonus-mostGoalsTeam-result" class="answer-result"></p>
    </div>

    <div class="pick-card">
      <label>3. Which quarterfinal match will have the most free kicks?</label>
      <p class="mini-note">Combined total for both teams.</p>
      <select id="quarterfinal-bonus-mostFreeKicksMatch">
        ${renderQuarterfinalMatchOptions(round16Results, round32Results)}
      </select>
      <p id="quarterfinal-bonus-mostFreeKicksMatch-result" class="answer-result"></p>
    </div>
  `;

  if (quarterfinalBonusAnswersAreLocked()) {
    quarterfinalBonusStatus.className = "status-message status-locked";
    quarterfinalBonusStatus.textContent = "🔒 Quarterfinals bonus answers are locked.";
    saveQuarterfinalBonusBtn.disabled = true;
    saveQuarterfinalBonusBtn.textContent = "Quarterfinals Bonus Locked";
    [
      "quarterfinal-bonus-anyCleanSheet",
      "quarterfinal-bonus-mostGoalsTeam",
      "quarterfinal-bonus-mostFreeKicksMatch"
    ].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = true;
    });
  } else {
    quarterfinalBonusStatus.className = "";
    saveQuarterfinalBonusBtn.disabled = false;
    saveQuarterfinalBonusBtn.textContent = "Save Quarterfinals Bonus Answers";
  }
}

async function renderAdminQuarterfinalBonusQuestions() {
  if (!adminQuarterfinalBonusQuestions) return;

  const { round16Results, round32Results } = await getQuarterfinalSourceResults();

  adminQuarterfinalBonusQuestions.innerHTML = `
    <div class="quarterfinal-bonus-instructions">
      Each bonus question is worth <strong>${QUARTERFINAL_BONUS_POINTS} points</strong>.
    </div>

    <div class="pick-card">
      <label>1. Will any team keep a clean sheet in the quarterfinals?</label>
      <select disabled>
        <option value="">Select answer</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    </div>

    <div class="pick-card">
      <label>2. Which quarterfinal team will score the most goals?</label>
      <p class="mini-note">Tied top scorer counts.</p>
      <select disabled>${renderQuarterfinalTeamSelectOptions(round16Results, round32Results)}</select>
    </div>

    <div class="pick-card">
      <label>3. Which quarterfinal match will have the most free kicks?</label>
      <p class="mini-note">Combined total for both teams.</p>
      <select disabled>${renderQuarterfinalMatchOptions(round16Results, round32Results)}</select>
    </div>
  `;
}

async function renderAdminQuarterfinalBonusResults() {
  if (!adminQuarterfinalBonusResultsForm) return;

  const { round16Results, round32Results } = await getQuarterfinalSourceResults();
  const teams = quarterfinalTeamOptions(round16Results, round32Results);

  adminQuarterfinalBonusResultsForm.innerHTML = `
    <div class="admin-bonus-key-card">
      <span class="admin-panel-label">Editable answer key</span>
      <h3>Official Quarterfinals Bonus Answers</h3>
      <p class="mini-note">These saved answers are used for scoring. Select every tied correct team or match when a question allows ties.</p>

      <div class="pick-card">
        <label>1. Will any team keep a clean sheet in the quarterfinals?</label>
        <select id="result-quarterfinal-bonus-anyCleanSheet">
          <option value="">Select answer</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </div>

      <div class="pick-card">
        <label>2. Which quarterfinal team will score the most goals?</label>
        <p class="mini-note">Select every tied top scorer.</p>
        <div class="admin-checkbox-grid">
          ${teams.map(team => `
            <label class="checkbox-row">
              <input type="checkbox" data-quarterfinal-bonus-goals-team="${escapeHTML(team)}" />
              ${escapeHTML(round32TeamLabel(team))}
            </label>
          `).join("")}
        </div>
      </div>

      <div class="pick-card">
        <label>3. Which quarterfinal match will have the most free kicks?</label>
        <p class="mini-note">Select every tied match.</p>
        <div class="admin-checkbox-grid">
          ${quarterfinalMatches.map(match => `
            <label class="checkbox-row">
              <input type="checkbox" data-quarterfinal-bonus-free-kicks-match="${escapeHTML(match.id)}" />
              ${escapeHTML(quarterfinalMatchupLabel(match, round16Results, round32Results))}
            </label>
          `).join("")}
        </div>
      </div>
    </div>
  `;
}

async function loadExistingQuarterfinalBonusResults() {
  const snap = await getOptionalDoc("quarterfinalBonusResults", "official");
  if (!snap?.exists()) return;

  const results = snap.data().results || {};
  setValue("result-quarterfinal-bonus-anyCleanSheet", results.anyCleanSheet);

  const mostGoalsTeams = Array.isArray(results.mostGoalsTeams) ? results.mostGoalsTeams : [];
  adminQuarterfinalBonusResultsForm
    ?.querySelectorAll("[data-quarterfinal-bonus-goals-team]")
    .forEach(input => {
      input.checked = mostGoalsTeams.some(team => sameCountryOption(team, input.dataset.quarterfinalBonusGoalsTeam));
    });

  const mostFreeKicksMatchIds = new Set(results.mostFreeKicksMatchIds || []);
  adminQuarterfinalBonusResultsForm
    ?.querySelectorAll("[data-quarterfinal-bonus-free-kicks-match]")
    .forEach(input => {
      input.checked = mostFreeKicksMatchIds.has(input.dataset.quarterfinalBonusFreeKicksMatch);
    });
}

saveQuarterfinalBonusResultsBtn?.addEventListener("click", async () => {
  const mostGoalsTeams = Array.from(
    adminQuarterfinalBonusResultsForm.querySelectorAll("[data-quarterfinal-bonus-goals-team]:checked")
  ).map(input => input.dataset.quarterfinalBonusGoalsTeam);
  const mostFreeKicksMatchIds = Array.from(
    adminQuarterfinalBonusResultsForm.querySelectorAll("[data-quarterfinal-bonus-free-kicks-match]:checked")
  ).map(input => input.dataset.quarterfinalBonusFreeKicksMatch);

  const results = {
    anyCleanSheet: getValue("result-quarterfinal-bonus-anyCleanSheet"),
    mostGoalsTeams,
    mostFreeKicksMatchIds
  };

  if (!results.anyCleanSheet) return alert("Select the official clean sheet answer.");
  if (!results.mostGoalsTeams.length) return alert("Select at least one official most-goals team.");
  if (!results.mostFreeKicksMatchIds.length) return alert("Select at least one official most-free-kicks match.");

  quarterfinalBonusResultsStatus.className = "status-message status-info";
  quarterfinalBonusResultsStatus.textContent = "Saving Quarterfinals bonus answer key...";
  saveQuarterfinalBonusResultsBtn.disabled = true;

  try {
    await setDoc(doc(db, "quarterfinalBonusResults", "official"), {
      results,
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser.email
    }, { merge: true });

    quarterfinalBonusResultsStatus.className = "status-message status-success";
    quarterfinalBonusResultsStatus.textContent = "✅ Quarterfinals bonus answer key saved!";
    showSaveNotification("Quarterfinals bonus key saved!");
    await renderAdminQuarterfinalBonusKey(null, results);
    await renderUserQuarterfinalBonusAnswerKey();
    await applyQuarterfinalBonusIndicators();
    await renderLeaderboardFromFirestore();
  } catch (error) {
    console.error("Failed to save Quarterfinals bonus answer key:", error);
    quarterfinalBonusResultsStatus.className = "status-message status-error";
    quarterfinalBonusResultsStatus.textContent =
      "Quarterfinals bonus answer key was not saved. Check Firestore rules for quarterfinalBonusResults.";
  } finally {
    saveQuarterfinalBonusResultsBtn.disabled = false;
  }
});

async function loadExistingQuarterfinalBonusAnswers() {
  let snap;

  try {
    snap = await getDoc(doc(db, "quarterfinalBonusAnswers", currentUser.uid));
  } catch (error) {
    console.error("Failed to load Quarterfinals bonus answers:", error);
    quarterfinalBonusStatus.className = "status-message status-error";
    quarterfinalBonusStatus.textContent =
      "Could not load saved Quarterfinals bonus answers. Check Firestore rules for quarterfinalBonusAnswers.";
    return;
  }

  if (!snap.exists()) return;

  const answers = snap.data().answers || {};

  setValue("quarterfinal-bonus-anyCleanSheet", answers.anyCleanSheet);
  setValue("quarterfinal-bonus-mostGoalsTeam", answers.mostGoalsTeam);
  setValue("quarterfinal-bonus-mostFreeKicksMatch", answers.mostFreeKicksMatch);

  if (!quarterfinalBonusAnswersAreLocked()) {
    quarterfinalBonusStatus.className = "status-message status-info";
    quarterfinalBonusStatus.textContent = "Loaded saved Quarterfinals bonus answers.";
  }

  await applyQuarterfinalBonusIndicators();
}

async function applyQuarterfinalBonusIndicators() {
  [
    "quarterfinal-bonus-anyCleanSheet-result",
    "quarterfinal-bonus-mostGoalsTeam-result",
    "quarterfinal-bonus-mostFreeKicksMatch-result"
  ].forEach(clearScoringIndicator);

  const [snap, manualSnap, sourceResults] = await Promise.all([
    getOptionalDoc("quarterfinalResults", "official"),
    getOptionalDoc("quarterfinalBonusResults", "official"),
    getQuarterfinalSourceResults()
  ]);
  const manualKey = manualSnap?.exists() ? manualSnap.data().results || {} : null;
  const hasManualKey = quarterfinalManualBonusKeyIsComplete(manualKey);
  if (!snap?.exists() && !hasManualKey) return;

  const results = snap?.exists() ? snap.data().results || {} : {};
  if (!hasManualKey && !quarterfinalBonusResultsAreComplete(results)) return;

  const key = hasManualKey
    ? normalizeQuarterfinalManualBonusKey(manualKey)
    : getQuarterfinalBonusAnswerKey(
      results,
      sourceResults.round16Results,
      sourceResults.round32Results
    );
  if (!key) return;

  const anyCleanSheetAnswer = getValue("quarterfinal-bonus-anyCleanSheet");
  if (anyCleanSheetAnswer) {
    const correct = anyCleanSheetAnswer === (key.anyCleanSheet ? "yes" : "no");
    setScoringIndicator(
      "quarterfinal-bonus-anyCleanSheet-result",
      correct ? "correct" : "wrong",
      correct ? "Correct" : "Wrong",
      correct ? QUARTERFINAL_BONUS_POINTS : 0
    );
  }

  const mostGoalsTeamAnswer = getValue("quarterfinal-bonus-mostGoalsTeam");
  if (mostGoalsTeamAnswer) {
    const correct = key.mostGoalsTeams.some(team => sameCountryOption(mostGoalsTeamAnswer, team));
    setScoringIndicator(
      "quarterfinal-bonus-mostGoalsTeam-result",
      correct ? "correct" : "wrong",
      correct ? "Correct team" : "Wrong team",
      correct ? QUARTERFINAL_BONUS_POINTS : 0
    );
  }

  const mostFreeKicksAnswer = getValue("quarterfinal-bonus-mostFreeKicksMatch");
  if (mostFreeKicksAnswer) {
    const correct = key.mostFreeKicksMatchIds.includes(mostFreeKicksAnswer);
    setScoringIndicator(
      "quarterfinal-bonus-mostFreeKicksMatch-result",
      correct ? "correct" : "wrong",
      correct ? "Correct match" : "Wrong match",
      correct ? QUARTERFINAL_BONUS_POINTS : 0
    );
  }
}

saveQuarterfinalBonusBtn?.addEventListener("click", async () => {
  if (!currentUser) return alert("Please sign in first.");
  if (quarterfinalBonusAnswersAreLocked()) return alert("Quarterfinals bonus answers are locked.");

  const answers = {
    anyCleanSheet: getValue("quarterfinal-bonus-anyCleanSheet"),
    mostGoalsTeam: getValue("quarterfinal-bonus-mostGoalsTeam"),
    mostFreeKicksMatch: getValue("quarterfinal-bonus-mostFreeKicksMatch")
  };

  if (!answers.anyCleanSheet) return alert("Answer whether any Quarterfinals team will keep a clean sheet.");
  if (!answers.mostGoalsTeam) return alert("Select the Quarterfinals team that will score the most goals.");
  if (!answers.mostFreeKicksMatch) return alert("Select the Quarterfinals match with the most free kicks.");

  quarterfinalBonusStatus.className = "status-message status-info";
  quarterfinalBonusStatus.textContent = "Saving Quarterfinals bonus answers...";
  saveQuarterfinalBonusBtn.disabled = true;

  try {
    await setDoc(doc(db, "quarterfinalBonusAnswers", currentUser.uid), {
      uid: currentUser.uid,
      email: currentUser.email,
      answers,
      scoring: {
        anyCleanSheet: QUARTERFINAL_BONUS_POINTS,
        mostGoalsTeam: QUARTERFINAL_BONUS_POINTS,
        mostFreeKicksMatch: QUARTERFINAL_BONUS_POINTS
      },
      updatedAt: new Date().toISOString()
    }, { merge: true });

    quarterfinalBonusStatus.className = "status-message status-success";
    quarterfinalBonusStatus.textContent = "✅ Quarterfinals bonus answers saved!";
    await applyQuarterfinalBonusIndicators();
  } catch (error) {
    console.error("Failed to save Quarterfinals bonus answers:", error);
    quarterfinalBonusStatus.className = "status-message status-error";
    quarterfinalBonusStatus.textContent =
      "Quarterfinals bonus answers were not saved. Check Firestore rules for quarterfinalBonusAnswers.";
  } finally {
    if (!quarterfinalBonusAnswersAreLocked()) {
      saveQuarterfinalBonusBtn.disabled = false;
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
    bonusStatus.className = "status-message status-locked";
    bonusStatus.textContent = "Opening bonus answers are locked.";
    saveBonusBtn.disabled = true;
    saveBonusBtn.textContent = "Opening Bonus Locked";
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
  if (mostGoalsCountry && openingMostGoalsCountryValues(results).length) {
    const correct = openingMostGoalsCountryIsCorrect(mostGoalsCountry, results);
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

  const normalizedRootingForCountries = rootingForCountries.map(canonicalCountryOptionValue);

  setValue("rooting-country-1", normalizedRootingForCountries[0]);
  setValue("rooting-country-2", normalizedRootingForCountries[1]);

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
  ].filter(Boolean).map(canonicalCountryOptionValue);

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

  await renderLeaderboardFromFirestore();
}

async function saveRootingForCountriesFromSemifinalBonus(team) {
  if (!currentUser || !team) return;

  const canonicalTeam = canonicalCountryOptionValue(team);
  const rootingForCountries = [canonicalTeam];
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

    setValue("rooting-country-1", canonicalTeam);
    setValue("rooting-country-2", "");
    if (rootingForStatus) {
      rootingForStatus.className = "status-message status-success";
      rootingForStatus.textContent = "✅ Rooting-for country updated from your Semifinal bonus pick!";
    }
  } catch (error) {
    console.warn("Could not sync Semifinal rooting-for choice:", error);
  }
}

function renderAdminBonusResults() {
  adminBonusResultsForm.innerHTML = `
    <div class="pick-card">
      <label>1. Country with most tournament goals</label>
      <p class="mini-note">Select every country that tied for the most tournament goals. Each matching user pick earns 1 point.</p>
      <div class="admin-checkbox-grid">
        ${countryOptions.map(country => `
          <label class="checkbox-row">
            <input type="checkbox" data-bonus-most-goals-country="${escapeHTML(country)}" />
            ${escapeHTML(countryOptionLabel(country))}
          </label>
        `).join("")}
      </div>
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

  const mostGoalsCountries = openingMostGoalsCountryValues(results);
  adminBonusResultsForm
    .querySelectorAll("[data-bonus-most-goals-country]")
    .forEach(input => {
      input.checked = mostGoalsCountries.some(country =>
        sameCountryOption(country, input.dataset.bonusMostGoalsCountry)
      );
    });
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

  const mostGoalsCountries = Array.from(
    adminBonusResultsForm.querySelectorAll("[data-bonus-most-goals-country]:checked")
  ).map(input => input.dataset.bonusMostGoalsCountry);

  const results = {
    mostGoalsCountry: mostGoalsCountries[0] || "",
    mostGoalsCountries,
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

  if (openingMostGoalsCountryIsCorrect(answers.mostGoalsCountry, results)) points += 1;

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
  await renderQuarterfinalPicks();
  await renderQuarterfinalBonusQuestions();
  await loadExistingRound16Picks();
  await loadExistingQuarterfinalPicks();
  await loadExistingQuarterfinalBonusAnswers();
  await renderLeaderboardFromFirestore();
});

function scoreRound32Picks(picks, results) {
  if (!picks || !results) return 0;

  let points = 0;

  Object.entries(picks).forEach(([matchId, pick]) => {
    const result = results[matchId];
    if (!pick || !result?.winner) return;

    // Winner prediction
    if (sameCountryOption(pick.winner, result.winner)) {
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

async function renderAdminQuarterfinalResults() {
  if (!adminQuarterfinalResultsForm) return;

  const { round16Results, round32Results } = await getQuarterfinalSourceResults();
  adminQuarterfinalResultsForm.innerHTML = "";

  quarterfinalMatches.forEach(match => {
    const wrapper = document.createElement("div");
    wrapper.className = "pick-card";
    const matchupLabel = quarterfinalMatchupLabel(match, round16Results, round32Results);

    wrapper.innerHTML = `
      <h3>${escapeHTML(matchupLabel)} Official Result</h3>

      <label>Winner</label>
      <select id="result-quarterfinal-${match.id}-winner">
        ${renderQuarterfinalWinnerOptions(match, round16Results, round32Results)}
      </select>

      <label>Final score</label>
      <div class="score-entry-row" aria-label="Official final score">
        <input
          id="result-quarterfinal-${match.id}-winnerGoals"
          class="score-number-input"
          type="text"
          inputmode="numeric"
          pattern="[0-9]*"
          autocomplete="off"
          enterkeyhint="next"
          data-score-number
          aria-label="Official winner final goals"
        />
        <span class="score-entry-dash">-</span>
        <input
          id="result-quarterfinal-${match.id}-otherGoals"
          class="score-number-input"
          type="text"
          inputmode="numeric"
          pattern="[0-9]*"
          autocomplete="off"
          enterkeyhint="done"
          data-score-number
          aria-label="Official opponent final goals"
        />
      </div>
      <p class="mini-note">Final score includes extra time, not shootout penalties. Put the winner's score first; use 1-1 for matches tied after extra time.</p>

      <label class="checkbox-row">
        <input type="checkbox" id="result-quarterfinal-${match.id}-extraTimeOrPenalties" />
        Went to extra time or penalties
      </label>

      <label>Combined free kicks</label>
      <input id="result-quarterfinal-${match.id}-freeKicks" type="number" min="0" />
    `;

    adminQuarterfinalResultsForm.appendChild(wrapper);
  });

  setupNumericScoreInputs(adminQuarterfinalResultsForm);
}

async function loadExistingQuarterfinalResults() {
  const snap = await getOptionalDoc("quarterfinalResults", "official");
  if (!snap?.exists()) {
    await renderAdminQuarterfinalBonusKey();
    return;
  }

  const results = snap.data().results || {};

  Object.entries(results).forEach(([matchId, result]) => {
    setValue(`result-quarterfinal-${matchId}-winner`, result.winner);
    setRound16ScoreInputs("result-quarterfinal", matchId, result.score);
    setValue(`result-quarterfinal-${matchId}-freeKicks`, result.freeKicks);

    const extraTimeOrPenalties = document.getElementById(`result-quarterfinal-${matchId}-extraTimeOrPenalties`);
    if (extraTimeOrPenalties) {
      extraTimeOrPenalties.checked = !!result.extraTimeOrPenalties;
    }
  });

  await renderAdminQuarterfinalBonusKey(results);
}

async function renderAdminQuarterfinalBonusKey(existingResults = null, manualKey = null) {
  if (!adminQuarterfinalBonusKey) return;

  const { round16Results, round32Results } = await getQuarterfinalSourceResults();
  const [quarterfinalSnap, manualSnap] = await Promise.all([
    existingResults ? Promise.resolve(null) : getOptionalDoc("quarterfinalResults", "official"),
    manualKey ? Promise.resolve(null) : getOptionalDoc("quarterfinalBonusResults", "official")
  ]);
  const results = existingResults || (quarterfinalSnap?.exists() ? quarterfinalSnap.data().results || {} : {});
  const completedCount = getQuarterfinalOfficialScores(results).length;
  const savedKey = manualKey || (manualSnap?.exists() ? manualSnap.data().results || {} : null);
  const key = quarterfinalManualBonusKeyIsComplete(savedKey)
    ? normalizeQuarterfinalManualBonusKey(savedKey)
    : getQuarterfinalBonusAnswerKey(results, round16Results, round32Results);

  if (!key) {
    adminQuarterfinalBonusKey.innerHTML = `
      <div class="admin-bonus-key-card">
        <span class="admin-panel-label">Quarterfinals bonus key</span>
        <h3>Bonus Answer Key</h3>
        <p class="mini-note">
          Pending: ${completedCount}/${quarterfinalMatches.length} Quarterfinals official results have winners, valid final scores, and free-kick totals.
          Bonus points will stay at 0 until all four matches are complete.
        </p>
      </div>
    `;
    return;
  }

  const mostFreeKicksMatches = key.mostFreeKicksMatchIds
    .map(matchId => quarterfinalMatches.find(match => match.id === matchId))
    .filter(Boolean);
  const keySourceLabel = quarterfinalManualBonusKeyIsComplete(savedKey)
    ? "Saved manually by admin"
    : "Calculated from official Quarterfinals results";

  adminQuarterfinalBonusKey.innerHTML = `
    <div class="admin-bonus-key-card">
      <span class="admin-panel-label">Quarterfinals bonus key</span>
      <h3>Bonus Answer Key</h3>
      <p class="mini-note">${escapeHTML(keySourceLabel)}. Saved manual answers are used for scoring when present.</p>
      <table class="admin-player-table admin-bonus-key-table">
        <tbody>
          <tr>
            <th>Any clean sheet?</th>
            <td>${key.anyCleanSheet ? "Yes" : "No"}</td>
          </tr>
          <tr>
            <th>Most goals team</th>
            <td>${key.mostGoalsTeams.map(team => escapeHTML(round32TeamLabel(team))).join("<br>")}</td>
          </tr>
          <tr>
            <th>Most free kicks match</th>
            <td>${mostFreeKicksMatches.map(match => escapeHTML(quarterfinalMatchupLabel(match, round16Results, round32Results))).join("<br>")}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

saveQuarterfinalResultsBtn?.addEventListener("click", async () => {
  const { round16Results, round32Results } = await getQuarterfinalSourceResults();
  const results = {};

  for (const match of quarterfinalMatches) {
    const winner = getValue(`result-quarterfinal-${match.id}-winner`);
    const score = getRound16ScoreFromInputs("result-quarterfinal", match.id);
    const extraTimeOrPenalties =
      document.getElementById(`result-quarterfinal-${match.id}-extraTimeOrPenalties`)?.checked || false;
    const freeKicks = getValue(`result-quarterfinal-${match.id}-freeKicks`);

    if (winner) {
      const validTeams = quarterfinalPossibleTeams(match, round16Results, round32Results);
      if (!validTeams.includes(winner)) {
        return alert(`${match.label}: selected winner is not valid for this matchup.`);
      }

      const scoreError = score === null
        ? `${match.label}: enter both score numbers.`
        : validateRound16Score(score, match.label);
      if (scoreError) return alert(scoreError);
    } else if (score !== "" || freeKicks !== "") {
      return alert(`${match.label}: select a winner before entering a score or free-kick total.`);
    }

    if (freeKicks !== "" && Number(freeKicks) < 0) {
      return alert(`${match.label}: free-kick total cannot be negative.`);
    }

    const participants = quarterfinalResolvedParticipants(match, round16Results, round32Results);

    results[match.id] = {
      winner,
      score,
      extraTimeOrPenalties,
      freeKicks,
      participants
    };
  }

  await setDoc(doc(db, "quarterfinalResults", "official"), {
    results,
    updatedAt: new Date().toISOString(),
    updatedBy: currentUser.email
  }, { merge: true });

  quarterfinalResultsStatus.textContent = "✅ Quarterfinals results saved!";
  await renderAdminQuarterfinalBonusKey(results);
  await renderUserQuarterfinalBonusAnswerKey();
  await renderQuarterfinalPicks();
  await renderQuarterfinalBonusQuestions();
  await loadExistingQuarterfinalPicks();
  await loadExistingQuarterfinalBonusAnswers();
  await renderLeaderboardFromFirestore();
});

function finalsMatchupLabel(match) {
  return `${round32TeamLabel(match.home)} vs ${round32TeamLabel(match.away)}`;
}

function finalsMatchIsLocked(match) {
  return new Date() >= new Date(match.startTime);
}

function finalsPickIsRevealable(match) {
  return finalsMatchIsLocked(match);
}

function allFinalsMatchesAreLocked() {
  return finalsMatches.every(match => finalsMatchIsLocked(match));
}

function finalsMatchTimeLabel(match) {
  return new Date(match.startTime).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short"
  });
}

function renderFinalsWinnerOptions(match, placeholder = "Select winner") {
  return `
    <option value="">${escapeHTML(placeholder)}</option>
    <option value="${escapeHTML(match.home)}">${escapeHTML(round32TeamLabel(match.home))}</option>
    <option value="${escapeHTML(match.away)}">${escapeHTML(round32TeamLabel(match.away))}</option>
  `;
}

function renderFinalsMatchOptions(placeholder = "Select match") {
  return `
    <option value="">${escapeHTML(placeholder)}</option>
    <option value="${escapeHTML(thirdPlaceMatch.id)}">Third-place match</option>
    <option value="${escapeHTML(finalMatch.id)}">World Cup final</option>
    <option value="same">Same number for both matches</option>
  `;
}

function renderFinalsPicks() {
  if (!finalsPicksForm) return;

  finalsPicksForm.innerHTML = "";

  finalsMatches.forEach(match => {
    const locked = finalsMatchIsLocked(match);
    const wrapper = document.createElement("div");
    wrapper.className = "pick-card";
    wrapper.innerHTML = `
      <h3>${escapeHTML(match.label)}: ${escapeHTML(finalsMatchupLabel(match))} ${locked ? "🔒" : ""}</h3>
      <p class="lock-note"><strong>${finalsMatchTimeLabel(match)}</strong></p>

      <label>Winner</label>
      <select id="finals-${match.id}-winner" ${locked ? "disabled" : ""}>
        ${renderFinalsWinnerOptions(match)}
      </select>

      <label class="quarterfinal-score-label">Final score</label>
      <div class="score-entry-row" aria-label="Final score">
        <input id="finals-${match.id}-winnerGoals" class="score-number-input" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" enterkeyhint="next" data-score-number aria-label="Selected winner final goals" ${locked ? "disabled" : ""} />
        <span class="score-entry-dash">-</span>
        <input id="finals-${match.id}-otherGoals" class="score-number-input" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" enterkeyhint="done" data-score-number aria-label="Opponent final goals" ${locked ? "disabled" : ""} />
      </div>

      <label class="checkbox-row">
        <input type="checkbox" id="finals-${match.id}-extraTimeOrPenalties" ${locked ? "disabled" : ""} />
        Goes to extra time or penalties
      </label>
      <p id="finals-${match.id}-result" class="answer-result"></p>
    `;

    finalsPicksForm.appendChild(wrapper);
  });

  setupNumericScoreInputs(finalsPicksForm);

  if (allFinalsMatchesAreLocked()) {
    finalsPicksStatus.className = "status-message status-locked";
    finalsPicksStatus.textContent = "🔒 All Finals picks are locked.";
    saveFinalsPicksBtn.disabled = true;
    saveFinalsPicksBtn.textContent = "Finals Picks Locked";
  } else {
    finalsPicksStatus.className = "";
    saveFinalsPicksBtn.disabled = false;
    saveFinalsPicksBtn.textContent = "Save Finals Picks";
  }
}

async function loadExistingFinalsPicks() {
  const snap = await getOptionalDoc("finalsPicks", currentUser.uid);
  if (!snap?.exists()) return;

  Object.entries(snap.data().picks || {}).forEach(([matchId, pick]) => {
    setValue(`finals-${matchId}-winner`, pick.winner);
    setRound16ScoreInputs("finals", matchId, pick.score);
    const extraTimeOrPenalties = document.getElementById(`finals-${matchId}-extraTimeOrPenalties`);
    if (extraTimeOrPenalties) extraTimeOrPenalties.checked = !!pick.extraTimeOrPenalties;
  });

  if (!allFinalsMatchesAreLocked()) {
    finalsPicksStatus.className = "status-message status-info";
    finalsPicksStatus.textContent = "Loaded saved Finals picks.";
  }

  await applyFinalsPickIndicators();
}

async function applyFinalsPickIndicators() {
  const snap = await getOptionalDoc("finalsResults", "official");
  if (!snap?.exists()) return;

  const results = snap.data().results || {};

  finalsMatches.forEach(match => {
    const indicatorId = `finals-${match.id}-result`;
    clearScoringIndicator(indicatorId);

    const result = results[match.id];
    const winner = getValue(`finals-${match.id}-winner`);
    const score = getRound16ScoreFromInputs("finals", match.id);
    if (!winner || !result?.winner) return;

    const points = finalsPickPointsFor(match.id, {
      winner,
      score,
      extraTimeOrPenalties: document.getElementById(`finals-${match.id}-extraTimeOrPenalties`)?.checked || false
    }, results);
    setScoringIndicator(indicatorId, pointsState(points), points > 0 ? "Scored" : "Wrong", points);
  });
}

saveFinalsPicksBtn?.addEventListener("click", async () => {
  if (!currentUser) return alert("Please sign in first.");
  if (allFinalsMatchesAreLocked()) return alert("All Finals picks are locked.");

  const existingSnap = await getOptionalDoc("finalsPicks", currentUser.uid);
  const picks = existingSnap?.exists() ? existingSnap.data().picks || {} : {};
  let savedAnyUnlockedMatch = false;

  for (const match of finalsMatches) {
    if (finalsMatchIsLocked(match)) continue;

    const winner = getValue(`finals-${match.id}-winner`);
    const score = getRound16ScoreFromInputs("finals", match.id);
    const extraTimeOrPenalties = document.getElementById(`finals-${match.id}-extraTimeOrPenalties`)?.checked || false;

    if (!winner) return alert(`Pick a winner for ${match.label}.`);
    if (![match.home, match.away].includes(winner)) return alert(`${match.label}: selected winner is not valid for this matchup.`);
    const scoreError = score === null ? `${match.label}: enter both score numbers.` : validateRound16Score(score, match.label);
    if (scoreError) return alert(scoreError);

    picks[match.id] = { winner, score, extraTimeOrPenalties };
    savedAnyUnlockedMatch = true;
  }

  if (!savedAnyUnlockedMatch) return alert("No unlocked Finals matches are available to save.");

  finalsPicksStatus.className = "status-message status-info";
  finalsPicksStatus.textContent = "Saving Finals picks...";
  saveFinalsPicksBtn.disabled = true;

  try {
    await setDoc(doc(db, "finalsPicks", currentUser.uid), {
      uid: currentUser.uid,
      email: currentUser.email,
      picks,
      scoring: { winner: 3, score: 2, scoreRequiresCorrectWinner: true, extraTimeOrPenaltiesCorrect: 1, extraTimeOrPenaltiesWrong: -1 },
      updatedAt: new Date().toISOString()
    }, { merge: true });

    finalsPicksStatus.className = "status-message status-success";
    finalsPicksStatus.textContent = "✅ Finals picks saved! Now select your Finals bonus answers below.";
    showSaveNotification("Finals picks saved!");
    await applyFinalsPickIndicators();
    finalsBonusSection?.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    console.error("Failed to save Finals picks:", error);
    finalsPicksStatus.className = "status-message status-error";
    finalsPicksStatus.textContent = "Finals picks were not saved. Check Firestore rules for finalsPicks.";
  } finally {
    if (!allFinalsMatchesAreLocked()) saveFinalsPicksBtn.disabled = false;
  }
});

function finalsBonusAnswersAreLocked() {
  return finalsMatchIsLocked(thirdPlaceMatch);
}

function finalsBonusAnswersAreRevealable() {
  return finalsBonusAnswersAreLocked();
}

function renderRatingOptions(name, labels = ["Bad", "Average", "Good", "Great"]) {
  return labels.map(label => `
    <label class="survey-option">
      <input type="radio" name="${escapeHTML(name)}" value="${escapeHTML(label)}" />
      <span>${escapeHTML(label)}</span>
    </label>
  `).join("");
}

function renderFinalsBonusQuestions() {
  if (!finalsBonusForm) return;

  finalsBonusForm.innerHTML = `
    <div class="pick-card finals-bonus-card finals-bonus-top-one">
      <label>1. How many combined shots on target will there be across both matches?</label>
      <p class="mini-note">Exact = 4 points. Within 2 = 2 points.</p>
      <input id="finals-bonus-combinedShotsOnTarget" type="number" min="0" />
      <p id="finals-bonus-combinedShotsOnTarget-result" class="answer-result"></p>
    </div>

    <div class="pick-card finals-bonus-card finals-bonus-top-two">
      <label>2. Which match will produce more total goals?</label>
      <p class="mini-note">Correct answer = 2 points.<br>Extra-time goals count, but shootout kicks do not.</p>
      <select id="finals-bonus-moreGoalsMatch">
        ${renderFinalsMatchOptions("Select answer")}
      </select>
      <p id="finals-bonus-moreGoalsMatch-result" class="answer-result"></p>
    </div>

    <div class="pick-card finals-bonus-card finals-bonus-bottom-one">
      <label>3. How many total yellow cards will be shown in the finals match?</label>
      <p class="mini-note">Exact = 4 points. Within 1 = 2 points.</p>
      <input id="finals-bonus-finalYellowCards" type="number" min="0" />
      <p id="finals-bonus-finalYellowCards-result" class="answer-result"></p>
    </div>

    <div class="pick-card finals-bonus-card finals-bonus-bottom-two">
      <label>4. Which team will record the most attempts at goal in the finals match?</label>
      <p class="mini-note">Correct answer = 2 points. No points if there’s a tie.<br>This includes regulation time and any extra time played, not shootout kicks.</p>
      <select id="finals-bonus-mostAttemptsTeam">
        <option value="">Select team</option>
        ${FINAL_TEAM_OPTIONS.map(team => `<option value="${escapeHTML(team)}">${escapeHTML(round32TeamLabel(team))}</option>`).join("")}
      </select>
      <p id="finals-bonus-mostAttemptsTeam-result" class="answer-result"></p>
    </div>

    <div class="pick-card finals-survey-card">
      <h3>Quick website survey</h3>
      <p class="mini-note">Not worth points. Click one rating for each category.</p>
      <label>Appearance</label>
      <div class="survey-option-grid">${renderRatingOptions("finals-survey-appearance")}</div>
      <label>Scoring</label>
      <div class="survey-option-grid">${renderRatingOptions("finals-survey-scoring")}</div>
      <label>Bonus questions quality</label>
      <div class="survey-option-grid">${renderRatingOptions("finals-survey-bonusQuality")}</div>
      <label>Bonus questions amount</label>
      <div class="survey-option-grid">${renderRatingOptions("finals-survey-bonusAmount", ["Not enough", "Just right", "Too many"])}</div>
      <label>Feedback and Improvements you want to see next time:</label>
      <textarea id="finals-survey-improvements" rows="5" placeholder="Optional"></textarea>
    </div>
  `;

  if (finalsBonusAnswersAreLocked()) {
    finalsBonusStatus.className = "status-message status-locked";
    finalsBonusStatus.textContent = "🔒 Finals bonus answers are locked.";
    saveFinalsBonusBtn.disabled = true;
    saveFinalsBonusBtn.textContent = "Finals Bonus Locked";
    finalsBonusForm.querySelectorAll("input, select, textarea").forEach(el => { el.disabled = true; });
  } else {
    finalsBonusStatus.className = "";
    saveFinalsBonusBtn.disabled = false;
    saveFinalsBonusBtn.textContent = "Save Finals Bonus Answers";
  }
}

function getSurveyRadioValue(name) {
  return document.querySelector(`input[name="${name}"]:checked`)?.value || "";
}

function setSurveyRadioValue(name, value) {
  if (!value) return;
  document.querySelectorAll(`input[name="${name}"]`).forEach(input => {
    input.checked = input.value === value;
  });
}

async function loadExistingFinalsBonusAnswers() {
  const snap = await getOptionalDoc("finalsBonusAnswers", currentUser.uid);
  if (!snap?.exists()) return;

  const answers = snap.data().answers || {};
  const survey = answers.survey || {};
  setValue("finals-bonus-combinedShotsOnTarget", answers.combinedShotsOnTarget);
  setValue("finals-bonus-moreGoalsMatch", answers.moreGoalsMatch);
  setValue("finals-bonus-finalYellowCards", answers.finalYellowCards);
  setValue("finals-bonus-mostAttemptsTeam", answers.mostAttemptsTeam);
  setSurveyRadioValue("finals-survey-appearance", survey.appearance);
  setSurveyRadioValue("finals-survey-scoring", survey.scoring);
  setSurveyRadioValue("finals-survey-bonusQuality", survey.bonusQuality);
  setSurveyRadioValue("finals-survey-bonusAmount", survey.bonusAmount);
  setValue("finals-survey-improvements", survey.improvements);

  if (!finalsBonusAnswersAreLocked()) {
    finalsBonusStatus.className = "status-message status-info";
    finalsBonusStatus.textContent = "Loaded saved Finals bonus answers.";
  }

  await applyFinalsBonusIndicators();
}

async function applyFinalsBonusIndicators() {
  [
    "finals-bonus-combinedShotsOnTarget-result",
    "finals-bonus-moreGoalsMatch-result",
    "finals-bonus-finalYellowCards-result",
    "finals-bonus-mostAttemptsTeam-result"
  ].forEach(clearScoringIndicator);

  const snap = await getOptionalDoc("finalsBonusResults", "official");
  if (!snap?.exists()) return;

  const results = snap.data().results || {};
  if (!finalsBonusKeyIsComplete(results)) return;

  const details = finalsBonusPointDetailsFor({
    combinedShotsOnTarget: getValue("finals-bonus-combinedShotsOnTarget"),
    moreGoalsMatch: getValue("finals-bonus-moreGoalsMatch"),
    finalYellowCards: getValue("finals-bonus-finalYellowCards"),
    mostAttemptsTeam: getValue("finals-bonus-mostAttemptsTeam")
  }, results);

  setScoringIndicator("finals-bonus-combinedShotsOnTarget-result", partialOrCorrectState(details.combinedShotsOnTarget, 4), pointDetailLabel(details.combinedShotsOnTarget), details.combinedShotsOnTarget);
  setScoringIndicator("finals-bonus-moreGoalsMatch-result", pointsState(details.moreGoalsMatch), details.moreGoalsMatch ? "Correct" : "Wrong", details.moreGoalsMatch);
  setScoringIndicator("finals-bonus-finalYellowCards-result", partialOrCorrectState(details.finalYellowCards, 4), pointDetailLabel(details.finalYellowCards), details.finalYellowCards);
  setScoringIndicator("finals-bonus-mostAttemptsTeam-result", pointsState(details.mostAttemptsTeam), details.mostAttemptsTeam ? "Correct" : "Wrong", details.mostAttemptsTeam);
}

saveFinalsBonusBtn?.addEventListener("click", async () => {
  if (!currentUser) return alert("Please sign in first.");
  if (finalsBonusAnswersAreLocked()) return alert("Finals bonus answers are locked.");

  const survey = {
    appearance: getSurveyRadioValue("finals-survey-appearance"),
    scoring: getSurveyRadioValue("finals-survey-scoring"),
    bonusQuality: getSurveyRadioValue("finals-survey-bonusQuality"),
    bonusAmount: getSurveyRadioValue("finals-survey-bonusAmount"),
    improvements: document.getElementById("finals-survey-improvements")?.value || ""
  };

  const answers = {
    combinedShotsOnTarget: getValue("finals-bonus-combinedShotsOnTarget"),
    moreGoalsMatch: getValue("finals-bonus-moreGoalsMatch"),
    finalYellowCards: getValue("finals-bonus-finalYellowCards"),
    mostAttemptsTeam: getValue("finals-bonus-mostAttemptsTeam"),
    survey
  };

  if (answers.combinedShotsOnTarget === "") return alert("Enter combined shots on target.");
  if (!answers.moreGoalsMatch) return alert("Select which match will produce more goals.");
  if (answers.finalYellowCards === "") return alert("Enter Final yellow cards.");
  if (!answers.mostAttemptsTeam) return alert("Select the team with most attempts at goal.");
  if (!survey.appearance || !survey.scoring || !survey.bonusQuality || !survey.bonusAmount) {
    return alert("Select one survey answer for each category.");
  }

  finalsBonusStatus.className = "status-message status-info";
  finalsBonusStatus.textContent = "Saving Finals bonus answers...";
  saveFinalsBonusBtn.disabled = true;

  try {
    await setDoc(doc(db, "finalsBonusAnswers", currentUser.uid), {
      uid: currentUser.uid,
      email: currentUser.email,
      answers,
      scoring: { combinedShotsOnTarget: "4 exact / 2 within 2", moreGoalsMatch: 2, finalYellowCards: "4 exact / 2 within 1", mostAttemptsTeam: 2 },
      updatedAt: new Date().toISOString()
    }, { merge: true });

    finalsBonusStatus.className = "status-message status-success";
    finalsBonusStatus.textContent = "✅ Finals bonus answers saved!";
    showSaveNotification("Finals bonus answers saved!");
    await applyFinalsBonusIndicators();
    if (currentUserIsAdmin()) await renderAdminFinalsSurveySummary();
    await renderLeaderboardFromFirestore();
  } catch (error) {
    console.error("Failed to save Finals bonus answers:", error);
    finalsBonusStatus.className = "status-message status-error";
    finalsBonusStatus.textContent = "Finals bonus answers were not saved. Check Firestore rules for finalsBonusAnswers.";
  } finally {
    if (!finalsBonusAnswersAreLocked()) saveFinalsBonusBtn.disabled = false;
  }
});

function renderAdminFinalsResults() {
  if (!adminFinalsResultsForm) return;

  adminFinalsResultsForm.innerHTML = "";
  finalsMatches.forEach(match => {
    const wrapper = document.createElement("div");
    wrapper.className = "pick-card";
    wrapper.innerHTML = `
      <h3>${escapeHTML(match.label)}: ${escapeHTML(finalsMatchupLabel(match))} Official Result</h3>
      <label>Winner</label>
      <select id="result-finals-${match.id}-winner">${renderFinalsWinnerOptions(match)}</select>
      <label>Final score</label>
      <div class="score-entry-row" aria-label="Official final score">
        <input id="result-finals-${match.id}-winnerGoals" class="score-number-input" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" data-score-number />
        <span class="score-entry-dash">-</span>
        <input id="result-finals-${match.id}-otherGoals" class="score-number-input" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" data-score-number />
      </div>
      <p class="mini-note">Final score includes extra time, not shootout penalties. Put the winner's score first; use 1-1 for matches tied after extra time.</p>
      <label class="checkbox-row">
        <input type="checkbox" id="result-finals-${match.id}-extraTimeOrPenalties" />
        Went to extra time or penalties
      </label>
    `;
    adminFinalsResultsForm.appendChild(wrapper);
  });

  setupNumericScoreInputs(adminFinalsResultsForm);
}

async function loadExistingFinalsResults() {
  const snap = await getOptionalDoc("finalsResults", "official");
  if (!snap?.exists()) return;

  Object.entries(snap.data().results || {}).forEach(([matchId, result]) => {
    setValue(`result-finals-${matchId}-winner`, result.winner);
    setRound16ScoreInputs("result-finals", matchId, result.score);
    const extraTimeOrPenalties = document.getElementById(`result-finals-${matchId}-extraTimeOrPenalties`);
    if (extraTimeOrPenalties) extraTimeOrPenalties.checked = !!result.extraTimeOrPenalties;
  });
}

saveFinalsResultsBtn?.addEventListener("click", async () => {
  const results = {};
  for (const match of finalsMatches) {
    const winner = getValue(`result-finals-${match.id}-winner`);
    const score = getRound16ScoreFromInputs("result-finals", match.id);
    const extraTimeOrPenalties = document.getElementById(`result-finals-${match.id}-extraTimeOrPenalties`)?.checked || false;

    if (winner) {
      if (![match.home, match.away].includes(winner)) return alert(`${match.label}: selected winner is not valid for this matchup.`);
      const scoreError = score === null ? `${match.label}: enter both score numbers.` : validateRound16Score(score, match.label);
      if (scoreError) return alert(scoreError);
    } else if (score !== "") {
      return alert(`${match.label}: select a winner before entering a score.`);
    }
    results[match.id] = { winner, score, extraTimeOrPenalties, participants: [match.home, match.away] };
  }

  finalsResultsStatus.className = "status-message status-info";
  finalsResultsStatus.textContent = "Saving Finals results...";
  saveFinalsResultsBtn.disabled = true;
  try {
    await setDoc(doc(db, "finalsResults", "official"), {
      results,
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser.email
    }, { merge: true });
    finalsResultsStatus.className = "status-message status-success";
    finalsResultsStatus.textContent = "✅ Finals results saved!";
    showSaveNotification("Finals results saved!");
    await renderFinalsPicks();
    await loadExistingFinalsPicks();
    await renderLeaderboardFromFirestore();
  } catch (error) {
    console.error("Failed to save Finals results:", error);
    finalsResultsStatus.className = "status-message status-error";
    finalsResultsStatus.textContent = "Finals results were not saved. Check Firestore rules for finalsResults.";
  } finally {
    saveFinalsResultsBtn.disabled = false;
  }
});

function renderAdminFinalsBonusResults() {
  if (!adminFinalsBonusResultsForm) return;

  adminFinalsBonusResultsForm.innerHTML = `
    <div class="pick-card">
      <label>1. How many combined shots on target will there be across both matches?</label>
      <p class="mini-note">Exact = 4 points. Within 2 = 2 points.</p>
      <input id="result-finals-bonus-combinedShotsOnTarget" type="number" min="0" />
    </div>
    <div class="pick-card">
      <label>2. Which match will produce more total goals?</label>
      <p class="mini-note">Correct answer = 2 points.<br>Extra-time goals count, but shootout kicks do not.</p>
      ${finalsMatches.map(match => `
        <label>${escapeHTML(match.label)} goals</label>
        <input id="result-finals-bonus-${escapeHTML(match.id)}-goals" type="number" min="0" />
      `).join("")}
      <p id="result-finals-bonus-moreGoalsMatch-summary" class="answer-result answer-result-pending">Enter both goal totals to calculate the correct answer.</p>
    </div>
    <div class="pick-card">
      <label>3. How many total yellow cards will be shown in the finals match?</label>
      <p class="mini-note">Exact = 4 points. Within 1 = 2 points.</p>
      <input id="result-finals-bonus-finalYellowCards" type="number" min="0" />
    </div>
    <div class="pick-card">
      <label>4. Which team will record the most attempts at goal in the finals match?</label>
      <p class="mini-note">Correct answer = 2 points. No points if there’s a tie.<br>This includes regulation time and any extra time played, not shootout kicks.</p>
      ${FINAL_TEAM_OPTIONS.map(team => `
        <label>${escapeHTML(round32TeamLabel(team))} attempts</label>
        <input id="result-finals-bonus-${escapeHTML(team)}-attempts" type="number" min="0" />
      `).join("")}
      <p id="result-finals-bonus-mostAttemptsTeam-summary" class="answer-result answer-result-pending">Enter both attempts totals to calculate the correct answer.</p>
    </div>
    <div class="pick-card admin-semifinal-answer-key-box finals-answer-key-box">
      <h3>Finals Bonus Correct Answers</h3>
      <p class="mini-note">Use this as the final answer key after entering the stat totals above.</p>
      <div id="adminFinalsBonusFinalAnswers" class="admin-final-answer-list"></div>
    </div>
  `;

  adminFinalsBonusResultsForm.querySelectorAll("input").forEach(input => {
    input.addEventListener("input", updateAdminFinalsBonusSummaries);
  });
  updateAdminFinalsBonusSummaries();
}

function readAdminFinalsBonusResults({ requireComplete = false } = {}) {
  const numberValue = (id, label) => {
    const raw = getValue(id);
    if (raw === "") return requireComplete ? { error: `Enter ${label}.` } : { value: null };
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 0) return { error: `${label} must be a whole number of 0 or more.` };
    return { value };
  };

  const combined = numberValue("result-finals-bonus-combinedShotsOnTarget", "combined shots on target");
  if (combined.error) return { error: combined.error };
  const finalYellowCards = numberValue("result-finals-bonus-finalYellowCards", "Final yellow cards");
  if (finalYellowCards.error) return { error: finalYellowCards.error };

  const goalsByMatch = {};
  for (const match of finalsMatches) {
    const result = numberValue(`result-finals-bonus-${match.id}-goals`, `${match.label} goals`);
    if (result.error) return { error: result.error };
    if (result.value != null) goalsByMatch[match.id] = result.value;
  }

  const attemptsByTeam = {};
  for (const team of FINAL_TEAM_OPTIONS) {
    const result = numberValue(`result-finals-bonus-${team}-attempts`, `${team} attempts`);
    if (result.error) return { error: result.error };
    if (result.value != null) attemptsByTeam[team] = result.value;
  }

  const results = {
    combinedShotsOnTarget: combined.value,
    finalYellowCards: finalYellowCards.value,
    goalsByMatch,
    attemptsByTeam,
    moreGoalsMatch: deriveFinalsMoreGoalsMatch(goalsByMatch),
    mostAttemptsTeams: deriveFinalsMostAttemptsTeams(attemptsByTeam)
  };

  return { results };
}

function deriveFinalsMoreGoalsMatch(goalsByMatch = {}) {
  const thirdPlaceGoals = goalsByMatch[thirdPlaceMatch.id];
  const finalGoals = goalsByMatch[finalMatch.id];
  if (!Number.isInteger(thirdPlaceGoals) || !Number.isInteger(finalGoals)) return "";
  if (thirdPlaceGoals === finalGoals) return "same";
  return thirdPlaceGoals > finalGoals ? thirdPlaceMatch.id : finalMatch.id;
}

function deriveFinalsMostAttemptsTeams(attemptsByTeam = {}) {
  const entries = FINAL_TEAM_OPTIONS.map(team => ({ team, value: attemptsByTeam[team] }));
  if (entries.some(entry => !Number.isInteger(entry.value))) return [];
  const maxValue = Math.max(...entries.map(entry => entry.value));
  const leaders = entries.filter(entry => entry.value === maxValue);
  return leaders.length > 1 ? ["tie"] : leaders.map(entry => entry.team);
}

function finalsMatchAnswerLabel(matchId) {
  if (matchId === "same") return "Same number for both matches";
  if (matchId === thirdPlaceMatch.id) return "Third-place match";
  if (matchId === finalMatch.id) return "World Cup final";
  const match = finalsMatches.find(item => item.id === matchId);
  return match ? match.label : "";
}

function updateAdminFinalsBonusSummaries() {
  const { results, error } = readAdminFinalsBonusResults();
  if (error) return;

  const moreGoalsEl = document.getElementById("result-finals-bonus-moreGoalsMatch-summary");
  if (moreGoalsEl) {
    const answer = finalsMatchAnswerLabel(results?.moreGoalsMatch);
    moreGoalsEl.className = answer ? "answer-result answer-result-correct" : "answer-result answer-result-pending";
    moreGoalsEl.textContent = answer ? `Correct answer: ${answer}` : "Enter both goal totals to calculate the correct answer.";
  }

  const attemptsEl = document.getElementById("result-finals-bonus-mostAttemptsTeam-summary");
  if (attemptsEl) {
    const teams = (results?.mostAttemptsTeams || []).includes("tie")
      ? "Tie / no points"
      : (results?.mostAttemptsTeams || []).map(round32TeamLabel).join(", ");
    attemptsEl.className = teams ? "answer-result answer-result-correct" : "answer-result answer-result-pending";
    attemptsEl.textContent = teams ? `Correct answer: ${teams}` : "Enter both attempts totals to calculate the correct answer.";
  }

  renderAdminFinalsBonusFinalAnswers([
    ["How many combined shots on target will there be across both matches?", results?.combinedShotsOnTarget == null ? "" : `${results.combinedShotsOnTarget}`],
    ["Which match will produce more total goals?", results?.moreGoalsMatch ? finalsMatchAnswerLabel(results.moreGoalsMatch) : ""],
    ["How many total yellow cards will be shown in the finals match?", results?.finalYellowCards == null ? "" : `${results.finalYellowCards}`],
    [
      "Which team will record the most attempts at goal in the finals match?",
      (results?.mostAttemptsTeams || []).includes("tie")
        ? "Tie / no points"
        : (results?.mostAttemptsTeams || []).map(round32TeamLabel).join(", ")
    ]
  ]);
}

function renderAdminFinalsBonusFinalAnswers(answerRows = []) {
  const box = document.getElementById("adminFinalsBonusFinalAnswers");
  if (!box) return;

  const hasAllAnswers = answerRows.every(([, answer]) => !!answer);
  if (!hasAllAnswers) {
    box.innerHTML = `<p class="answer-result answer-result-pending">Enter all stat totals to calculate every correct answer.</p>`;
    return;
  }

  box.innerHTML = `
    <div class="admin-final-answer-grid">
      ${answerRows.map(([label, answer], index) => `
        <div class="admin-final-answer-row">
          <span>${index + 1}. ${escapeHTML(label)}</span>
          <strong>${escapeHTML(answer)}</strong>
        </div>
      `).join("")}
    </div>
  `;
}

async function loadExistingFinalsBonusResults() {
  const snap = await getOptionalDoc("finalsBonusResults", "official");
  if (!snap?.exists()) return;

  const results = snap.data().results || {};
  setValue("result-finals-bonus-combinedShotsOnTarget", results.combinedShotsOnTarget);
  setValue("result-finals-bonus-finalYellowCards", results.finalYellowCards);
  finalsMatches.forEach(match => setValue(`result-finals-bonus-${match.id}-goals`, results.goalsByMatch?.[match.id]));
  FINAL_TEAM_OPTIONS.forEach(team => setValue(`result-finals-bonus-${team}-attempts`, results.attemptsByTeam?.[team]));
  updateAdminFinalsBonusSummaries();
}

saveFinalsBonusResultsBtn?.addEventListener("click", async () => {
  const { results, error } = readAdminFinalsBonusResults({ requireComplete: true });
  if (error) return alert(error);
  if (!results.moreGoalsMatch) return alert("Enter both match goal totals.");
  if (!results.mostAttemptsTeams.length) return alert("Enter both team attempts totals.");

  finalsBonusResultsStatus.className = "status-message status-info";
  finalsBonusResultsStatus.textContent = "Saving Finals bonus answer key...";
  saveFinalsBonusResultsBtn.disabled = true;
  try {
    await setDoc(doc(db, "finalsBonusResults", "official"), {
      results,
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser.email
    }, { merge: true });
    finalsBonusResultsStatus.className = "status-message status-success";
    finalsBonusResultsStatus.textContent = "✅ Finals bonus answer key saved!";
    showSaveNotification("Finals bonus key saved!");
    updateAdminFinalsBonusSummaries();
    await applyFinalsBonusIndicators();
    await renderLeaderboardFromFirestore();
  } catch (error) {
    console.error("Failed to save Finals bonus answer key:", error);
    finalsBonusResultsStatus.className = "status-message status-error";
    finalsBonusResultsStatus.textContent = "Finals bonus answer key was not saved. Check Firestore rules for finalsBonusResults.";
  } finally {
    saveFinalsBonusResultsBtn.disabled = false;
  }
});

function finalsBonusKeyIsComplete(results = {}) {
  return Number.isInteger(Number(results.combinedShotsOnTarget)) &&
    !!results.moreGoalsMatch &&
    Number.isInteger(Number(results.finalYellowCards)) &&
    Array.isArray(results.mostAttemptsTeams) &&
    results.mostAttemptsTeams.length > 0;
}

function scoreExactOrWithin(answer, result, exactPoints, withinDistance, withinPoints) {
  if (answer === "" || answer == null || result === "" || result == null) return 0;
  const guess = Number(answer);
  const actual = Number(result);
  if (Number.isNaN(guess) || Number.isNaN(actual)) return 0;
  if (guess === actual) return exactPoints;
  if (Math.abs(guess - actual) <= withinDistance) return withinPoints;
  return 0;
}

function finalsBonusCorrectAnswersFor(results = {}) {
  if (!finalsBonusKeyIsComplete(results)) return {};
  return {
    combinedShotsOnTarget: String(results.combinedShotsOnTarget),
    moreGoalsMatch: finalsMatchAnswerLabel(results.moreGoalsMatch),
    finalYellowCards: String(results.finalYellowCards),
    mostAttemptsTeam: results.mostAttemptsTeams.includes("tie") ? "Tie / no points" : results.mostAttemptsTeams.map(team => {
      const attempts = results.attemptsByTeam?.[team];
      return formatCorrectAnswerWithDetail(round32TeamLabel(team), attempts == null ? "" : `${attempts} attempt(s)`);
    })
  };
}

function finalsBonusPointDetailsFor(answers = {}, results = {}) {
  const correctAnswers = finalsBonusCorrectAnswersFor(results);
  if (!finalsBonusKeyIsComplete(results)) {
    return { combinedShotsOnTarget: null, moreGoalsMatch: null, finalYellowCards: null, mostAttemptsTeam: null, correctAnswers };
  }
  return {
    combinedShotsOnTarget: scoreExactOrWithin(answers.combinedShotsOnTarget, results.combinedShotsOnTarget, 4, 2, 2),
    moreGoalsMatch: answers.moreGoalsMatch && results.moreGoalsMatch !== "same" && answers.moreGoalsMatch === results.moreGoalsMatch ? 2 : 0,
    finalYellowCards: scoreExactOrWithin(answers.finalYellowCards, results.finalYellowCards, 4, 1, 2),
    mostAttemptsTeam: answers.mostAttemptsTeam && !results.mostAttemptsTeams.includes("tie") && results.mostAttemptsTeams.some(team => sameCountryOption(answers.mostAttemptsTeam, team)) ? 2 : 0,
    correctAnswers
  };
}

function scoreFinalsBonusAnswers(answers, results) {
  const details = finalsBonusPointDetailsFor(answers, results);
  return ["combinedShotsOnTarget", "moreGoalsMatch", "finalYellowCards", "mostAttemptsTeam"]
    .reduce((total, key) => total + Number(details[key] || 0), 0);
}

function scoreFinalsPicks(picks, results) {
  return scoreRound16Picks(picks, results);
}

function finalsPickPointsFor(matchId, pick, results = {}) {
  return round16PickPointsFor(matchId, pick, results);
}

async function renderAdminFinalsSurveySummary() {
  if (!adminFinalsSurveySummary) return;

  const [snap, usersSnap] = await Promise.all([
    getOptionalCollectionDocs("finalsBonusAnswers"),
    getDocs(collection(db, "users"))
  ]);
  const usersByUid = {};
  usersSnap.forEach(docSnap => {
    const user = docSnap.data();
    const uid = user.uid || docSnap.id;
    usersByUid[uid] = user.username || user.googleDisplayName || user.email || "Player";
  });

  const rows = [];
  snap.forEach(docSnap => {
    const data = docSnap.data();
    const uid = data.uid || docSnap.id;
    rows.push({
      uid,
      displayName: usersByUid[uid] || data.displayName || data.email || uid,
      survey: data.answers?.survey || {}
    });
  });

  const countBy = key => rows.reduce((acc, row) => {
    const value = row.survey[key] || "No answer";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
  const renderCounts = (title, counts, labels) => {
    const total = labels.reduce((sum, label) => sum + Number(counts[label] || 0), 0);

    return `
      <div class="survey-summary-card">
        <h4>${escapeHTML(title)}</h4>
        <div class="survey-bar-list">
          ${labels.map(label => {
            const count = Number(counts[label] || 0);
            const percent = total ? Math.round((count / total) * 100) : 0;

            return `
              <div class="survey-bar-row">
                <div class="survey-bar-meta">
                  <span>${escapeHTML(label)}</span>
                  <strong>${count}</strong>
                </div>
                <div class="survey-bar-track" aria-label="${escapeHTML(`${label}: ${count}`)}">
                  <div class="survey-bar-fill" style="width:${percent}%"></div>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
  };
  const noCommentHtml = '<span class="mini-note">No comment.</span>';
  const emptyResponsesHtml = '<p class="mini-note">No Finals survey responses yet.</p>';
  const responseRowsHtml = rows.map(row => {
    const improvementsHtml = row.survey.improvements
      ? escapeHTML(row.survey.improvements)
      : noCommentHtml;

    return `
      <div class="admin-survey-response">
        <strong>${escapeHTML(row.displayName || row.uid)}</strong>
        <p>Appearance: ${escapeHTML(row.survey.appearance || "No answer")} · Scoring: ${escapeHTML(row.survey.scoring || "No answer")} · Bonus quality: ${escapeHTML(row.survey.bonusQuality || "No answer")} · Bonus amount: ${escapeHTML(row.survey.bonusAmount || "No answer")}</p>
        <p><strong>Improvements:</strong> ${improvementsHtml}</p>
      </div>
    `;
  }).join("");

  adminFinalsSurveySummary.innerHTML = `
    <div class="survey-summary-grid">
      ${renderCounts("Appearance", countBy("appearance"), ["Bad", "Average", "Good", "Great"])}
      ${renderCounts("Scoring", countBy("scoring"), ["Bad", "Average", "Good", "Great"])}
      ${renderCounts("Bonus quality", countBy("bonusQuality"), ["Bad", "Average", "Good", "Great"])}
      ${renderCounts("Bonus amount", countBy("bonusAmount"), ["Not enough", "Just right", "Too many"])}
    </div>
    <h4>User responses</h4>
    <div class="admin-survey-response-list">
      ${responseRowsHtml || emptyResponsesHtml}
    </div>
  `;
}

function renderAdminSemifinalResults() {
  if (!adminSemifinalResultsForm) return;

  adminSemifinalResultsForm.innerHTML = "";

  semifinalMatches.forEach(match => {
    const wrapper = document.createElement("div");
    wrapper.className = "pick-card";

    wrapper.innerHTML = `
      <h3>${escapeHTML(semifinalMatchupLabel(match))} Official Result</h3>

      <label>Winner</label>
      <select id="result-semifinal-${match.id}-winner">
        ${renderSemifinalWinnerOptions(match)}
      </select>

      <label>Final score</label>
      <div class="score-entry-row" aria-label="Official final score">
        <input
          id="result-semifinal-${match.id}-winnerGoals"
          class="score-number-input"
          type="text"
          inputmode="numeric"
          pattern="[0-9]*"
          autocomplete="off"
          enterkeyhint="next"
          data-score-number
          aria-label="Official winner final goals"
        />
        <span class="score-entry-dash">-</span>
        <input
          id="result-semifinal-${match.id}-otherGoals"
          class="score-number-input"
          type="text"
          inputmode="numeric"
          pattern="[0-9]*"
          autocomplete="off"
          enterkeyhint="done"
          data-score-number
          aria-label="Official opponent final goals"
        />
      </div>
      <p class="mini-note">Final score includes extra time, not shootout penalties. Put the winner's score first; use 1-1 for matches tied after extra time.</p>

      <label class="checkbox-row">
        <input type="checkbox" id="result-semifinal-${match.id}-extraTimeOrPenalties" />
        Went to extra time or penalties
      </label>
    `;

    adminSemifinalResultsForm.appendChild(wrapper);
  });

  setupNumericScoreInputs(adminSemifinalResultsForm);
}

async function loadExistingSemifinalResults() {
  const snap = await getOptionalDoc("semifinalResults", "official");
  if (!snap?.exists()) return;

  const results = snap.data().results || {};

  Object.entries(results).forEach(([matchId, result]) => {
    setValue(`result-semifinal-${matchId}-winner`, result.winner);
    setRound16ScoreInputs("result-semifinal", matchId, result.score);

    const extraTimeOrPenalties = document.getElementById(`result-semifinal-${matchId}-extraTimeOrPenalties`);
    if (extraTimeOrPenalties) {
      extraTimeOrPenalties.checked = !!result.extraTimeOrPenalties;
    }
  });
}

saveSemifinalResultsBtn?.addEventListener("click", async () => {
  const results = {};

  for (const match of semifinalMatches) {
    const winner = getValue(`result-semifinal-${match.id}-winner`);
    const score = getRound16ScoreFromInputs("result-semifinal", match.id);
    const extraTimeOrPenalties =
      document.getElementById(`result-semifinal-${match.id}-extraTimeOrPenalties`)?.checked || false;

    if (winner) {
      if (![match.home, match.away].includes(winner)) {
        return alert(`${match.label}: selected winner is not valid for this matchup.`);
      }

      const scoreError = score === null
        ? `${match.label}: enter both score numbers.`
        : validateRound16Score(score, match.label);
      if (scoreError) return alert(scoreError);
    } else if (score !== "") {
      return alert(`${match.label}: select a winner before entering a score.`);
    }

    results[match.id] = {
      winner,
      score,
      extraTimeOrPenalties,
      participants: [match.home, match.away]
    };
  }

  semifinalResultsStatus.className = "status-message status-info";
  semifinalResultsStatus.textContent = "Saving Semifinals results...";
  saveSemifinalResultsBtn.disabled = true;

  try {
    await setDoc(doc(db, "semifinalResults", "official"), {
      results,
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser.email
    }, { merge: true });

    semifinalResultsStatus.className = "status-message status-success";
    semifinalResultsStatus.textContent = "✅ Semifinals results saved!";
    showSaveNotification("Semifinals results saved!");
    await renderSemifinalPicks();
    await loadExistingSemifinalPicks();
    await renderLeaderboardFromFirestore();
  } catch (error) {
    console.error("Failed to save Semifinals results:", error);
    semifinalResultsStatus.className = "status-message status-error";
    semifinalResultsStatus.textContent =
      "Semifinals results were not saved. Check Firestore rules for semifinalResults.";
  } finally {
    saveSemifinalResultsBtn.disabled = false;
  }
});

function renderAdminSemifinalBonusResults() {
  if (!adminSemifinalBonusResultsForm) return;

  adminSemifinalBonusResultsForm.innerHTML = `
    <div class="pick-card">
      <label>1. Which semifinal had more total goals?</label>
      <p class="mini-note">Worth 2 points. Higher match is correct; an unlucky tie awards 0 points.</p>
      ${renderAdminSemifinalMatchStatInputs("goals", "Total goals")}
      <p class="admin-derived-answer-label">Final answer key</p>
      <p id="result-semifinal-bonus-moreGoalsMatch-summary" class="answer-result"></p>
    </div>

    <div class="pick-card">
      <label>2. Which semifinal had more total corner kicks?</label>
      <p class="mini-note">Worth 2 points. Higher match is correct; an unlucky tie awards 0 points.</p>
      ${renderAdminSemifinalMatchStatInputs("cornerKicks", "Corner kicks")}
      <p class="admin-derived-answer-label">Final answer key</p>
      <p id="result-semifinal-bonus-moreCornerKicksMatch-summary" class="answer-result"></p>
    </div>

    <div class="pick-card">
      <label>3. Team(s) with the most shots on target</label>
      <p class="mini-note">Worth 2 points. Highest team is correct; tied highest teams all earn points.</p>
      ${renderAdminSemifinalTeamStatInputs("shotsOnTarget", "Shots on target")}
      <p class="admin-derived-answer-label">Final answer key</p>
      <p id="result-semifinal-bonus-mostShotsOnTargetTeam-summary" class="answer-result"></p>
    </div>

    <div class="pick-card">
      <label>4. Team(s) with the most yellow cards</label>
      <p class="mini-note">Worth 2 points. Highest team is correct; tied highest teams all earn points.</p>
      ${renderAdminSemifinalTeamStatInputs("yellowCards", "Yellow cards")}
      <p class="admin-derived-answer-label">Final answer key</p>
      <p id="result-semifinal-bonus-mostYellowCardsTeam-summary" class="answer-result"></p>
    </div>

    <div class="pick-card">
      <label>5. Team(s) with the most completed passes</label>
      <p class="mini-note">Worth 2 points. Highest team is correct; tied highest teams all earn points.</p>
      ${renderAdminSemifinalTeamStatInputs("passes", "Completed passes")}
      <p class="admin-derived-answer-label">Final answer key</p>
      <p id="result-semifinal-bonus-mostPassesTeam-summary" class="answer-result"></p>
    </div>

    <div class="admin-semifinal-answer-key-box">
      <h3>All Correct Semifinal Bonus Answers</h3>
      <p class="mini-note">This updates automatically after all stat totals are entered.</p>
      <div id="adminSemifinalBonusFinalAnswers" class="admin-final-answer-list"></div>
    </div>
  `;

  bindAdminSemifinalBonusStatPreview();
  updateAdminSemifinalBonusSummaries({});
}

function renderAdminSemifinalMatchStatInputs(statKey, label) {
  return `
    <div class="admin-stat-grid">
      ${semifinalMatches.map(match => `
        <label class="admin-stat-row">
          <span>${escapeHTML(semifinalMatchupLabel(match))}</span>
          <input
            id="result-semifinal-bonus-${escapeHTML(match.id)}-${escapeHTML(statKey)}"
            type="number"
            min="0"
            step="1"
            inputmode="numeric"
            data-semifinal-bonus-match-stat="${escapeHTML(match.id)}"
            data-stat-key="${escapeHTML(statKey)}"
            data-stat-label="${escapeHTML(label)} for ${escapeHTML(semifinalMatchupLabel(match))}"
          />
        </label>
      `).join("")}
    </div>
  `;
}

function renderAdminSemifinalTeamStatInputs(statKey, label) {
  return `
    <div class="admin-stat-grid">
      ${SEMIFINAL_TEAM_OPTIONS.map(team => `
        <label class="admin-stat-row">
          <span>${escapeHTML(round32TeamLabel(team))}</span>
          <input
            id="result-semifinal-bonus-${escapeHTML(cleanCountryName(team).replace(/\s+/g, "-"))}-${escapeHTML(statKey)}"
            type="number"
            min="0"
            step="1"
            inputmode="numeric"
            data-semifinal-bonus-team-stat="${escapeHTML(team)}"
            data-stat-key="${escapeHTML(statKey)}"
            data-stat-label="${escapeHTML(label)} for ${escapeHTML(round32TeamLabel(team))}"
          />
        </label>
      `).join("")}
    </div>
  `;
}

async function loadExistingSemifinalBonusResults() {
  const snap = await getOptionalDoc("semifinalBonusResults", "official");
  if (!snap?.exists()) return;

  const results = snap.data().results || {};
  const matchStats = results.matchStats || {};
  const teamStats = results.teamStats || {};

  semifinalMatches.forEach(match => {
    ["goals", "cornerKicks"].forEach(statKey => {
      setValue(`result-semifinal-bonus-${match.id}-${statKey}`, matchStats[match.id]?.[statKey]);
    });
  });

  SEMIFINAL_TEAM_OPTIONS.forEach(team => {
    const teamId = cleanCountryName(team).replace(/\s+/g, "-");
    ["shotsOnTarget", "yellowCards", "passes"].forEach(statKey => {
      setValue(`result-semifinal-bonus-${teamId}-${statKey}`, teamStats[team]?.[statKey]);
    });
  });

  updateAdminSemifinalBonusSummaries(getSemifinalBonusScoringKey(results));
}

function getCheckedDatasetValues(root, selector, datasetKey) {
  return Array.from(root?.querySelectorAll(`${selector}:checked`) || [])
    .map(input => input.dataset[datasetKey])
    .filter(Boolean);
}

function setCheckedTeams(root, selector, datasetKey, teams = []) {
  const selectedTeams = Array.isArray(teams) ? teams : [];
  root?.querySelectorAll(selector).forEach(input => {
    input.checked = selectedTeams.some(team => sameCountryOption(team, input.dataset[datasetKey]));
  });
}

function readAdminSemifinalBonusStats({ requireComplete = false } = {}) {
  const matchStats = Object.fromEntries(semifinalMatches.map(match => [match.id, {}]));
  const teamStats = Object.fromEntries(SEMIFINAL_TEAM_OPTIONS.map(team => [team, {}]));

  const readInput = input => {
    const rawValue = String(input.value || "").trim();
    const label = input.dataset.statLabel || "this stat";

    if (rawValue === "") {
      return requireComplete ? { error: `Enter ${label}.` } : { value: null };
    }

    const value = Number(rawValue);
    if (!Number.isInteger(value) || value < 0) {
      return { error: `${label} must be a whole number of 0 or more.` };
    }

    return { value };
  };

  for (const input of adminSemifinalBonusResultsForm?.querySelectorAll("[data-semifinal-bonus-match-stat]") || []) {
    const { error, value } = readInput(input);
    if (error) return { error };
    if (value == null) continue;

    const matchId = input.dataset.semifinalBonusMatchStat;
    const statKey = input.dataset.statKey;
    if (matchStats[matchId]) matchStats[matchId][statKey] = value;
  }

  for (const input of adminSemifinalBonusResultsForm?.querySelectorAll("[data-semifinal-bonus-team-stat]") || []) {
    const { error, value } = readInput(input);
    if (error) return { error };
    if (value == null) continue;

    const team = input.dataset.semifinalBonusTeamStat;
    const statKey = input.dataset.statKey;
    if (teamStats[team]) teamStats[team][statKey] = value;
  }

  return { matchStats, teamStats };
}

function semifinalBonusStatsAreComplete(matchStats = {}, teamStats = {}) {
  return semifinalMatches.every(match =>
    ["goals", "cornerKicks"].every(statKey => Number.isInteger(matchStats[match.id]?.[statKey]))
  ) && SEMIFINAL_TEAM_OPTIONS.every(team =>
    ["shotsOnTarget", "yellowCards", "passes"].every(statKey => Number.isInteger(teamStats[team]?.[statKey]))
  );
}

function highestSemifinalMatchStat(matchStats = {}, statKey) {
  const entries = semifinalMatches.map(match => ({
    id: match.id,
    value: matchStats[match.id]?.[statKey]
  }));
  if (entries.some(entry => !Number.isInteger(entry.value))) return "";

  const maxValue = Math.max(...entries.map(entry => entry.value));
  const winners = entries.filter(entry => entry.value === maxValue);
  return winners.length === 1 ? winners[0].id : "tie";
}

function highestSemifinalTeamStats(teamStats = {}, statKey) {
  const entries = SEMIFINAL_TEAM_OPTIONS.map(team => ({
    team,
    value: teamStats[team]?.[statKey]
  }));
  if (entries.some(entry => !Number.isInteger(entry.value))) return [];

  const maxValue = Math.max(...entries.map(entry => entry.value));
  return entries
    .filter(entry => entry.value === maxValue)
    .map(entry => entry.team);
}

function deriveSemifinalBonusResultsFromStats(matchStats = {}, teamStats = {}) {
  return {
    moreGoalsMatch: highestSemifinalMatchStat(matchStats, "goals"),
    moreCornerKicksMatch: highestSemifinalMatchStat(matchStats, "cornerKicks"),
    mostShotsOnTargetTeams: highestSemifinalTeamStats(teamStats, "shotsOnTarget"),
    mostYellowCardsTeams: highestSemifinalTeamStats(teamStats, "yellowCards"),
    mostPassesTeams: highestSemifinalTeamStats(teamStats, "passes"),
    matchStats,
    teamStats
  };
}

function semifinalBonusDirectKeyIsComplete(key = {}) {
  return !!key.moreGoalsMatch &&
    !!key.moreCornerKicksMatch &&
    Array.isArray(key.mostShotsOnTargetTeams) &&
    key.mostShotsOnTargetTeams.length > 0 &&
    Array.isArray(key.mostYellowCardsTeams) &&
    key.mostYellowCardsTeams.length > 0 &&
    Array.isArray(key.mostPassesTeams) &&
    key.mostPassesTeams.length > 0;
}

function getSemifinalBonusScoringKey(results = {}) {
  if (semifinalBonusDirectKeyIsComplete(results)) {
    return {
      ...results,
      mostShotsOnTargetTeams: results.mostShotsOnTargetTeams || [],
      mostYellowCardsTeams: results.mostYellowCardsTeams || [],
      mostPassesTeams: results.mostPassesTeams || []
    };
  }

  if (semifinalBonusStatsAreComplete(results.matchStats, results.teamStats)) {
    return deriveSemifinalBonusResultsFromStats(results.matchStats, results.teamStats);
  }

  return {};
}

function bindAdminSemifinalBonusStatPreview() {
  adminSemifinalBonusResultsForm
    ?.querySelectorAll("[data-semifinal-bonus-match-stat], [data-semifinal-bonus-team-stat]")
    .forEach(input => {
      input.addEventListener("input", () => {
        const statResult = readAdminSemifinalBonusStats();
        if (statResult.error || !semifinalBonusStatsAreComplete(statResult.matchStats, statResult.teamStats)) {
          updateAdminSemifinalBonusSummaries({});
          return;
        }

        updateAdminSemifinalBonusSummaries(
          deriveSemifinalBonusResultsFromStats(statResult.matchStats, statResult.teamStats)
        );
      });
    });
}

function updateAdminSemifinalBonusSummaries(results = {}) {
  const key = getSemifinalBonusScoringKey(results);
  const setSummary = (id, text) => {
    const el = document.getElementById(id);
    if (!el) return;

    el.className = text ? "answer-result answer-result-correct" : "answer-result answer-result-pending";
    el.textContent = text ? `Correct answer: ${text}` : "Enter all stat totals to calculate the correct answer.";
  };

  const correctAnswers = semifinalBonusCorrectAnswersFor(key);
  const answerRows = [
    ["More total goals", renderPlainCorrectAnswer(correctAnswers.moreGoalsMatch)],
    ["More corner kicks", renderPlainCorrectAnswer(correctAnswers.moreCornerKicksMatch)],
    ["Most shots on target", renderPlainCorrectAnswer(correctAnswers.mostShotsOnTargetTeam)],
    ["Most yellow cards", renderPlainCorrectAnswer(correctAnswers.mostYellowCardsTeam)],
    ["Most completed passes", renderPlainCorrectAnswer(correctAnswers.mostPassesTeam)]
  ];

  setSummary("result-semifinal-bonus-moreGoalsMatch-summary", answerRows[0][1]);
  setSummary("result-semifinal-bonus-moreCornerKicksMatch-summary", answerRows[1][1]);
  setSummary("result-semifinal-bonus-mostShotsOnTargetTeam-summary", answerRows[2][1]);
  setSummary("result-semifinal-bonus-mostYellowCardsTeam-summary", answerRows[3][1]);
  setSummary("result-semifinal-bonus-mostPassesTeam-summary", answerRows[4][1]);
  renderAdminSemifinalBonusFinalAnswers(answerRows);
}

function renderPlainCorrectAnswer(value) {
  if (Array.isArray(value)) return value.join(", ");
  return value || "";
}

function renderAdminSemifinalBonusFinalAnswers(answerRows = []) {
  const box = document.getElementById("adminSemifinalBonusFinalAnswers");
  if (!box) return;

  const hasAllAnswers = answerRows.every(([, answer]) => !!answer);

  if (!hasAllAnswers) {
    box.innerHTML = `<p class="answer-result answer-result-pending">Enter all stat totals to calculate every correct answer.</p>`;
    return;
  }

  box.innerHTML = `
    <div class="admin-final-answer-grid">
      ${answerRows.map(([label, answer], index) => `
        <div class="admin-final-answer-row">
          <span>${index + 1}. ${escapeHTML(label)}</span>
          <strong>${escapeHTML(answer)}</strong>
        </div>
      `).join("")}
    </div>
  `;
}

saveSemifinalBonusResultsBtn?.addEventListener("click", async () => {
  const statResult = readAdminSemifinalBonusStats({ requireComplete: true });
  if (statResult.error) return alert(statResult.error);

  const results = deriveSemifinalBonusResultsFromStats(statResult.matchStats, statResult.teamStats);

  semifinalBonusResultsStatus.className = "status-message status-info";
  semifinalBonusResultsStatus.textContent = "Saving Semifinal bonus answer key...";
  saveSemifinalBonusResultsBtn.disabled = true;

  try {
    await setDoc(doc(db, "semifinalBonusResults", "official"), {
      results,
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser.email
    }, { merge: true });

    semifinalBonusResultsStatus.className = "status-message status-success";
    semifinalBonusResultsStatus.textContent = "✅ Semifinal bonus answer key saved!";
    showSaveNotification("Semifinal bonus key saved!");
    updateAdminSemifinalBonusSummaries(results);
    await applySemifinalBonusIndicators();
    await renderLeaderboardFromFirestore();
  } catch (error) {
    console.error("Failed to save Semifinal bonus answer key:", error);
    semifinalBonusResultsStatus.className = "status-message status-error";
    semifinalBonusResultsStatus.textContent =
      "Semifinal bonus answer key was not saved. Check Firestore rules for semifinalBonusResults.";
  } finally {
    saveSemifinalBonusResultsBtn.disabled = false;
  }
});

function scoreSemifinalPicks(picks, results) {
  return scoreRound16Picks(picks, results);
}

function semifinalPickPointsFor(matchId, pick, results = {}) {
  return round16PickPointsFor(matchId, pick, results);
}

function scoreSemifinalBonusAnswers(answers, results) {
  const key = getSemifinalBonusScoringKey(results);
  if (!answers || !semifinalBonusKeyIsComplete(key)) return 0;

  let points = 0;

  if (answers.moreGoalsMatch && key.moreGoalsMatch !== "tie" && answers.moreGoalsMatch === key.moreGoalsMatch) {
    points += SEMIFINAL_BONUS_POINTS;
  }

  if (answers.moreCornerKicksMatch && key.moreCornerKicksMatch !== "tie" && answers.moreCornerKicksMatch === key.moreCornerKicksMatch) {
    points += SEMIFINAL_BONUS_POINTS;
  }

  if (
    answers.mostShotsOnTargetTeam &&
    key.mostShotsOnTargetTeams.some(team => sameCountryOption(answers.mostShotsOnTargetTeam, team))
  ) {
    points += SEMIFINAL_BONUS_POINTS;
  }

  if (
    answers.mostYellowCardsTeam &&
    key.mostYellowCardsTeams.some(team => sameCountryOption(answers.mostYellowCardsTeam, team))
  ) {
    points += SEMIFINAL_BONUS_POINTS;
  }

  if (
    answers.mostPassesTeam &&
    key.mostPassesTeams.some(team => sameCountryOption(answers.mostPassesTeam, team))
  ) {
    points += SEMIFINAL_BONUS_POINTS;
  }

  return points;
}

function scoreQuarterfinalPicks(picks, results) {
  if (!picks || !results) return 0;

  let points = 0;

  Object.entries(picks).forEach(([matchId, pick]) => {
    const result = results[matchId];
    if (!pick || !result?.winner) return;

    const winnerCorrect = sameCountryOption(pick.winner, result.winner);
    if (winnerCorrect) {
      points += 3;
    }

    const pickScore = normalizeWinnerFirstScore(pick.score);
    const resultScore = normalizeWinnerFirstScore(result.score);
    if (
      winnerCorrect &&
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

function semifinalMatchupLabel(match) {
  return `${round32TeamLabel(match.home)} vs ${round32TeamLabel(match.away)}`;
}

function semifinalMatchIsLocked(match) {
  return new Date() >= new Date(match.startTime);
}

function semifinalPickIsRevealable(match) {
  return semifinalMatchIsLocked(match);
}

function allSemifinalMatchesAreLocked() {
  return semifinalMatches.every(match => semifinalMatchIsLocked(match));
}

function semifinalMatchTimeLabel(match) {
  return new Date(match.startTime).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short"
  });
}

function renderSemifinalWinnerOptions(match, placeholder = "Select winner") {
  return `
    <option value="">${escapeHTML(placeholder)}</option>
    <option value="${escapeHTML(match.home)}">${escapeHTML(round32TeamLabel(match.home))}</option>
    <option value="${escapeHTML(match.away)}">${escapeHTML(round32TeamLabel(match.away))}</option>
  `;
}

function renderSemifinalMatchOptions(placeholder = "Select semifinal") {
  return `
    <option value="">${escapeHTML(placeholder)}</option>
    ${semifinalMatches
      .map(match => `<option value="${escapeHTML(match.id)}">${escapeHTML(semifinalMatchupLabel(match))}</option>`)
      .join("")}
  `;
}

function renderSemifinalMatchOrTieOptions(placeholder = "Select semifinal") {
  return `
    ${renderSemifinalMatchOptions(placeholder)}
    <option value="tie">Tie / no points</option>
  `;
}

function renderSemifinalTeamOptions(placeholder = "Select team") {
  return `
    <option value="">${escapeHTML(placeholder)}</option>
    ${SEMIFINAL_TEAM_OPTIONS
      .map(team => `<option value="${escapeHTML(team)}">${escapeHTML(round32TeamLabel(team))}</option>`)
      .join("")}
  `;
}

function renderSemifinalPicks() {
  if (!semifinalPicksForm) return;

  semifinalPicksForm.innerHTML = "";

  semifinalMatches.forEach(match => {
    const locked = semifinalMatchIsLocked(match);
    const wrapper = document.createElement("div");
    wrapper.className = "pick-card";

    wrapper.innerHTML = `
      <h3>${escapeHTML(semifinalMatchupLabel(match))} ${locked ? "🔒" : ""}</h3>
      <p class="lock-note">Kickoff: <strong>${semifinalMatchTimeLabel(match)}</strong> · ${escapeHTML(match.venue)}</p>

      <label>Winner</label>
      <select id="semifinal-${match.id}-winner" ${locked ? "disabled" : ""}>
        ${renderSemifinalWinnerOptions(match)}
      </select>

      <label class="quarterfinal-score-label">Final score</label>
      <div class="score-entry-row" aria-label="Final score">
        <input
          id="semifinal-${match.id}-winnerGoals"
          class="score-number-input"
          type="text"
          inputmode="numeric"
          pattern="[0-9]*"
          autocomplete="off"
          enterkeyhint="next"
          data-score-number
          aria-label="Selected winner final goals"
          ${locked ? "disabled" : ""}
        />
        <span class="score-entry-dash">-</span>
        <input
          id="semifinal-${match.id}-otherGoals"
          class="score-number-input"
          type="text"
          inputmode="numeric"
          pattern="[0-9]*"
          autocomplete="off"
          enterkeyhint="done"
          data-score-number
          aria-label="Opponent final goals"
          ${locked ? "disabled" : ""}
        />
      </div>

      <label class="checkbox-row">
        <input type="checkbox" id="semifinal-${match.id}-extraTimeOrPenalties" ${locked ? "disabled" : ""} />
        Goes to extra time or penalties
      </label>
      <p id="semifinal-${match.id}-result" class="answer-result"></p>
    `;

    semifinalPicksForm.appendChild(wrapper);
  });

  setupNumericScoreInputs(semifinalPicksForm);

  if (allSemifinalMatchesAreLocked()) {
    semifinalPicksStatus.className = "status-message status-locked";
    semifinalPicksStatus.textContent = "🔒 All Semifinals picks are locked.";
    saveSemifinalPicksBtn.disabled = true;
    saveSemifinalPicksBtn.textContent = "Semifinals Picks Locked";
  } else {
    semifinalPicksStatus.className = "";
    saveSemifinalPicksBtn.disabled = false;
    saveSemifinalPicksBtn.textContent = "Save Semifinals Picks";
  }
}

async function loadExistingSemifinalPicks() {
  const snap = await getOptionalDoc("semifinalPicks", currentUser.uid);
  if (!snap?.exists()) return;

  const data = snap.data();

  Object.entries(data.picks || {}).forEach(([matchId, pick]) => {
    setValue(`semifinal-${matchId}-winner`, pick.winner);
    setRound16ScoreInputs("semifinal", matchId, pick.score);

    const extraTimeOrPenalties = document.getElementById(`semifinal-${matchId}-extraTimeOrPenalties`);
    if (extraTimeOrPenalties) {
      extraTimeOrPenalties.checked = !!pick.extraTimeOrPenalties;
    }
  });

  if (!allSemifinalMatchesAreLocked()) {
    semifinalPicksStatus.className = "status-message status-info";
    semifinalPicksStatus.textContent = "Loaded saved Semifinals picks.";
  }

  await applySemifinalPickIndicators();
}

async function applySemifinalPickIndicators() {
  const snap = await getOptionalDoc("semifinalResults", "official");
  if (!snap?.exists()) return;

  const results = snap.data().results || {};

  semifinalMatches.forEach(match => {
    const indicatorId = `semifinal-${match.id}-result`;
    clearScoringIndicator(indicatorId);

    const result = results[match.id];
    const winner = getValue(`semifinal-${match.id}-winner`);
    const score = getRound16ScoreFromInputs("semifinal", match.id);
    const resultScore = normalizeWinnerFirstScore(result?.score);
    if (!winner || !result?.winner) return;

    const winnerCorrect = sameCountryOption(winner, result.winner);
    const scoreCorrect =
      winnerCorrect &&
      !!parseWinnerFirstScore(score) &&
      !!parseWinnerFirstScore(resultScore) &&
      score === resultScore;
    const pickedExtraTime = document.getElementById(`semifinal-${match.id}-extraTimeOrPenalties`)?.checked || false;

    let points = 0;
    if (winnerCorrect) points += 3;
    if (scoreCorrect) points += 2;
    if (pickedExtraTime) points += result.extraTimeOrPenalties ? 1 : -1;

    const labelParts = [];
    labelParts.push(winnerCorrect ? "Winner ✓" : "Winner X");
    if (score) labelParts.push(scoreCorrect ? "score ✓" : winnerCorrect ? "score X" : "score needs winner");
    if (pickedExtraTime) labelParts.push(result.extraTimeOrPenalties ? "ET/Pens ✓" : "ET/Pens X");

    setScoringIndicator(indicatorId, pointsState(points), labelParts.join(", "), points);
  });
}

saveSemifinalPicksBtn?.addEventListener("click", async () => {
  if (!currentUser) return alert("Please sign in first.");
  if (allSemifinalMatchesAreLocked()) return alert("All Semifinals picks are locked.");

  const existingSnap = await getOptionalDoc("semifinalPicks", currentUser.uid);
  const picks = existingSnap?.exists() ? existingSnap.data().picks || {} : {};

  let savedAnyUnlockedMatch = false;

  for (const match of semifinalMatches) {
    if (semifinalMatchIsLocked(match)) continue;

    const winner = getValue(`semifinal-${match.id}-winner`);
    const score = getRound16ScoreFromInputs("semifinal", match.id);
    const extraTimeOrPenalties =
      document.getElementById(`semifinal-${match.id}-extraTimeOrPenalties`)?.checked || false;

    if (!winner) return alert(`Pick a winner for ${match.label}.`);
    if (![match.home, match.away].includes(winner)) return alert(`${match.label}: selected winner is not valid for this matchup.`);

    const scoreError = score === null
      ? `${match.label}: enter both score numbers.`
      : validateRound16Score(score, match.label);
    if (scoreError) return alert(scoreError);

    picks[match.id] = { winner, score, extraTimeOrPenalties };
    savedAnyUnlockedMatch = true;
  }

  if (!savedAnyUnlockedMatch) {
    return alert("No unlocked Semifinals matches are available to save.");
  }

  semifinalPicksStatus.className = "status-message status-info";
  semifinalPicksStatus.textContent = "Saving Semifinals picks...";
  saveSemifinalPicksBtn.disabled = true;

  try {
    await setDoc(doc(db, "semifinalPicks", currentUser.uid), {
      uid: currentUser.uid,
      email: currentUser.email,
      picks,
      scoring: { winner: 3, score: 2, scoreRequiresCorrectWinner: true, extraTimeOrPenaltiesCorrect: 1, extraTimeOrPenaltiesWrong: -1 },
      updatedAt: new Date().toISOString()
    }, { merge: true });

    semifinalPicksStatus.className = "status-message status-success";
    semifinalPicksStatus.textContent = "✅ Semifinals picks saved! Now select your Semifinal bonus answers below.";
    showSaveNotification("Semifinals picks saved!");
    await applySemifinalPickIndicators();
    semifinalBonusSection?.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    console.error("Failed to save Semifinals picks:", error);
    semifinalPicksStatus.className = "status-message status-error";
    semifinalPicksStatus.textContent =
      "Semifinals picks were not saved. Check Firestore rules for semifinalPicks.";
  } finally {
    if (!allSemifinalMatchesAreLocked()) {
      saveSemifinalPicksBtn.disabled = false;
    }
  }
});

function semifinalBonusAnswersAreLocked() {
  return semifinalMatchIsLocked(semifinalMatches[0]);
}

function semifinalBonusAnswersAreRevealable() {
  return semifinalMatchIsLocked(semifinalMatches[0]);
}

function renderSemifinalBonusQuestions() {
  if (!semifinalBonusForm) return;

  semifinalBonusForm.innerHTML = `
    <div class="pick-card semifinal-bonus-card semifinal-bonus-top-one">
      <label>1. Which semifinal will have more total goals?</label>
      <p class="mini-note">An unlucky tie results in zero points awarded for this question.</p>
      <select id="semifinal-bonus-moreGoalsMatch">
        ${renderSemifinalMatchOptions("Select semifinal")}
      </select>
      <p id="semifinal-bonus-moreGoalsMatch-result" class="answer-result"></p>
    </div>

    <div class="pick-card semifinal-bonus-card semifinal-bonus-top-two">
      <label>2. Which semifinal will have more total corner kicks?</label>
      <p class="mini-note">An unlucky tie results in zero points awarded for this question.</p>
      <select id="semifinal-bonus-moreCornerKicksMatch">
        ${renderSemifinalMatchOptions("Select semifinal")}
      </select>
      <p id="semifinal-bonus-moreCornerKicksMatch-result" class="answer-result"></p>
    </div>

    <div class="pick-card semifinal-bonus-card">
      <label>3. Which team will record the most shots on target?</label>
      <p class="mini-note">Ties will reward points for either team.</p>
      <select id="semifinal-bonus-mostShotsOnTargetTeam">
        ${renderSemifinalTeamOptions("Select team")}
      </select>
      <p id="semifinal-bonus-mostShotsOnTargetTeam-result" class="answer-result"></p>
    </div>

    <div class="pick-card semifinal-bonus-card">
      <label>4. Which team will receive the most yellow cards?</label>
      <p class="mini-note">Ties will reward points for either team.</p>
      <select id="semifinal-bonus-mostYellowCardsTeam">
        ${renderSemifinalTeamOptions("Select team")}
      </select>
      <p id="semifinal-bonus-mostYellowCardsTeam-result" class="answer-result"></p>
    </div>

    <div class="pick-card semifinal-bonus-card">
      <label>5. Which team will complete the most passes?</label>
      <p class="mini-note">Ties will reward points for either team.</p>
      <select id="semifinal-bonus-mostPassesTeam">
        ${renderSemifinalTeamOptions("Select team")}
      </select>
      <p id="semifinal-bonus-mostPassesTeam-result" class="answer-result"></p>
    </div>

    <div class="pick-card semifinal-rooting-card">
      <label>Choose the team in the top 4 that you want to win it all!</label>
      <p class="mini-note">Not worth points, just for kicks.</p>
      <select id="semifinal-bonus-rootingForWinner">
        ${renderSemifinalTeamOptions("Select team")}
      </select>
    </div>
  `;

  if (semifinalBonusAnswersAreLocked()) {
    semifinalBonusStatus.className = "status-message status-locked";
    semifinalBonusStatus.textContent = "🔒 Semifinal bonus answers are locked.";
    saveSemifinalBonusBtn.disabled = true;
    saveSemifinalBonusBtn.textContent = "Semifinal Bonus Locked";
    [
      "semifinal-bonus-moreGoalsMatch",
      "semifinal-bonus-moreCornerKicksMatch",
      "semifinal-bonus-mostShotsOnTargetTeam",
      "semifinal-bonus-mostYellowCardsTeam",
      "semifinal-bonus-mostPassesTeam",
      "semifinal-bonus-rootingForWinner"
    ].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = true;
    });
  } else {
    semifinalBonusStatus.className = "";
    saveSemifinalBonusBtn.disabled = false;
    saveSemifinalBonusBtn.textContent = "Save Semifinal Bonus Answers";
  }
}

async function loadExistingSemifinalBonusAnswers() {
  const snap = await getOptionalDoc("semifinalBonusAnswers", currentUser.uid);
  if (!snap?.exists()) return;

  const answers = snap.data().answers || {};

  setValue("semifinal-bonus-moreGoalsMatch", answers.moreGoalsMatch);
  setValue("semifinal-bonus-moreCornerKicksMatch", answers.moreCornerKicksMatch);
  setValue("semifinal-bonus-mostShotsOnTargetTeam", answers.mostShotsOnTargetTeam);
  setValue("semifinal-bonus-mostYellowCardsTeam", answers.mostYellowCardsTeam);
  setValue("semifinal-bonus-mostPassesTeam", answers.mostPassesTeam);
  setValue("semifinal-bonus-rootingForWinner", answers.rootingForWinner);

  if (!semifinalBonusAnswersAreLocked()) {
    semifinalBonusStatus.className = "status-message status-info";
    semifinalBonusStatus.textContent = "Loaded saved Semifinal bonus answers.";
  }

  await applySemifinalBonusIndicators();
}

function semifinalBonusKeyIsComplete(key = {}) {
  return semifinalBonusDirectKeyIsComplete(getSemifinalBonusScoringKey(key));
}

async function applySemifinalBonusIndicators() {
  [
    "semifinal-bonus-moreGoalsMatch-result",
    "semifinal-bonus-moreCornerKicksMatch-result",
    "semifinal-bonus-mostShotsOnTargetTeam-result",
    "semifinal-bonus-mostYellowCardsTeam-result",
    "semifinal-bonus-mostPassesTeam-result"
  ].forEach(clearScoringIndicator);

  const snap = await getOptionalDoc("semifinalBonusResults", "official");
  if (!snap?.exists()) return;

  const key = getSemifinalBonusScoringKey(snap.data().results || {});
  if (!semifinalBonusKeyIsComplete(key)) return;

  setSemifinalMatchBonusIndicator(
    "semifinal-bonus-moreGoalsMatch",
    "semifinal-bonus-moreGoalsMatch-result",
    key.moreGoalsMatch
  );
  setSemifinalMatchBonusIndicator(
    "semifinal-bonus-moreCornerKicksMatch",
    "semifinal-bonus-moreCornerKicksMatch-result",
    key.moreCornerKicksMatch
  );
  setSemifinalTeamBonusIndicator(
    "semifinal-bonus-mostShotsOnTargetTeam",
    "semifinal-bonus-mostShotsOnTargetTeam-result",
    key.mostShotsOnTargetTeams
  );
  setSemifinalTeamBonusIndicator(
    "semifinal-bonus-mostYellowCardsTeam",
    "semifinal-bonus-mostYellowCardsTeam-result",
    key.mostYellowCardsTeams
  );
  setSemifinalTeamBonusIndicator(
    "semifinal-bonus-mostPassesTeam",
    "semifinal-bonus-mostPassesTeam-result",
    key.mostPassesTeams
  );
}

function setSemifinalMatchBonusIndicator(selectId, resultId, correctMatchId) {
  const answer = getValue(selectId);
  if (!answer) return;

  const correct = correctMatchId !== "tie" && answer === correctMatchId;
  setScoringIndicator(
    resultId,
    correct ? "correct" : "wrong",
    correct ? "Correct semifinal" : "Wrong semifinal",
    correct ? SEMIFINAL_BONUS_POINTS : 0
  );
}

function setSemifinalTeamBonusIndicator(selectId, resultId, correctTeams = []) {
  const answer = getValue(selectId);
  if (!answer) return;

  const correct = correctTeams.some(team => sameCountryOption(answer, team));
  setScoringIndicator(
    resultId,
    correct ? "correct" : "wrong",
    correct ? "Correct team" : "Wrong team",
    correct ? SEMIFINAL_BONUS_POINTS : 0
  );
}

saveSemifinalBonusBtn?.addEventListener("click", async () => {
  if (!currentUser) return alert("Please sign in first.");
  if (semifinalBonusAnswersAreLocked()) return alert("Semifinal bonus answers are locked.");

  const answers = {
    moreGoalsMatch: getValue("semifinal-bonus-moreGoalsMatch"),
    moreCornerKicksMatch: getValue("semifinal-bonus-moreCornerKicksMatch"),
    mostShotsOnTargetTeam: getValue("semifinal-bonus-mostShotsOnTargetTeam"),
    mostYellowCardsTeam: getValue("semifinal-bonus-mostYellowCardsTeam"),
    mostPassesTeam: getValue("semifinal-bonus-mostPassesTeam"),
    rootingForWinner: getValue("semifinal-bonus-rootingForWinner")
  };

  if (!answers.moreGoalsMatch) return alert("Select which Semifinal will have more total goals.");
  if (!answers.moreCornerKicksMatch) return alert("Select which Semifinal will have more total corner kicks.");
  if (!answers.mostShotsOnTargetTeam) return alert("Select the team with the most shots on target.");
  if (!answers.mostYellowCardsTeam) return alert("Select the team with the most yellow cards.");
  if (!answers.mostPassesTeam) return alert("Select the team with the most completed passes.");
  if (!answers.rootingForWinner) return alert("Select the top 4 team you want to win it all.");

  semifinalBonusStatus.className = "status-message status-info";
  semifinalBonusStatus.textContent = "Saving Semifinal bonus answers...";
  saveSemifinalBonusBtn.disabled = true;

  try {
    await setDoc(doc(db, "semifinalBonusAnswers", currentUser.uid), {
      uid: currentUser.uid,
      email: currentUser.email,
      answers,
      scoring: {
        moreGoalsMatch: SEMIFINAL_BONUS_POINTS,
        moreCornerKicksMatch: SEMIFINAL_BONUS_POINTS,
        mostShotsOnTargetTeam: SEMIFINAL_BONUS_POINTS,
        mostYellowCardsTeam: SEMIFINAL_BONUS_POINTS,
        mostPassesTeam: SEMIFINAL_BONUS_POINTS
      },
      updatedAt: new Date().toISOString()
    }, { merge: true });

    semifinalBonusStatus.className = "status-message status-success";
    semifinalBonusStatus.textContent = "✅ Semifinal bonus answers saved!";
    showSaveNotification("Semifinal bonus answers saved!");
    await saveRootingForCountriesFromSemifinalBonus(answers.rootingForWinner);
    await applySemifinalBonusIndicators();
    await renderLeaderboardFromFirestore();
  } catch (error) {
    console.error("Failed to save Semifinal bonus answers:", error);
    semifinalBonusStatus.className = "status-message status-error";
    semifinalBonusStatus.textContent =
      "Semifinal bonus answers were not saved. Check Firestore rules for semifinalBonusAnswers.";
  } finally {
    if (!semifinalBonusAnswersAreLocked()) {
      saveSemifinalBonusBtn.disabled = false;
    }
  }
});

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

      <label>Final score</label>
      <div class="score-entry-row" aria-label="Official final score">
        <input
          id="result-round16-${match.id}-winnerGoals"
          class="score-number-input"
          type="text"
          inputmode="numeric"
          pattern="[0-9]*"
          autocomplete="off"
          enterkeyhint="next"
          data-score-number
          aria-label="Official winner final goals"
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
          aria-label="Official opponent final goals"
        />
      </div>
      <p class="mini-note">Final score includes extra time, not shootout penalties. Put the winner's score first; use 1-1 for matches tied after extra time.</p>

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
  if (!snap.exists()) {
    await renderAdminRound16BonusKey();
    return;
  }

  const results = snap.data().results || {};

  Object.entries(results).forEach(([matchId, result]) => {
    setValue(`result-round16-${matchId}-winner`, result.winner);
    setRound16ScoreInputs("result-round16", matchId, result.score);

    const extraTimeOrPenalties = document.getElementById(`result-round16-${matchId}-extraTimeOrPenalties`);
    if (extraTimeOrPenalties) {
      extraTimeOrPenalties.checked = !!result.extraTimeOrPenalties;
    }
  });

  await renderAdminRound16BonusKey(results);
}

async function renderAdminRound16BonusKey(existingResults = null) {
  if (!adminRound16BonusKey) return;

  const [round16Snap, round32Snap] = await Promise.all([
    existingResults ? Promise.resolve(null) : getDoc(doc(db, "round16Results", "official")),
    getDoc(doc(db, "round32Results", "official"))
  ]);
  const round16Results = existingResults || (round16Snap?.exists() ? round16Snap.data().results || {} : {});
  const round32Results = round32Snap.exists() ? round32Snap.data().results || {} : {};
  const completedCount = getRound16OfficialScores(round16Results).length;
  const key = getRound16BonusAnswerKey(round16Results, round32Results);

  if (!key) {
    adminRound16BonusKey.innerHTML = `
      <div class="admin-bonus-key-card">
        <span class="admin-panel-label">Round of 16 bonus key</span>
        <h3>Bonus Answer Key</h3>
        <p class="mini-note">
          Pending: ${completedCount}/${round16Matches.length} Round of 16 official results have winners and valid final scores.
          Bonus points will stay at 0 until all Round of 16 matches are complete.
        </p>
      </div>
    `;
    return;
  }

  const mostGoalsMatches = key.mostGoalsMatchIds
    .map(matchId => round16Matches.find(match => match.id === matchId))
    .filter(Boolean);

  adminRound16BonusKey.innerHTML = `
    <div class="admin-bonus-key-card">
      <span class="admin-panel-label">Round of 16 bonus key</span>
      <h3>Bonus Answer Key</h3>
      <p class="mini-note">These answers are calculated from the official Round of 16 results above. RO16 bonus points are awarded only after all eight matches are complete.</p>
      <table class="admin-player-table admin-bonus-key-table">
        <tbody>
          <tr>
            <th>Most total goals match</th>
            <td>${mostGoalsMatches.map(match => escapeHTML(round16MatchupLabel(match, round32Results))).join("<br>")}</td>
          </tr>
          <tr>
            <th>Clean sheets</th>
            <td>${escapeHTML(String(key.cleanSheets))}</td>
          </tr>
          <tr>
            <th>Region goal order</th>
            <td>${key.regionOrder.map((region, index) => `${index + 1}. ${escapeHTML(region)}`).join("<br>")}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
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
  await renderAdminRound16BonusKey(results);
  await renderAdminQuarterfinalResults();
  await renderAdminQuarterfinalBonusQuestions();
  await loadExistingQuarterfinalResults();
  await renderRound16Picks();
  await renderRound16BonusQuestions();
  await renderUserRound16BonusAnswerKey();
  await renderQuarterfinalPicks();
  await renderQuarterfinalBonusQuestions();
  await loadExistingRound16Picks();
  await loadExistingRound16BonusAnswers();
  await loadExistingQuarterfinalPicks();
  await loadExistingQuarterfinalBonusAnswers();
  await renderLeaderboardFromFirestore();
});

function scoreRound16Picks(picks, results) {
  if (!picks || !results) return 0;

  let points = 0;

  Object.entries(picks).forEach(([matchId, pick]) => {
    const result = results[matchId];
    if (!pick || !result?.winner) return;

    const winnerCorrect = sameCountryOption(pick.winner, result.winner);
    if (winnerCorrect) {
      points += 3;
    }

    const pickScore = normalizeWinnerFirstScore(pick.score);
    const resultScore = normalizeWinnerFirstScore(result.score);
    if (
      winnerCorrect &&
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
  await renderUserRound32BonusAnswerKey();
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

function round32PickPointsFor(matchId, pick, results = {}) {
  const result = results[matchId];
  if (!pick || !result?.winner) return null;

  let points = sameCountryOption(pick.winner, result.winner) ? 3 : 0;
  if (pick.extraTimeOrPenalties) {
    points += result.extraTimeOrPenalties ? 1 : -1;
  }
  return points;
}

function round16PickPointsFor(matchId, pick, results = {}) {
  const result = results[matchId];
  if (!pick || !result?.winner) return null;

  let points = 0;
  const winnerCorrect = sameCountryOption(pick.winner, result.winner);
  if (winnerCorrect) points += 3;

  const pickScore = normalizeWinnerFirstScore(pick.score);
  const resultScore = normalizeWinnerFirstScore(result.score);
  if (
    winnerCorrect &&
    parseWinnerFirstScore(pickScore) &&
    parseWinnerFirstScore(resultScore) &&
    pickScore === resultScore
  ) {
    points += 2;
  }

  if (pick.extraTimeOrPenalties) {
    points += result.extraTimeOrPenalties ? 1 : -1;
  }

  return points;
}

function quarterfinalPickPointsFor(matchId, pick, results = {}) {
  return round16PickPointsFor(matchId, pick, results);
}

function pointDetailLabel(points) {
  if (points === null || points === undefined) return "Pending";
  return `${points > 0 ? "+" : ""}${points} pts`;
}

function renderEarnedPoints(points, label = "Points earned") {
  return `<p class="earned-points"><strong>${escapeHTML(label)}:</strong> ${escapeHTML(pointDetailLabel(points))}</p>`;
}

function formatCorrectAnswerWithDetail(label, detail = "") {
  return detail ? `${label} (${detail})` : label;
}

function getRound32ThreeGoalWinnerDetail(team, round32Results = {}) {
  const match = round32Matches.find(item =>
    sameCountryOption(round32Results[item.id]?.winner, team)
  );
  const result = match ? round32Results[match.id] : null;
  const parsed = result?.score ? parseWinnerFirstScore(result.score) : null;

  if (parsed) {
    const margin = parsed.winnerGoals - parsed.otherGoals;
    if (margin > 0) return `won by ${margin} goal${margin === 1 ? "" : "s"}`;
  }

  return "3+ goal win";
}

function round32BonusCorrectAnswersFor(results = {}, round32Results = {}) {
  const threeGoalWinners = Array.isArray(results.threeGoalWinners)
    ? results.threeGoalWinners
    : [];

  return {
    extraTimeOrPenaltiesCount:
      results.extraTimeOrPenaltiesCount !== "" && results.extraTimeOrPenaltiesCount != null
        ? String(results.extraTimeOrPenaltiesCount)
        : "",
    redCards:
      results.redCards !== "" && results.redCards != null
        ? String(results.redCards)
        : "",
    threeGoalWinners: threeGoalWinners.map(team =>
      formatCorrectAnswerWithDetail(
        countryOptionLabel(team),
        getRound32ThreeGoalWinnerDetail(team, round32Results)
      )
    )
  };
}

function round32BonusPointDetailsFor(answers = {}, results = {}, round32Results = {}) {
  const userThreeGoalWinners = Array.isArray(answers.threeGoalWinners)
    ? answers.threeGoalWinners
    : [answers.threeGoalWinner].filter(Boolean);
  const officialThreeGoalWinners = Array.isArray(results.threeGoalWinners)
    ? results.threeGoalWinners
    : [];
  const teamPoints = team =>
    team && officialThreeGoalWinners.length
      ? officialThreeGoalWinners.some(resultTeam => sameCountryOption(team, resultTeam)) ? 2 : 0
      : null;

  return {
    extraTimeOrPenaltiesCount: scoreExactOrWithinTwo(answers.extraTimeOrPenaltiesCount, results.extraTimeOrPenaltiesCount),
    redCards: scoreExactOrWithinTwo(answers.redCards, results.redCards),
    threeGoalWinner1: teamPoints(userThreeGoalWinners[0]),
    threeGoalWinner2: teamPoints(userThreeGoalWinners[1]),
    correctAnswers: round32BonusCorrectAnswersFor(results, round32Results)
  };
}

function openingBonusCorrectAnswersFor(results = {}) {
  return {
    mostGoalsCountry: openingMostGoalsCountryValues(results).map(countryOptionLabel),
    yellowCards:
      results.yellowCards !== "" && results.yellowCards != null
        ? `${results.yellowCards} (within 10 accepted)`
        : "",
    usaOut: results.usaOut || "",
    semifinalist: Array.isArray(results.semifinalists)
      ? results.semifinalists.map(countryOptionLabel)
      : [],
    winner: results.winner ? countryOptionLabel(results.winner) : ""
  };
}

function openingBonusPointDetailsFor(answers = {}, results = {}) {
  const yellowCardsAnswered = answers.yellowCards !== "" && answers.yellowCards != null;
  const yellowCardsResultReady = results.yellowCards !== "" && results.yellowCards != null;
  const yellowCardsGuess = Number(answers.yellowCards);
  const yellowCardsActual = Number(results.yellowCards);
  const mostGoalsCountries = openingMostGoalsCountryValues(results);

  return {
    mostGoalsCountry:
      answers.mostGoalsCountry && mostGoalsCountries.length
        ? openingMostGoalsCountryIsCorrect(answers.mostGoalsCountry, results) ? 1 : 0
        : null,
    yellowCards:
      yellowCardsAnswered && yellowCardsResultReady && !Number.isNaN(yellowCardsGuess) && !Number.isNaN(yellowCardsActual)
        ? Math.abs(yellowCardsGuess - yellowCardsActual) <= 10 ? 1 : 0
        : null,
    usaOut:
      answers.usaOut && results.usaOut
        ? answers.usaOut === results.usaOut ? 1 : 0
        : null,
    semifinalist:
      answers.semifinalist && Array.isArray(results.semifinalists) && results.semifinalists.length
        ? results.semifinalists.some(team => sameCountryOption(answers.semifinalist, team)) ? 1 : 0
        : null,
    winner:
      answers.winner && results.winner
        ? sameCountryOption(answers.winner, results.winner) ? 1 : 0
        : null,
    correctAnswers: openingBonusCorrectAnswersFor(results)
  };
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

function getQuarterfinalOfficialScores(results = {}) {
  return quarterfinalMatches
    .map(match => {
      const result = results[match.id];
      const parsed = result?.score ? parseWinnerFirstScore(result.score) : null;
      const hasFreeKicks = result?.freeKicks !== "" && result?.freeKicks != null;
      const freeKicks = Number(result?.freeKicks);
      if (!result?.winner || !parsed || !hasFreeKicks || Number.isNaN(freeKicks)) return null;
      return { match, result, parsed, freeKicks };
    })
    .filter(Boolean);
}

function quarterfinalBonusResultsAreComplete(results = {}) {
  return quarterfinalMatches.every(match => {
    const result = results[match.id];
    const hasFreeKicks = result?.freeKicks !== "" && result?.freeKicks != null;
    const freeKicks = Number(result?.freeKicks);
    return !!result?.winner && !!parseWinnerFirstScore(result.score) && hasFreeKicks && !Number.isNaN(freeKicks);
  });
}

function quarterfinalManualBonusKeyIsComplete(key = {}) {
  return !!key &&
    (key.anyCleanSheet === "yes" || key.anyCleanSheet === "no") &&
    Array.isArray(key.mostGoalsTeams) &&
    key.mostGoalsTeams.length > 0 &&
    Array.isArray(key.mostFreeKicksMatchIds) &&
    key.mostFreeKicksMatchIds.length > 0;
}

function normalizeQuarterfinalManualBonusKey(key = {}) {
  return {
    anyCleanSheet: key.anyCleanSheet === "yes",
    mostGoalsTeams: Array.isArray(key.mostGoalsTeams) ? key.mostGoalsTeams : [],
    mostFreeKicksMatchIds: Array.isArray(key.mostFreeKicksMatchIds) ? key.mostFreeKicksMatchIds : []
  };
}

function getQuarterfinalBonusScoringKey(quarterfinalResults = {}, round16Results = {}, round32Results = {}, manualKey = null) {
  return quarterfinalManualBonusKeyIsComplete(manualKey)
    ? normalizeQuarterfinalManualBonusKey(manualKey)
    : getQuarterfinalBonusAnswerKey(quarterfinalResults, round16Results, round32Results);
}

function quarterfinalBonusCorrectAnswersFor(quarterfinalResults = {}, round16Results = {}, round32Results = {}, manualKey = null) {
  const key = getQuarterfinalBonusScoringKey(quarterfinalResults, round16Results, round32Results, manualKey);
  if (!key) return {};

  const goalsByTeam = calculateQuarterfinalGoalsByTeam(quarterfinalResults, round16Results, round32Results);
  const freeKicksByMatchId = Object.fromEntries(
    getQuarterfinalOfficialScores(quarterfinalResults).map(({ match, freeKicks }) => [match.id, freeKicks])
  );
  const mostFreeKicksMatches = key.mostFreeKicksMatchIds
    .map(matchId => quarterfinalMatches.find(match => match.id === matchId))
    .filter(Boolean);

  return {
    anyCleanSheet: key.anyCleanSheet ? "Yes" : "No",
    mostGoalsTeam: key.mostGoalsTeams.map(team =>
      formatCorrectAnswerWithDetail(
        round32TeamLabel(team),
        goalsByTeam[team] != null ? `${goalsByTeam[team]} goal${goalsByTeam[team] === 1 ? "" : "s"}` : ""
      )
    ),
    mostFreeKicksMatch: mostFreeKicksMatches.map(match =>
      formatCorrectAnswerWithDetail(
        quarterfinalMatchupLabel(match, round16Results, round32Results),
        freeKicksByMatchId[match.id] != null
          ? `${freeKicksByMatchId[match.id]} free kick${freeKicksByMatchId[match.id] === 1 ? "" : "s"}`
          : ""
      )
    )
  };
}

function getQuarterfinalResultParticipants(match, result, round16Results = {}, round32Results = {}) {
  if (Array.isArray(result?.participants) && result.participants.length === 2) {
    return result.participants;
  }

  return quarterfinalResolvedParticipants(match, round16Results, round32Results);
}

function calculateQuarterfinalAnyCleanSheet(results = {}) {
  return getQuarterfinalOfficialScores(results).some(({ parsed }) =>
    parsed.winnerGoals === 0 || parsed.otherGoals === 0
  );
}

function calculateQuarterfinalMostGoalsTeams(results = {}, round16Results = {}, round32Results = {}) {
  const goalsByTeam = calculateQuarterfinalGoalsByTeam(results, round16Results, round32Results);
  const teams = Object.keys(goalsByTeam);
  if (!teams.length) return [];

  const maxGoals = Math.max(...teams.map(team => goalsByTeam[team]));
  return teams.filter(team => goalsByTeam[team] === maxGoals);
}

function calculateQuarterfinalGoalsByTeam(results = {}, round16Results = {}, round32Results = {}) {
  const goalsByTeam = {};

  getQuarterfinalOfficialScores(results).forEach(({ match, result, parsed }) => {
    const participants = getQuarterfinalResultParticipants(match, result, round16Results, round32Results);
    if (participants.length !== 2) return;

    const winner = participants.find(team => sameCountryOption(team, result.winner));
    const other = participants.find(team => !sameCountryOption(team, result.winner));

    if (winner) goalsByTeam[winner] = (goalsByTeam[winner] || 0) + parsed.winnerGoals;
    if (other) goalsByTeam[other] = (goalsByTeam[other] || 0) + parsed.otherGoals;
  });

  return goalsByTeam;
}

function calculateQuarterfinalMostFreeKicksMatchIds(results = {}) {
  const scoredMatches = getQuarterfinalOfficialScores(results);
  if (!scoredMatches.length) return [];

  const maxFreeKicks = Math.max(...scoredMatches.map(({ freeKicks }) => freeKicks));
  return scoredMatches
    .filter(({ freeKicks }) => freeKicks === maxFreeKicks)
    .map(({ match }) => match.id);
}

function getQuarterfinalBonusAnswerKey(results = {}, round16Results = {}, round32Results = {}) {
  if (!quarterfinalBonusResultsAreComplete(results)) return null;

  return {
    anyCleanSheet: calculateQuarterfinalAnyCleanSheet(results),
    mostGoalsTeams: calculateQuarterfinalMostGoalsTeams(results, round16Results, round32Results),
    mostFreeKicksMatchIds: calculateQuarterfinalMostFreeKicksMatchIds(results)
  };
}

function scoreQuarterfinalBonusAnswers(answers, quarterfinalResults, round16Results, round32Results, manualKey = null) {
  if (!answers) return 0;

  const key = quarterfinalManualBonusKeyIsComplete(manualKey)
    ? normalizeQuarterfinalManualBonusKey(manualKey)
    : getQuarterfinalBonusAnswerKey(quarterfinalResults, round16Results, round32Results);
  if (!key) return 0;

  let points = 0;

  if (answers.anyCleanSheet && answers.anyCleanSheet === (key.anyCleanSheet ? "yes" : "no")) {
    points += QUARTERFINAL_BONUS_POINTS;
  }

  if (
    answers.mostGoalsTeam &&
    key.mostGoalsTeams.some(team => sameCountryOption(answers.mostGoalsTeam, team))
  ) {
    points += QUARTERFINAL_BONUS_POINTS;
  }

  if (answers.mostFreeKicksMatch && key.mostFreeKicksMatchIds.includes(answers.mostFreeKicksMatch)) {
    points += QUARTERFINAL_BONUS_POINTS;
  }

  return points;
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

function round16BonusResultsAreComplete(results = {}) {
  return round16Matches.every(match => {
    const result = results[match.id];
    return !!result?.winner && !!parseWinnerFirstScore(result.score);
  });
}

function getRound16BonusAnswerKey(results = {}, round32Results = {}) {
  if (!round16BonusResultsAreComplete(results)) return null;

  const mostGoalsMatchIds = calculateRound16MostGoalsMatchIds(results);
  const cleanSheets = calculateRound16CleanSheets(results);
  const regionOrder = calculateRound16RegionOrder(results, round32Results);

  return {
    mostGoalsMatchIds,
    cleanSheets,
    regionOrder
  };
}

function round16BonusCorrectAnswersFor(results = {}, round32Results = {}) {
  const key = getRound16BonusAnswerKey(results, round32Results);
  if (!key) return {};

  return {
    mostGoalsMatch: key.mostGoalsMatchIds
      .map(matchId => {
        const match = round16Matches.find(item => item.id === matchId);
        const parsed = parseWinnerFirstScore(results[matchId]?.score);
        const detail = parsed ? `${parsed.totalGoals} goal${parsed.totalGoals === 1 ? "" : "s"}` : "";
        return match
          ? formatCorrectAnswerWithDetail(round16MatchupLabel(match, round32Results), detail)
          : "";
      })
      .filter(Boolean),
    cleanSheets: `${key.cleanSheets} clean sheet${key.cleanSheets === 1 ? "" : "s"}`,
    regionRank1: key.regionOrder[0] || "",
    regionRank2: key.regionOrder[1] || "",
    regionRank3: key.regionOrder[2] || "",
    regionRank4: key.regionOrder[3] || ""
  };
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
  if (!round16BonusResultsAreComplete(round16Results)) return 0;

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

function round16BonusPointDetailsFor(answers = {}, round16Results = {}, round32Results = {}) {
  const correctAnswers = round16BonusCorrectAnswersFor(round16Results, round32Results);

  if (!round16BonusResultsAreComplete(round16Results)) {
    return {
      mostGoalsMatch: null,
      cleanSheets: null,
      regionRank1: null,
      regionRank2: null,
      regionRank3: null,
      regionRank4: null,
      correctAnswers
    };
  }

  const actualRegionOrder = calculateRound16RegionOrder(round16Results, round32Results);
  const answerRegionOrder = Array.isArray(answers.regionOrder) ? answers.regionOrder : [];

  return {
    mostGoalsMatch:
      answers.mostGoalsMatch && calculateRound16MostGoalsMatchIds(round16Results).includes(answers.mostGoalsMatch)
        ? 2
        : 0,
    cleanSheets: scoreExactOrWithinOne(answers.cleanSheets, calculateRound16CleanSheets(round16Results)),
    regionRank1: answerRegionOrder[0] && answerRegionOrder[0] === actualRegionOrder[0] ? 1 : 0,
    regionRank2: answerRegionOrder[1] && answerRegionOrder[1] === actualRegionOrder[1] ? 1 : 0,
    regionRank3: answerRegionOrder[2] && answerRegionOrder[2] === actualRegionOrder[2] ? 1 : 0,
    regionRank4: answerRegionOrder[3] && answerRegionOrder[3] === actualRegionOrder[3] ? 1 : 0,
    correctAnswers
  };
}

function quarterfinalBonusPointDetailsFor(answers = {}, quarterfinalResults = {}, round16Results = {}, round32Results = {}, manualKey = null) {
  const correctAnswers = quarterfinalBonusCorrectAnswersFor(
    quarterfinalResults,
    round16Results,
    round32Results,
    manualKey
  );

  const hasManualKey = quarterfinalManualBonusKeyIsComplete(manualKey);
  if (!hasManualKey && !quarterfinalBonusResultsAreComplete(quarterfinalResults)) {
    return {
      anyCleanSheet: null,
      mostGoalsTeam: null,
      mostFreeKicksMatch: null,
      correctAnswers
    };
  }

  const key = hasManualKey
    ? normalizeQuarterfinalManualBonusKey(manualKey)
    : getQuarterfinalBonusAnswerKey(quarterfinalResults, round16Results, round32Results);
  if (!key) {
    return {
      anyCleanSheet: null,
      mostGoalsTeam: null,
      mostFreeKicksMatch: null,
      correctAnswers
    };
  }

  return {
    anyCleanSheet:
      answers.anyCleanSheet && answers.anyCleanSheet === (key.anyCleanSheet ? "yes" : "no")
        ? QUARTERFINAL_BONUS_POINTS
        : 0,
    mostGoalsTeam:
      answers.mostGoalsTeam && key.mostGoalsTeams.some(team => sameCountryOption(answers.mostGoalsTeam, team))
        ? QUARTERFINAL_BONUS_POINTS
        : 0,
    mostFreeKicksMatch:
      answers.mostFreeKicksMatch && key.mostFreeKicksMatchIds.includes(answers.mostFreeKicksMatch)
        ? QUARTERFINAL_BONUS_POINTS
        : 0,
    correctAnswers
  };
}

function semifinalBonusCorrectAnswersFor(results = {}) {
  const key = getSemifinalBonusScoringKey(results);
  if (!semifinalBonusKeyIsComplete(key)) return {};

  const matchAnswer = matchId => {
    if (matchId === "tie") return "Tie / no points";
    const match = semifinalMatches.find(item => item.id === matchId);
    return match ? semifinalMatchupLabel(match) : "";
  };

  return {
    moreGoalsMatch: formatSemifinalMatchCorrectAnswer(key, "moreGoalsMatch", "goals"),
    moreCornerKicksMatch: formatSemifinalMatchCorrectAnswer(key, "moreCornerKicksMatch", "cornerKicks"),
    mostShotsOnTargetTeam: key.mostShotsOnTargetTeams.map(team =>
      formatSemifinalTeamCorrectAnswer(key, team, "shotsOnTarget")
    ),
    mostYellowCardsTeam: key.mostYellowCardsTeams.map(team =>
      formatSemifinalTeamCorrectAnswer(key, team, "yellowCards")
    ),
    mostPassesTeam: key.mostPassesTeams.map(team =>
      formatSemifinalTeamCorrectAnswer(key, team, "passes")
    )
  };
}

function formatSemifinalMatchCorrectAnswer(key, resultKey, statKey) {
  const matchId = key[resultKey];
  const statValue = getSemifinalMatchStatValue(key, matchId, statKey);

  if (matchId === "tie") {
    const tieValue = getSemifinalTieStatValue(key, statKey);
    return tieValue == null
      ? "Tie / no points"
      : `Tie / no points (${tieValue} ${semifinalStatLabel(statKey)})`;
  }

  const match = semifinalMatches.find(item => item.id === matchId);
  const label = match ? semifinalMatchupLabel(match) : "";
  return formatCorrectAnswerWithDetail(
    label,
    statValue == null ? "" : `${statValue} ${semifinalStatLabel(statKey)}`
  );
}

function formatSemifinalTeamCorrectAnswer(key, team, statKey) {
  const statValue = key.teamStats?.[team]?.[statKey];
  return formatCorrectAnswerWithDetail(
    round32TeamLabel(team),
    statValue == null ? "" : `${statValue} ${semifinalStatLabel(statKey)}`
  );
}

function getSemifinalMatchStatValue(key, matchId, statKey) {
  return key.matchStats?.[matchId]?.[statKey] ?? null;
}

function getSemifinalTieStatValue(key, statKey) {
  const values = semifinalMatches
    .map(match => getSemifinalMatchStatValue(key, match.id, statKey))
    .filter(value => value != null);
  return values.length ? values[0] : null;
}

function semifinalStatLabel(statKey) {
  return {
    goals: "goal(s)",
    cornerKicks: "corner kick(s)",
    shotsOnTarget: "shot(s) on target",
    yellowCards: "yellow card(s)",
    passes: "pass(es)"
  }[statKey] || "item(s)";
}

function semifinalBonusPointDetailsFor(answers = {}, results = {}) {
  const key = getSemifinalBonusScoringKey(results);
  const correctAnswers = semifinalBonusCorrectAnswersFor(key);

  if (!semifinalBonusKeyIsComplete(key)) {
    return {
      moreGoalsMatch: null,
      moreCornerKicksMatch: null,
      mostShotsOnTargetTeam: null,
      mostYellowCardsTeam: null,
      mostPassesTeam: null,
      correctAnswers
    };
  }

  return {
    moreGoalsMatch:
      answers.moreGoalsMatch && key.moreGoalsMatch !== "tie" && answers.moreGoalsMatch === key.moreGoalsMatch
        ? SEMIFINAL_BONUS_POINTS
        : 0,
    moreCornerKicksMatch:
      answers.moreCornerKicksMatch && key.moreCornerKicksMatch !== "tie" && answers.moreCornerKicksMatch === key.moreCornerKicksMatch
        ? SEMIFINAL_BONUS_POINTS
        : 0,
    mostShotsOnTargetTeam:
      answers.mostShotsOnTargetTeam && key.mostShotsOnTargetTeams.some(team => sameCountryOption(answers.mostShotsOnTargetTeam, team))
        ? SEMIFINAL_BONUS_POINTS
        : 0,
    mostYellowCardsTeam:
      answers.mostYellowCardsTeam && key.mostYellowCardsTeams.some(team => sameCountryOption(answers.mostYellowCardsTeam, team))
        ? SEMIFINAL_BONUS_POINTS
        : 0,
    mostPassesTeam:
      answers.mostPassesTeam && key.mostPassesTeams.some(team => sameCountryOption(answers.mostPassesTeam, team))
        ? SEMIFINAL_BONUS_POINTS
        : 0,
    correctAnswers
  };
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

function renderUserBonusAnswerKey(title, rows) {
  return `
    <details class="user-bonus-key">
      <summary>View ${escapeHTML(title)} Answer Key</summary>
      <table class="admin-player-table admin-bonus-key-table">
        <tbody>
          ${rows.map(([label, value]) => `
            <tr>
              <th>${escapeHTML(label)}</th>
              <td>${value}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </details>
  `;
}

async function renderUserRound32BonusAnswerKey() {
  if (!round32BonusAnswerKey) return;

  const snap = await getDoc(doc(db, "round32BonusResults", "official"));
  if (!snap.exists()) {
    round32BonusAnswerKey.innerHTML = "";
    return;
  }

  const results = snap.data().results || {};
  const hasCounts =
    results.extraTimeOrPenaltiesCount !== "" &&
    results.extraTimeOrPenaltiesCount != null &&
    results.redCards !== "" &&
    results.redCards != null;
  const threeGoalWinners = Array.isArray(results.threeGoalWinners)
    ? results.threeGoalWinners
    : [];

  if (!hasCounts && !threeGoalWinners.length) {
    round32BonusAnswerKey.innerHTML = "";
    return;
  }

  round32BonusAnswerKey.innerHTML = renderUserBonusAnswerKey("Round of 32 Bonus", [
    ["Extra time / penalties count", hasCounts ? escapeHTML(String(results.extraTimeOrPenaltiesCount)) : "Pending"],
    ["Red cards", hasCounts ? escapeHTML(String(results.redCards)) : "Pending"],
    [
      "3+ goal winners",
      threeGoalWinners.length
        ? threeGoalWinners.map(team => escapeHTML(countryOptionLabel(team))).join("<br>")
        : "Pending"
    ]
  ]);
}

async function renderUserRound16BonusAnswerKey() {
  if (!round16BonusAnswerKey) return;

  const [round16Snap, round32Snap] = await Promise.all([
    getDoc(doc(db, "round16Results", "official")),
    getDoc(doc(db, "round32Results", "official"))
  ]);
  const round16Results = round16Snap.exists() ? round16Snap.data().results || {} : {};
  const round32Results = round32Snap.exists() ? round32Snap.data().results || {} : {};
  const key = getRound16BonusAnswerKey(round16Results, round32Results);

  if (!key) {
    round16BonusAnswerKey.innerHTML = "";
    return;
  }

  const mostGoalsMatches = key.mostGoalsMatchIds
    .map(matchId => round16Matches.find(match => match.id === matchId))
    .filter(Boolean);

  round16BonusAnswerKey.innerHTML = renderUserBonusAnswerKey("Round of 16 Bonus", [
    [
      "Most total goals match",
      mostGoalsMatches.map(match => escapeHTML(round16MatchupLabel(match, round32Results))).join("<br>")
    ],
    ["Clean sheets", escapeHTML(String(key.cleanSheets))],
    ["Region goal order", key.regionOrder.map((region, index) => `${index + 1}. ${escapeHTML(region)}`).join("<br>")]
  ]);
}

async function renderUserQuarterfinalBonusAnswerKey() {
  if (!quarterfinalBonusAnswerKey) return;

  const [manualSnap, resultsSnap, sourceResults] = await Promise.all([
    getOptionalDoc("quarterfinalBonusResults", "official"),
    getOptionalDoc("quarterfinalResults", "official"),
    getQuarterfinalSourceResults()
  ]);
  const manualKey = manualSnap?.exists() ? manualSnap.data().results || {} : null;
  const results = resultsSnap?.exists() ? resultsSnap.data().results || {} : {};
  const key = quarterfinalManualBonusKeyIsComplete(manualKey)
    ? normalizeQuarterfinalManualBonusKey(manualKey)
    : getQuarterfinalBonusAnswerKey(
      results,
      sourceResults.round16Results,
      sourceResults.round32Results
    );

  if (!key) {
    quarterfinalBonusAnswerKey.innerHTML = "";
    return;
  }

  const mostFreeKicksMatches = key.mostFreeKicksMatchIds
    .map(matchId => quarterfinalMatches.find(match => match.id === matchId))
    .filter(Boolean);

  quarterfinalBonusAnswerKey.innerHTML = renderUserBonusAnswerKey("Quarterfinals Bonus", [
    ["Any clean sheet?", key.anyCleanSheet ? "Yes" : "No"],
    [
      "Most goals team",
      key.mostGoalsTeams.length
        ? key.mostGoalsTeams.map(team => escapeHTML(round32TeamLabel(team))).join("<br>")
        : "Pending"
    ],
    [
      "Most free kicks match",
      mostFreeKicksMatches.length
        ? mostFreeKicksMatches
          .map(match => escapeHTML(quarterfinalMatchupLabel(
            match,
            sourceResults.round16Results,
            sourceResults.round32Results
          )))
          .join("<br>")
        : "Pending"
    ]
  ]);
}

async function renderUserBonusAnswerKeys() {
  await Promise.all([
    renderUserRound32BonusAnswerKey(),
    renderUserRound16BonusAnswerKey(),
    renderUserQuarterfinalBonusAnswerKey()
  ]);
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
  const quarterfinalPicksSnap = await getOptionalCollectionDocs("quarterfinalPicks");
  const quarterfinalBonusAnswersSnap = await getOptionalCollectionDocs("quarterfinalBonusAnswers");
  const semifinalPicksSnap = await getOptionalCollectionDocs("semifinalPicks");
  const semifinalBonusAnswersSnap = await getOptionalCollectionDocs("semifinalBonusAnswers");
  const finalsPicksSnap = await getOptionalCollectionDocs("finalsPicks");
  const finalsBonusAnswersSnap = await getOptionalCollectionDocs("finalsBonusAnswers");

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

  const quarterfinalPickStatusByUserId = {};
  quarterfinalPicksSnap.forEach(docSnap => {
    const data = docSnap.data();
    const picks = data.picks || {};
    const savedCount = quarterfinalMatches.filter(match =>
      picks[match.id]?.winner && picks[match.id]?.score
    ).length;
    const uid = data.uid || docSnap.id;

    quarterfinalPickStatusByUserId[uid] = {
      savedCount,
      complete: savedCount === quarterfinalMatches.length
    };
  });

  const quarterfinalBonusStatusByUserId = {};
  quarterfinalBonusAnswersSnap.forEach(docSnap => {
    const data = docSnap.data();
    const answers = data.answers || {};
    const complete =
      !!answers.anyCleanSheet &&
      !!answers.mostGoalsTeam &&
      !!answers.mostFreeKicksMatch;

    quarterfinalBonusStatusByUserId[data.uid || docSnap.id] = {
      answerCount:
        Number(!!answers.anyCleanSheet) +
        Number(!!answers.mostGoalsTeam) +
        Number(!!answers.mostFreeKicksMatch),
      complete
    };
  });

  const semifinalPickStatusByUserId = {};
  semifinalPicksSnap.forEach(docSnap => {
    const data = docSnap.data();
    const picks = data.picks || {};
    const savedCount = semifinalMatches.filter(match =>
      picks[match.id]?.winner && picks[match.id]?.score
    ).length;
    const uid = data.uid || docSnap.id;

    semifinalPickStatusByUserId[uid] = {
      savedCount,
      complete: savedCount === semifinalMatches.length
    };
  });

  const semifinalBonusStatusByUserId = {};
  semifinalBonusAnswersSnap.forEach(docSnap => {
    const data = docSnap.data();
    const answers = data.answers || {};
    const complete =
      !!answers.moreGoalsMatch &&
      !!answers.moreCornerKicksMatch &&
      !!answers.mostShotsOnTargetTeam &&
      !!answers.mostYellowCardsTeam &&
      !!answers.mostPassesTeam &&
      !!answers.rootingForWinner;

    semifinalBonusStatusByUserId[data.uid || docSnap.id] = {
      answerCount:
        Number(!!answers.moreGoalsMatch) +
        Number(!!answers.moreCornerKicksMatch) +
        Number(!!answers.mostShotsOnTargetTeam) +
        Number(!!answers.mostYellowCardsTeam) +
        Number(!!answers.mostPassesTeam) +
        Number(!!answers.rootingForWinner),
      complete
    };
  });

  const finalsPickStatusByUserId = {};
  finalsPicksSnap.forEach(docSnap => {
    const data = docSnap.data();
    const picks = data.picks || {};
    const savedCount = finalsMatches.filter(match =>
      picks[match.id]?.winner && picks[match.id]?.score
    ).length;
    const uid = data.uid || docSnap.id;

    finalsPickStatusByUserId[uid] = {
      savedCount,
      complete: savedCount === finalsMatches.length
    };
  });

  const finalsBonusStatusByUserId = {};
  finalsBonusAnswersSnap.forEach(docSnap => {
    const data = docSnap.data();
    const answers = data.answers || {};
    const survey = answers.survey || {};
    const bonusAnswerCount =
      Number(answers.combinedShotsOnTarget !== "" && answers.combinedShotsOnTarget != null) +
      Number(!!answers.moreGoalsMatch) +
      Number(answers.finalYellowCards !== "" && answers.finalYellowCards != null) +
      Number(!!answers.mostAttemptsTeam);
    const surveyAnswerCount =
      Number(!!survey.appearance) +
      Number(!!survey.scoring) +
      Number(!!survey.bonusQuality) +
      Number(!!survey.bonusAmount);

    finalsBonusStatusByUserId[data.uid || docSnap.id] = {
      bonusAnswerCount,
      surveyAnswerCount,
      bonusComplete: bonusAnswerCount === 4,
      surveyComplete: surveyAnswerCount === 4
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

  if (adminQuarterfinalPlayerList) {
    adminQuarterfinalPlayerList.innerHTML = `
      <table class="admin-player-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Username</th>
            <th>Quarterfinals Picks</th>
            <th>Quarterfinals Bonus</th>
          </tr>
        </thead>
        <tbody>
          ${users.map((u, index) => {
            const uid = u.uid;
            const picks = quarterfinalPickStatusByUserId[uid] || { savedCount: 0, complete: false };
            const bonus = quarterfinalBonusStatusByUserId[uid] || { answerCount: 0, complete: false };

            return `
              <tr>
                <td>${index + 1}</td>
                <td>${escapeHTML(u.username || u.googleDisplayName || "Player")}</td>
                <td>
                  <span class="${picks.complete ? "status-good" : "status-bad"}">
                    ${picks.complete ? "✅ Complete" : `❌ ${picks.savedCount}/${quarterfinalMatches.length}`}
                  </span>
                </td>
                <td>
                  <span class="${bonus.complete ? "status-good" : "status-bad"}">
                    ${bonus.complete ? "✅ Complete" : `❌ ${bonus.answerCount}/3`}
                  </span>
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    `;
  }

  if (adminSemifinalPlayerList) {
    adminSemifinalPlayerList.innerHTML = `
      <table class="admin-player-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Username</th>
            <th>Semifinals Picks</th>
            <th>Semifinal Bonus</th>
          </tr>
        </thead>
        <tbody>
          ${users.map((u, index) => {
            const uid = u.uid;
            const picks = semifinalPickStatusByUserId[uid] || { savedCount: 0, complete: false };
            const bonus = semifinalBonusStatusByUserId[uid] || { answerCount: 0, complete: false };

            return `
              <tr>
                <td>${index + 1}</td>
                <td>${escapeHTML(u.username || u.googleDisplayName || "Player")}</td>
                <td>
                  <span class="${picks.complete ? "status-good" : "status-bad"}">
                    ${picks.complete ? "✅ Complete" : `❌ ${picks.savedCount}/${semifinalMatches.length}`}
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

  if (adminFinalsPlayerList) {
    adminFinalsPlayerList.innerHTML = `
      <table class="admin-player-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Username</th>
            <th>Finals Picks</th>
            <th>Finals Bonus</th>
            <th>Survey</th>
          </tr>
        </thead>
        <tbody>
          ${users.map((u, index) => {
            const uid = u.uid;
            const picks = finalsPickStatusByUserId[uid] || { savedCount: 0, complete: false };
            const bonus = finalsBonusStatusByUserId[uid] || {
              bonusAnswerCount: 0,
              surveyAnswerCount: 0,
              bonusComplete: false,
              surveyComplete: false
            };

            return `
              <tr>
                <td>${index + 1}</td>
                <td>${escapeHTML(u.username || u.googleDisplayName || "Player")}</td>
                <td>
                  <span class="${picks.complete ? "status-good" : "status-bad"}">
                    ${picks.complete ? "✅ Complete" : `❌ ${picks.savedCount}/${finalsMatches.length}`}
                  </span>
                </td>
                <td>
                  <span class="${bonus.bonusComplete ? "status-good" : "status-bad"}">
                    ${bonus.bonusComplete ? "✅ Complete" : `❌ ${bonus.bonusAnswerCount}/4`}
                  </span>
                </td>
                <td>
                  <span class="${bonus.surveyComplete ? "status-good" : "status-bad"}">
                    ${bonus.surveyComplete ? "✅ Complete" : `❌ ${bonus.surveyAnswerCount}/4`}
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
  rows = rows.map(row => applyDailyScoringDeltas(row));
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
      rootingForCountries: (rootingByUid[row.uid] || row.rootingForCountries || [])
        .map(canonicalCountryOptionValue)
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
    rootingForCountries: (rootingByUid[row.uid] || row.rootingForCountries || [])
      .map(canonicalCountryOptionValue)
  }));
}

function leaderboardDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateKeyFromValue(value) {
  if (!value) return "";

  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return leaderboardDateKey(date);
}

function matchDateKey(match) {
  return dateKeyFromValue(match?.startTime);
}

function roundLastMatchDateKey(matches) {
  const timestamps = matches
    .map(match => new Date(match.startTime).getTime())
    .filter(timestamp => !Number.isNaN(timestamp));

  if (!timestamps.length) return "";
  return leaderboardDateKey(new Date(Math.max(...timestamps)));
}

function signedPointLabel(points) {
  const amount = Number(points || 0);
  return `${amount > 0 ? "+" : ""}${amount}`;
}

function exactWithinTwoLabel(points) {
  if (points === 4) return "Exact";
  if (points === 2) return "Within 2";
  return "";
}

function exactWithinOneLabel(points) {
  if (points === 3) return "Exact";
  if (points === 2) return "Within 1";
  return "";
}

function addScoringEntry(entries, dateKey, category, item, detail, points) {
  const numericPoints = Number(points || 0);
  if (!numericPoints) return;

  entries.push({
    dateKey,
    category,
    item,
    detail,
    points: numericPoints
  });
}

function dailyPointDeltasFromEntries(entries = [], dateKey = leaderboardDateKey()) {
  return entries.reduce((deltas, entry) => {
    if (entry.dateKey !== dateKey) return deltas;

    const points = Number(entry.points || 0);
    if (entry.category === "Match") {
      deltas.match += points;
    } else if (entry.category === "Bonus") {
      deltas.bonus += points;
    }

    return deltas;
  }, { match: 0, bonus: 0 });
}

function applyDailyScoringDeltas(row, dateKey = leaderboardDateKey()) {
  if (!Array.isArray(row.publicScoringEntries)) {
    return {
      ...row,
      match_points_delta: Number(row.match_points_delta || 0),
      bonus_points_delta: Number(row.bonus_points_delta || 0)
    };
  }

  const deltas = dailyPointDeltasFromEntries(row.publicScoringEntries, dateKey);
  return {
    ...row,
    match_points_delta: deltas.match,
    bonus_points_delta: deltas.bonus
  };
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
      const baselinePlayer = baseline.players?.[row.uid];

      if (!baselinePlayer) {
        return {
          ...row,
          rank_movement: 0,
          match_points_delta: Number(row.match_points_delta || 0),
          bonus_points_delta: Number(row.bonus_points_delta || 0)
        };
      }

      return {
        ...row,
        rank_movement: baselinePlayer.rank - currentRankByUid[row.uid],
        match_points_delta: Number(row.match_points_delta || 0),
        bonus_points_delta: Number(row.bonus_points_delta || 0)
      };
    });
  } catch (error) {
    console.warn("Could not apply daily leaderboard movement:", error);
    return rows.map(row => ({
      ...row,
      rank_movement: 0,
      match_points_delta: Number(row.match_points_delta || 0),
      bonus_points_delta: Number(row.bonus_points_delta || 0)
    }));
  }
}

async function attachPublishedDailyMovement(rows) {
  try {
    const snap = await getDoc(doc(db, "publicLeaderboard", "current"));
    if (!snap.exists()) return rows;

    const publishedRows = Array.isArray(snap.data().rows) ? snap.data().rows : [];
    const publishedByUid = {};

    publishedRows.forEach(row => {
      if (row.uid) publishedByUid[row.uid] = row;
    });

    return rows.map(row => {
      const published = publishedByUid[row.uid] || {};
      return {
        ...row,
        rank_movement: Number(published.rank_movement || 0),
        match_points_delta: Number(row.match_points_delta || 0),
        bonus_points_delta: Number(row.bonus_points_delta || 0)
      };
    });
  } catch (error) {
    console.warn("Could not attach published daily leaderboard movement:", error);
    return rows.map(row => ({
      ...row,
      rank_movement: Number(row.rank_movement || 0),
      match_points_delta: Number(row.match_points_delta || 0),
      bonus_points_delta: Number(row.bonus_points_delta || 0)
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
  const quarterfinalPicksSnap = await getOptionalCollectionDocs("quarterfinalPicks");
  const quarterfinalBonusAnswersSnap = await getOptionalCollectionDocs("quarterfinalBonusAnswers");
  const semifinalPicksSnap = await getOptionalCollectionDocs("semifinalPicks");
  const semifinalBonusAnswersSnap = await getOptionalCollectionDocs("semifinalBonusAnswers");
  const finalsPicksSnap = await getOptionalCollectionDocs("finalsPicks");
  const finalsBonusAnswersSnap = await getOptionalCollectionDocs("finalsBonusAnswers");
  const bonusAnswersSnap = await getDocs(collection(db, "bonusAnswers"));

  const groupResultsSnap = await getDoc(doc(db, "groupResults", "official"));
  const round32ResultsSnap = await getDoc(doc(db, "round32Results", "official"));
  const round32BonusResultsSnap = await getDoc(doc(db, "round32BonusResults", "official"));
  const round16ResultsSnap = await getDoc(doc(db, "round16Results", "official"));
  const quarterfinalResultsSnap = await getOptionalDoc("quarterfinalResults", "official");
  const quarterfinalBonusResultsSnap = await getOptionalDoc("quarterfinalBonusResults", "official");
  const semifinalResultsSnap = await getOptionalDoc("semifinalResults", "official");
  const semifinalBonusResultsSnap = await getOptionalDoc("semifinalBonusResults", "official");
  const finalsResultsSnap = await getOptionalDoc("finalsResults", "official");
  const finalsBonusResultsSnap = await getOptionalDoc("finalsBonusResults", "official");
  const bonusResultsSnap = await getDoc(doc(db, "bonusResults", "official"));

  const groupResultsDoc = groupResultsSnap.exists() ? groupResultsSnap.data() : {};
  const round32ResultsDoc = round32ResultsSnap.exists() ? round32ResultsSnap.data() : {};
  const round32BonusResultsDoc = round32BonusResultsSnap.exists() ? round32BonusResultsSnap.data() : {};
  const round16ResultsDoc = round16ResultsSnap.exists() ? round16ResultsSnap.data() : {};
  const quarterfinalResultsDoc = quarterfinalResultsSnap?.exists() ? quarterfinalResultsSnap.data() : {};
  const quarterfinalBonusResultsDoc = quarterfinalBonusResultsSnap?.exists() ? quarterfinalBonusResultsSnap.data() : {};
  const semifinalResultsDoc = semifinalResultsSnap?.exists() ? semifinalResultsSnap.data() : {};
  const semifinalBonusResultsDoc = semifinalBonusResultsSnap?.exists() ? semifinalBonusResultsSnap.data() : {};
  const finalsResultsDoc = finalsResultsSnap?.exists() ? finalsResultsSnap.data() : {};
  const finalsBonusResultsDoc = finalsBonusResultsSnap?.exists() ? finalsBonusResultsSnap.data() : {};
  const bonusResultsDoc = bonusResultsSnap.exists() ? bonusResultsSnap.data() : {};

  const groupResults = groupResultsDoc.results || {};
  const round32Results = round32ResultsDoc.results || {};
  const publicRound32RevealableMatchIds = round32Matches
    .filter(match => round32PickIsRevealable(match, round32Results))
    .map(match => match.id);
  const round32BonusResults = round32BonusResultsDoc.results || {};
  const round16Results = round16ResultsDoc.results || {};
  const publicRound16RevealableMatchIds = round16Matches
    .filter(match => round16PickIsRevealable(match))
    .map(match => match.id);
  const quarterfinalResults = quarterfinalResultsDoc.results || {};
  const publicQuarterfinalRevealableMatchIds = quarterfinalMatches
    .filter(match => quarterfinalPickIsRevealable(match))
    .map(match => match.id);
  const publicQuarterfinalMatchupLabels = Object.fromEntries(
    quarterfinalMatches.map(match => [
      match.id,
      quarterfinalMatchupLabel(match, round16Results, round32Results)
    ])
  );
  const publicQuarterfinalBonusRevealable = quarterfinalBonusAnswersAreRevealable();
  const quarterfinalBonusResults = quarterfinalBonusResultsDoc.results || {};
  const publicQuarterfinalBonusCorrectAnswers = quarterfinalBonusCorrectAnswersFor(
    quarterfinalResults,
    round16Results,
    round32Results,
    quarterfinalBonusResults
  );
  const semifinalResults = semifinalResultsDoc.results || {};
  const publicSemifinalRevealableMatchIds = semifinalMatches
    .filter(match => semifinalPickIsRevealable(match))
    .map(match => match.id);
  const publicSemifinalBonusRevealable = semifinalBonusAnswersAreRevealable();
  const semifinalBonusResults = semifinalBonusResultsDoc.results || {};
  const finalsResults = finalsResultsDoc.results || {};
  const publicFinalsRevealableMatchIds = finalsMatches
    .filter(match => finalsPickIsRevealable(match))
    .map(match => match.id);
  const publicFinalsBonusRevealable = finalsBonusAnswersAreRevealable();
  const finalsBonusResults = finalsBonusResultsDoc.results || {};
  const bonusResults = bonusResultsDoc.results || {};

  const users = {};
  usersSnap.forEach(docSnap => {
    const u = docSnap.data();
    users[u.uid] = {
      username: u.username || "",
      googleDisplayName: u.googleDisplayName || "",
      email: u.email || "",
      rootingForCountries: Array.isArray(u.rootingForCountries)
        ? u.rootingForCountries.map(canonicalCountryOptionValue)
        : [],
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
        rootingForCountries: user.rootingForCountries.map(canonicalCountryOptionValue),
        publicRound32Picks: {},
        publicRound32RevealableMatchIds,
        publicRound32PickPoints: {},
        publicRound32BonusAnswers: {},
        publicRound32BonusPointDetails: {},
        publicRound16Picks: {},
        publicRound16RevealableMatchIds,
        publicRound16PickPoints: {},
        publicRound16BonusAnswers: {},
        publicRound16BonusPointDetails: {},
        publicQuarterfinalPicks: {},
        publicQuarterfinalRevealableMatchIds,
        publicQuarterfinalMatchupLabels,
        publicQuarterfinalPickPoints: {},
        publicQuarterfinalBonusAnswers: {},
        publicQuarterfinalBonusPointDetails: {},
        publicQuarterfinalBonusRevealable,
        publicQuarterfinalBonusCorrectAnswers,
        publicSemifinalPicks: {},
        publicSemifinalRevealableMatchIds,
        publicSemifinalPickPoints: {},
        publicSemifinalBonusAnswers: {},
        publicSemifinalBonusPointDetails: {},
        publicSemifinalBonusRevealable,
        publicFinalsPicks: {},
        publicFinalsRevealableMatchIds,
        publicFinalsPickPoints: {},
        publicFinalsBonusAnswers: {},
        publicFinalsBonusPointDetails: {},
        publicFinalsBonusRevealable,
        match_points: 0,
        group_points: 0,
        bonus_points: 0,
        total_points: 0,
        scoringData: {
          groupPicks: {},
          round32Picks: {},
          round16Picks: {},
          quarterfinalPicks: {},
          semifinalPicks: {},
          finalsPicks: {},
          round32BonusAnswers: {},
          round16BonusAnswers: {},
          quarterfinalBonusAnswers: {},
          semifinalBonusAnswers: {},
          finalsBonusAnswers: {},
          bonusAnswers: {},
          groupResults,
          groupResultsDateKey: dateKeyFromValue(groupResultsDoc.updatedAt),
          round32Results,
          round32BonusResults,
          round32BonusResultsDateKey:
            dateKeyFromValue(round32BonusResultsDoc.updatedAt) || roundLastMatchDateKey(round32Matches),
          round16Results,
          round16ResultsDateKey:
            dateKeyFromValue(round16ResultsDoc.updatedAt) || roundLastMatchDateKey(round16Matches),
          quarterfinalResults,
          quarterfinalBonusResults,
          quarterfinalResultsDateKey:
            dateKeyFromValue(quarterfinalResultsDoc.updatedAt) || roundLastMatchDateKey(quarterfinalMatches),
          quarterfinalBonusResultsDateKey:
            dateKeyFromValue(quarterfinalBonusResultsDoc.updatedAt) || dateKeyFromValue(quarterfinalResultsDoc.updatedAt) || roundLastMatchDateKey(quarterfinalMatches),
          semifinalResults,
          semifinalResultsDateKey:
            dateKeyFromValue(semifinalResultsDoc.updatedAt) || roundLastMatchDateKey(semifinalMatches),
          semifinalBonusResults,
          semifinalBonusResultsDateKey:
            dateKeyFromValue(semifinalBonusResultsDoc.updatedAt) || roundLastMatchDateKey(semifinalMatches),
          finalsResults,
          finalsResultsDateKey:
            dateKeyFromValue(finalsResultsDoc.updatedAt) || roundLastMatchDateKey(finalsMatches),
          finalsBonusResults,
          finalsBonusResultsDateKey:
            dateKeyFromValue(finalsBonusResultsDoc.updatedAt) || roundLastMatchDateKey(finalsMatches),
          bonusResults,
          bonusResultsDateKey: dateKeyFromValue(bonusResultsDoc.updatedAt)
        }
      };
    }

    return scores[uid];
  }

  groupPicksSnap.forEach(docSnap => {
    const data = docSnap.data();
    const player = ensurePlayer(data.uid, data.email);
    if (!player) return;
    player.scoringData.groupPicks = data.picks || {};

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
    player.scoringData.round32Picks = data.picks || {};

    Object.entries(data.picks || {}).forEach(([matchId, pick]) => {
      if (!pick?.winner) return;

      player.publicRound32Picks[matchId] = {
        winner: pick.winner,
        extraTimeOrPenalties: !!pick.extraTimeOrPenalties
      };
      player.publicRound32PickPoints[matchId] = round32PickPointsFor(matchId, pick, round32Results);
    });

    player.match_points += scoreRound32Picks(data.picks, round32Results);
  });

  round16PicksSnap.forEach(docSnap => {
    const data = docSnap.data();
    const player = ensurePlayer(data.uid, data.email);
    if (!player) return;
    player.scoringData.round16Picks = data.picks || {};

    Object.entries(data.picks || {}).forEach(([matchId, pick]) => {
      if (!pick?.winner) return;

      player.publicRound16Picks[matchId] = {
        winner: pick.winner,
        score: normalizeWinnerFirstScore(pick.score),
        extraTimeOrPenalties: !!pick.extraTimeOrPenalties
      };
      player.publicRound16PickPoints[matchId] = round16PickPointsFor(matchId, pick, round16Results);
    });

    player.match_points += scoreRound16Picks(data.picks, round16Results);
  });

  quarterfinalPicksSnap.forEach(docSnap => {
    const data = docSnap.data();
    const player = ensurePlayer(data.uid, data.email);
    if (!player) return;
    player.scoringData.quarterfinalPicks = data.picks || {};

    Object.entries(data.picks || {}).forEach(([matchId, pick]) => {
      if (!pick?.winner) return;

      player.publicQuarterfinalPicks[matchId] = {
        winner: pick.winner,
        score: normalizeWinnerFirstScore(pick.score),
        extraTimeOrPenalties: !!pick.extraTimeOrPenalties
      };
      player.publicQuarterfinalPickPoints[matchId] = quarterfinalPickPointsFor(matchId, pick, quarterfinalResults);
    });

    player.match_points += scoreQuarterfinalPicks(data.picks, quarterfinalResults);
  });

  semifinalPicksSnap.forEach(docSnap => {
    const data = docSnap.data();
    const player = ensurePlayer(data.uid, data.email);
    if (!player) return;
    player.scoringData.semifinalPicks = data.picks || {};

    Object.entries(data.picks || {}).forEach(([matchId, pick]) => {
      if (!pick?.winner) return;

      player.publicSemifinalPicks[matchId] = {
        winner: pick.winner,
        score: normalizeWinnerFirstScore(pick.score),
        extraTimeOrPenalties: !!pick.extraTimeOrPenalties
      };
      player.publicSemifinalPickPoints[matchId] = semifinalPickPointsFor(matchId, pick, semifinalResults);
    });

    player.match_points += scoreSemifinalPicks(data.picks, semifinalResults);
  });

  finalsPicksSnap.forEach(docSnap => {
    const data = docSnap.data();
    const player = ensurePlayer(data.uid, data.email);
    if (!player) return;
    player.scoringData.finalsPicks = data.picks || {};

    Object.entries(data.picks || {}).forEach(([matchId, pick]) => {
      if (!pick?.winner) return;

      player.publicFinalsPicks[matchId] = {
        winner: pick.winner,
        score: normalizeWinnerFirstScore(pick.score),
        extraTimeOrPenalties: !!pick.extraTimeOrPenalties
      };
      player.publicFinalsPickPoints[matchId] = finalsPickPointsFor(matchId, pick, finalsResults);
    });

    player.match_points += scoreFinalsPicks(data.picks, finalsResults);
  });

  round32BonusAnswersSnap.forEach(docSnap => {
    const data = docSnap.data();
    const player = ensurePlayer(data.uid, data.email);
    if (!player) return;
    player.publicRound32BonusAnswers = data.answers || {};
    player.publicRound32BonusPointDetails = round32BonusPointDetailsFor(data.answers || {}, round32BonusResults, round32Results);
    player.scoringData.round32BonusAnswers = data.answers || {};

    player.bonus_points += scoreRound32BonusAnswers(data.answers, round32BonusResults);
  });

  round16BonusAnswersSnap.forEach(docSnap => {
    const data = docSnap.data();
    const player = ensurePlayer(data.uid, data.email);
    if (!player) return;
    player.publicRound16BonusAnswers = data.answers || {};
    player.publicRound16BonusPointDetails = round16BonusPointDetailsFor(data.answers || {}, round16Results, round32Results);
    player.scoringData.round16BonusAnswers = data.answers || {};

    player.bonus_points += scoreRound16BonusAnswers(data.answers, round16Results, round32Results);
  });

  quarterfinalBonusAnswersSnap.forEach(docSnap => {
    const data = docSnap.data();
    const player = ensurePlayer(data.uid, data.email);
    if (!player) return;
    player.publicQuarterfinalBonusAnswers = data.answers || {};
    player.publicQuarterfinalBonusPointDetails = quarterfinalBonusPointDetailsFor(
      data.answers || {},
      quarterfinalResults,
      round16Results,
      round32Results,
      quarterfinalBonusResults
    );
    player.scoringData.quarterfinalBonusAnswers = data.answers || {};

    player.bonus_points += scoreQuarterfinalBonusAnswers(
      data.answers,
      quarterfinalResults,
      round16Results,
      round32Results,
      quarterfinalBonusResults
    );
  });

  semifinalBonusAnswersSnap.forEach(docSnap => {
    const data = docSnap.data();
    const player = ensurePlayer(data.uid, data.email);
    if (!player) return;
    player.publicSemifinalBonusAnswers = data.answers || {};
    player.publicSemifinalBonusPointDetails = semifinalBonusPointDetailsFor(data.answers || {}, semifinalBonusResults);
    player.scoringData.semifinalBonusAnswers = data.answers || {};

    player.bonus_points += scoreSemifinalBonusAnswers(data.answers, semifinalBonusResults);
  });

  finalsBonusAnswersSnap.forEach(docSnap => {
    const data = docSnap.data();
    const player = ensurePlayer(data.uid, data.email);
    if (!player) return;
    player.publicFinalsBonusAnswers = data.answers || {};
    player.publicFinalsBonusPointDetails = finalsBonusPointDetailsFor(data.answers || {}, finalsBonusResults);
    player.scoringData.finalsBonusAnswers = data.answers || {};

    player.bonus_points += scoreFinalsBonusAnswers(data.answers, finalsBonusResults);
  });

  bonusAnswersSnap.forEach(docSnap => {
    const data = docSnap.data();
    const player = ensurePlayer(data.uid, data.email);
    if (!player) return;
    player.scoringData.bonusAnswers = data.answers || {};

    player.bonus_points += scoreBonusAnswers(data.answers, bonusResults);
  });

  Object.values(scores).forEach(player => {
    player.total_points = player.group_points + player.match_points + player.bonus_points;
    player.publicScoringEntries = buildScoringBreakdownEntries(player.scoringData);
    delete player.scoringData;
  });

  let rows = Object.values(scores).map(row => applyDailyScoringDeltas(row));
  if (currentUserIsAdmin()) {
    rows = await applyDailyLeaderboardMovement(rows);
  } else {
    rows = await attachPublishedDailyMovement(rows);
  }

  renderLeaderboard(rows);

  if (currentUserIsAdmin()) {
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
      <td>${matchPoints}${renderPointDelta(r.match_points_delta)}</td>
      <td>${r.bonus_points}${renderPointDelta(r.bonus_points_delta)}</td>
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

async function loadPlayerScoringBreakdownData(uid) {
  const [
    groupPicksSnap,
    round32PicksSnap,
    round16PicksSnap,
    quarterfinalPicksSnap,
    semifinalPicksSnap,
    finalsPicksSnap,
    round32BonusAnswersSnap,
    round16BonusAnswersSnap,
    quarterfinalBonusAnswersSnap,
    semifinalBonusAnswersSnap,
    finalsBonusAnswersSnap,
    bonusAnswersSnap,
    groupResultsSnap,
    round32ResultsSnap,
    round32BonusResultsSnap,
    round16ResultsSnap,
    quarterfinalResultsSnap,
    quarterfinalBonusResultsSnap,
    semifinalResultsSnap,
    semifinalBonusResultsSnap,
    finalsResultsSnap,
    finalsBonusResultsSnap,
    bonusResultsSnap
  ] = await Promise.all([
    getDoc(doc(db, "groupPicks", uid)),
    getDoc(doc(db, "round32Picks", uid)),
    getDoc(doc(db, "round16Picks", uid)),
    getOptionalDoc("quarterfinalPicks", uid),
    getOptionalDoc("semifinalPicks", uid),
    getOptionalDoc("finalsPicks", uid),
    getDoc(doc(db, "round32BonusAnswers", uid)),
    getDoc(doc(db, "round16BonusAnswers", uid)),
    getOptionalDoc("quarterfinalBonusAnswers", uid),
    getOptionalDoc("semifinalBonusAnswers", uid),
    getOptionalDoc("finalsBonusAnswers", uid),
    getDoc(doc(db, "bonusAnswers", uid)),
    getDoc(doc(db, "groupResults", "official")),
    getDoc(doc(db, "round32Results", "official")),
    getDoc(doc(db, "round32BonusResults", "official")),
    getDoc(doc(db, "round16Results", "official")),
    getOptionalDoc("quarterfinalResults", "official"),
    getOptionalDoc("quarterfinalBonusResults", "official"),
    getOptionalDoc("semifinalResults", "official"),
    getOptionalDoc("semifinalBonusResults", "official"),
    getOptionalDoc("finalsResults", "official"),
    getOptionalDoc("finalsBonusResults", "official"),
    getDoc(doc(db, "bonusResults", "official"))
  ]);

  const groupResultsDoc = groupResultsSnap.exists() ? groupResultsSnap.data() : {};
  const round32BonusResultsDoc = round32BonusResultsSnap.exists() ? round32BonusResultsSnap.data() : {};
  const round16ResultsDoc = round16ResultsSnap.exists() ? round16ResultsSnap.data() : {};
  const quarterfinalResultsDoc = quarterfinalResultsSnap?.exists() ? quarterfinalResultsSnap.data() : {};
  const quarterfinalBonusResultsDoc = quarterfinalBonusResultsSnap?.exists() ? quarterfinalBonusResultsSnap.data() : {};
  const semifinalResultsDoc = semifinalResultsSnap?.exists() ? semifinalResultsSnap.data() : {};
  const semifinalBonusResultsDoc = semifinalBonusResultsSnap?.exists() ? semifinalBonusResultsSnap.data() : {};
  const finalsResultsDoc = finalsResultsSnap?.exists() ? finalsResultsSnap.data() : {};
  const finalsBonusResultsDoc = finalsBonusResultsSnap?.exists() ? finalsBonusResultsSnap.data() : {};
  const bonusResultsDoc = bonusResultsSnap.exists() ? bonusResultsSnap.data() : {};

  return {
    groupPicks: groupPicksSnap.exists() ? groupPicksSnap.data().picks || {} : {},
    round32Picks: round32PicksSnap.exists() ? round32PicksSnap.data().picks || {} : {},
    round16Picks: round16PicksSnap.exists() ? round16PicksSnap.data().picks || {} : {},
    quarterfinalPicks: quarterfinalPicksSnap?.exists() ? quarterfinalPicksSnap.data().picks || {} : {},
    semifinalPicks: semifinalPicksSnap?.exists() ? semifinalPicksSnap.data().picks || {} : {},
    finalsPicks: finalsPicksSnap?.exists() ? finalsPicksSnap.data().picks || {} : {},
    round32BonusAnswers: round32BonusAnswersSnap.exists() ? round32BonusAnswersSnap.data().answers || {} : {},
    round16BonusAnswers: round16BonusAnswersSnap.exists() ? round16BonusAnswersSnap.data().answers || {} : {},
    quarterfinalBonusAnswers: quarterfinalBonusAnswersSnap?.exists() ? quarterfinalBonusAnswersSnap.data().answers || {} : {},
    semifinalBonusAnswers: semifinalBonusAnswersSnap?.exists() ? semifinalBonusAnswersSnap.data().answers || {} : {},
    finalsBonusAnswers: finalsBonusAnswersSnap?.exists() ? finalsBonusAnswersSnap.data().answers || {} : {},
    bonusAnswers: bonusAnswersSnap.exists() ? bonusAnswersSnap.data().answers || {} : {},
    groupResults: groupResultsDoc.results || {},
    groupResultsDateKey: dateKeyFromValue(groupResultsDoc.updatedAt),
    round32Results: round32ResultsSnap.exists() ? round32ResultsSnap.data().results || {} : {},
    round32BonusResults: round32BonusResultsDoc.results || {},
    round32BonusResultsDateKey:
      dateKeyFromValue(round32BonusResultsDoc.updatedAt) || roundLastMatchDateKey(round32Matches),
    round16Results: round16ResultsDoc.results || {},
    round16ResultsDateKey:
      dateKeyFromValue(round16ResultsDoc.updatedAt) || roundLastMatchDateKey(round16Matches),
    quarterfinalResults: quarterfinalResultsDoc.results || {},
    quarterfinalBonusResults: quarterfinalBonusResultsDoc.results || {},
    quarterfinalResultsDateKey:
      dateKeyFromValue(quarterfinalResultsDoc.updatedAt) || roundLastMatchDateKey(quarterfinalMatches),
    quarterfinalBonusResultsDateKey:
      dateKeyFromValue(quarterfinalBonusResultsDoc.updatedAt) || dateKeyFromValue(quarterfinalResultsDoc.updatedAt) || roundLastMatchDateKey(quarterfinalMatches),
    semifinalResults: semifinalResultsDoc.results || {},
    semifinalResultsDateKey:
      dateKeyFromValue(semifinalResultsDoc.updatedAt) || roundLastMatchDateKey(semifinalMatches),
    semifinalBonusResults: semifinalBonusResultsDoc.results || {},
    semifinalBonusResultsDateKey:
      dateKeyFromValue(semifinalBonusResultsDoc.updatedAt) || roundLastMatchDateKey(semifinalMatches),
    finalsResults: finalsResultsDoc.results || {},
    finalsResultsDateKey:
      dateKeyFromValue(finalsResultsDoc.updatedAt) || roundLastMatchDateKey(finalsMatches),
    finalsBonusResults: finalsBonusResultsDoc.results || {},
    finalsBonusResultsDateKey:
      dateKeyFromValue(finalsBonusResultsDoc.updatedAt) || roundLastMatchDateKey(finalsMatches),
    bonusResults: bonusResultsDoc.results || {},
    bonusResultsDateKey: dateKeyFromValue(bonusResultsDoc.updatedAt)
  };
}

function buildGroupScoringEntries(data) {
  const entries = [];

  Object.entries(data.groupPicks || {}).forEach(([groupName, pick]) => {
    const result = data.groupResults[groupName];
    if (!result) return;

    [
      ["Pick #1", pick.first],
      ["Pick #2", pick.second]
    ].forEach(([slotLabel, team]) => {
      if (!team) return;

      if (sameCountryOption(team, result.first) || sameCountryOption(team, result.second)) {
        addScoringEntry(
          entries,
          data.groupResultsDateKey,
          "Match",
          `Group ${groupName}: ${countryOptionLabel(team)}`,
          `${slotLabel} finished top 2`,
          2
        );
      } else if (sameCountryOption(team, result.third) && result.thirdQualified) {
        addScoringEntry(
          entries,
          data.groupResultsDateKey,
          "Match",
          `Group ${groupName}: ${countryOptionLabel(team)}`,
          `${slotLabel} finished 3rd and qualified`,
          1
        );
      }
    });
  });

  return entries;
}

function buildRound32ScoringEntries(data) {
  const entries = [];

  Object.entries(data.round32Picks || {}).forEach(([matchId, pick]) => {
    const match = round32Matches.find(item => item.id === matchId);
    const result = data.round32Results[matchId];
    if (!match || !pick || !result?.winner) return;

    const item = round32MatchupLabel(match);
    const winnerCorrect = sameCountryOption(pick.winner, result.winner);
    if (winnerCorrect) {
      addScoringEntry(entries, matchDateKey(match), "Match", item, "Winner pick", 3);
    }

    if (pick.extraTimeOrPenalties) {
      addScoringEntry(
        entries,
        matchDateKey(match),
        "Match",
        item,
        "Extra time / penalties pick",
        result.extraTimeOrPenalties ? 1 : -1
      );
    }
  });

  return entries;
}

function buildRound16ScoringEntries(data) {
  const entries = [];

  Object.entries(data.round16Picks || {}).forEach(([matchId, pick]) => {
    const match = round16Matches.find(item => item.id === matchId);
    const result = data.round16Results[matchId];
    if (!match || !pick || !result?.winner) return;

    const item = round16MatchupLabel(match, data.round32Results);
    const winnerCorrect = sameCountryOption(pick.winner, result.winner);
    if (winnerCorrect) {
      addScoringEntry(entries, matchDateKey(match), "Match", item, "Winner pick", 3);
    }

    const pickScore = normalizeWinnerFirstScore(pick.score);
    const resultScore = normalizeWinnerFirstScore(result.score);
    if (
      winnerCorrect &&
      parseWinnerFirstScore(pickScore) &&
      parseWinnerFirstScore(resultScore) &&
      pickScore === resultScore
    ) {
      addScoringEntry(entries, matchDateKey(match), "Match", item, "Exact final score", 2);
    }

    if (pick.extraTimeOrPenalties) {
      addScoringEntry(
        entries,
        matchDateKey(match),
        "Match",
        item,
        "Extra time / penalties pick",
        result.extraTimeOrPenalties ? 1 : -1
      );
    }
  });

  return entries;
}

function buildQuarterfinalScoringEntries(data) {
  const entries = [];

  Object.entries(data.quarterfinalPicks || {}).forEach(([matchId, pick]) => {
    const match = quarterfinalMatches.find(item => item.id === matchId);
    const result = data.quarterfinalResults[matchId];
    if (!match || !pick || !result?.winner) return;

    const item = quarterfinalMatchupLabel(match, data.round16Results, data.round32Results);
    const winnerCorrect = sameCountryOption(pick.winner, result.winner);
    if (winnerCorrect) {
      addScoringEntry(entries, matchDateKey(match), "Match", item, "Winner pick", 3);
    }

    const pickScore = normalizeWinnerFirstScore(pick.score);
    const resultScore = normalizeWinnerFirstScore(result.score);
    if (
      winnerCorrect &&
      parseWinnerFirstScore(pickScore) &&
      parseWinnerFirstScore(resultScore) &&
      pickScore === resultScore
    ) {
      addScoringEntry(entries, matchDateKey(match), "Match", item, "Exact final score", 2);
    }

    if (pick.extraTimeOrPenalties) {
      addScoringEntry(
        entries,
        matchDateKey(match),
        "Match",
        item,
        "Extra time / penalties pick",
        result.extraTimeOrPenalties ? 1 : -1
      );
    }
  });

  return entries;
}

function buildRound32BonusScoringEntries(data) {
  const entries = [];
  const answers = data.round32BonusAnswers || {};
  const results = data.round32BonusResults || {};
  const dateKey = data.round32BonusResultsDateKey;

  const extraTimePoints = scoreExactOrWithinTwo(
    answers.extraTimeOrPenaltiesCount,
    results.extraTimeOrPenaltiesCount
  );
  addScoringEntry(
    entries,
    dateKey,
    "Bonus",
    "Round of 32 bonus: extra time / penalties count",
    exactWithinTwoLabel(extraTimePoints),
    extraTimePoints
  );

  const redCardsPoints = scoreExactOrWithinTwo(answers.redCards, results.redCards);
  addScoringEntry(
    entries,
    dateKey,
    "Bonus",
    "Round of 32 bonus: red cards",
    exactWithinTwoLabel(redCardsPoints),
    redCardsPoints
  );

  const officialThreeGoalWinners = Array.isArray(results.threeGoalWinners)
    ? results.threeGoalWinners
    : [];
  const userThreeGoalWinners = Array.isArray(answers.threeGoalWinners)
    ? answers.threeGoalWinners
    : [answers.threeGoalWinner].filter(Boolean);

  [...new Set(userThreeGoalWinners.filter(Boolean))].forEach(team => {
    if (officialThreeGoalWinners.some(resultTeam => sameCountryOption(team, resultTeam))) {
      addScoringEntry(
        entries,
        dateKey,
        "Bonus",
        `Round of 32 bonus: ${countryOptionLabel(team)} won by 3+ goals`,
        "Correct team",
        2
      );
    }
  });

  return entries;
}

function buildRound16BonusScoringEntries(data) {
  const entries = [];
  const answers = data.round16BonusAnswers || {};
  const results = data.round16Results || {};
  const dateKey = data.round16ResultsDateKey;
  if (!round16BonusResultsAreComplete(results)) return entries;

  const mostGoalsMatchIds = calculateRound16MostGoalsMatchIds(results);
  if (answers.mostGoalsMatch && mostGoalsMatchIds.includes(answers.mostGoalsMatch)) {
    const match = round16Matches.find(item => item.id === answers.mostGoalsMatch);
    addScoringEntry(
      entries,
      dateKey,
      "Bonus",
      "Round of 16 bonus: most total goals match",
      match ? round16MatchupLabel(match, data.round32Results) : `Match ${answers.mostGoalsMatch}`,
      2
    );
  }

  const cleanSheetsPoints = scoreExactOrWithinOne(
    answers.cleanSheets,
    calculateRound16CleanSheets(results)
  );
  addScoringEntry(
    entries,
    dateKey,
    "Bonus",
    "Round of 16 bonus: clean sheets",
    exactWithinOneLabel(cleanSheetsPoints),
    cleanSheetsPoints
  );

  const actualRegionOrder = calculateRound16RegionOrder(results, data.round32Results);
  const answerRegionOrder = Array.isArray(answers.regionOrder) ? answers.regionOrder : [];
  answerRegionOrder.forEach((region, index) => {
    if (region && region === actualRegionOrder[index]) {
      addScoringEntry(
        entries,
        dateKey,
        "Bonus",
        `Round of 16 bonus: region rank #${index + 1}`,
        region,
        1
      );
    }
  });

  return entries;
}

function buildQuarterfinalBonusScoringEntries(data) {
  const entries = [];
  const answers = data.quarterfinalBonusAnswers || {};
  const results = data.quarterfinalResults || {};
  const manualKey = data.quarterfinalBonusResults || {};
  const hasManualKey = quarterfinalManualBonusKeyIsComplete(manualKey);
  const dateKey = hasManualKey
    ? data.quarterfinalBonusResultsDateKey
    : data.quarterfinalResultsDateKey;
  if (!hasManualKey && !quarterfinalBonusResultsAreComplete(results)) return entries;

  const key = hasManualKey
    ? normalizeQuarterfinalManualBonusKey(manualKey)
    : getQuarterfinalBonusAnswerKey(results, data.round16Results, data.round32Results);
  if (!key) return entries;

  if (answers.anyCleanSheet && answers.anyCleanSheet === (key.anyCleanSheet ? "yes" : "no")) {
    addScoringEntry(
      entries,
      dateKey,
      "Bonus",
      "Quarterfinals bonus: any clean sheet",
      key.anyCleanSheet ? "Yes" : "No",
      QUARTERFINAL_BONUS_POINTS
    );
  }

  if (
    answers.mostGoalsTeam &&
    key.mostGoalsTeams.some(team => sameCountryOption(answers.mostGoalsTeam, team))
  ) {
    addScoringEntry(
      entries,
      dateKey,
      "Bonus",
      "Quarterfinals bonus: most goals team",
      countryOptionLabel(answers.mostGoalsTeam),
      QUARTERFINAL_BONUS_POINTS
    );
  }

  if (answers.mostFreeKicksMatch && key.mostFreeKicksMatchIds.includes(answers.mostFreeKicksMatch)) {
    const match = quarterfinalMatches.find(item => item.id === answers.mostFreeKicksMatch);
    addScoringEntry(
      entries,
      dateKey,
      "Bonus",
      "Quarterfinals bonus: most free kicks match",
      match ? quarterfinalMatchupLabel(match, data.round16Results, data.round32Results) : `Match ${answers.mostFreeKicksMatch}`,
      QUARTERFINAL_BONUS_POINTS
    );
  }

  return entries;
}

function buildSemifinalScoringEntries(data) {
  const entries = [];

  Object.entries(data.semifinalPicks || {}).forEach(([matchId, pick]) => {
    const match = semifinalMatches.find(item => item.id === matchId);
    const result = data.semifinalResults[matchId];
    if (!match || !pick || !result?.winner) return;

    const item = semifinalMatchupLabel(match);
    const winnerCorrect = sameCountryOption(pick.winner, result.winner);
    if (winnerCorrect) {
      addScoringEntry(entries, matchDateKey(match), "Match", item, "Winner pick", 3);
    }

    const pickScore = normalizeWinnerFirstScore(pick.score);
    const resultScore = normalizeWinnerFirstScore(result.score);
    if (
      winnerCorrect &&
      parseWinnerFirstScore(pickScore) &&
      parseWinnerFirstScore(resultScore) &&
      pickScore === resultScore
    ) {
      addScoringEntry(entries, matchDateKey(match), "Match", item, "Exact final score", 2);
    }

    if (pick.extraTimeOrPenalties) {
      addScoringEntry(
        entries,
        matchDateKey(match),
        "Match",
        item,
        "Extra time / penalties pick",
        result.extraTimeOrPenalties ? 1 : -1
      );
    }
  });

  return entries;
}

function buildSemifinalBonusScoringEntries(data) {
  const entries = [];
  const answers = data.semifinalBonusAnswers || {};
  const results = getSemifinalBonusScoringKey(data.semifinalBonusResults || {});
  const dateKey = data.semifinalBonusResultsDateKey || data.semifinalResultsDateKey;
  if (!semifinalBonusKeyIsComplete(results)) return entries;

  if (answers.moreGoalsMatch && results.moreGoalsMatch !== "tie" && answers.moreGoalsMatch === results.moreGoalsMatch) {
    const match = semifinalMatches.find(item => item.id === answers.moreGoalsMatch);
    addScoringEntry(
      entries,
      dateKey,
      "Bonus",
      "Semifinal bonus: more total goals",
      match ? semifinalMatchupLabel(match) : "",
      SEMIFINAL_BONUS_POINTS
    );
  }

  if (answers.moreCornerKicksMatch && results.moreCornerKicksMatch !== "tie" && answers.moreCornerKicksMatch === results.moreCornerKicksMatch) {
    const match = semifinalMatches.find(item => item.id === answers.moreCornerKicksMatch);
    addScoringEntry(
      entries,
      dateKey,
      "Bonus",
      "Semifinal bonus: more corner kicks",
      match ? semifinalMatchupLabel(match) : "",
      SEMIFINAL_BONUS_POINTS
    );
  }

  [
    ["mostShotsOnTargetTeam", "mostShotsOnTargetTeams", "Semifinal bonus: most shots on target"],
    ["mostYellowCardsTeam", "mostYellowCardsTeams", "Semifinal bonus: most yellow cards"],
    ["mostPassesTeam", "mostPassesTeams", "Semifinal bonus: most completed passes"]
  ].forEach(([answerKey, resultKey, label]) => {
    const answer = answers[answerKey];
    if (answer && results[resultKey].some(team => sameCountryOption(answer, team))) {
      addScoringEntry(entries, dateKey, "Bonus", label, round32TeamLabel(answer), SEMIFINAL_BONUS_POINTS);
    }
  });

  return entries;
}

function buildFinalsScoringEntries(data) {
  const entries = [];

  Object.entries(data.finalsPicks || {}).forEach(([matchId, pick]) => {
    const match = finalsMatches.find(item => item.id === matchId);
    const result = data.finalsResults[matchId];
    if (!match || !pick || !result?.winner) return;

    const item = finalsMatchupLabel(match);
    const winnerCorrect = sameCountryOption(pick.winner, result.winner);
    if (winnerCorrect) {
      addScoringEntry(entries, matchDateKey(match), "Match", item, "Winner pick", 3);
    }

    const pickScore = normalizeWinnerFirstScore(pick.score);
    const resultScore = normalizeWinnerFirstScore(result.score);
    if (
      winnerCorrect &&
      parseWinnerFirstScore(pickScore) &&
      parseWinnerFirstScore(resultScore) &&
      pickScore === resultScore
    ) {
      addScoringEntry(entries, matchDateKey(match), "Match", item, "Exact final score", 2);
    }

    if (pick.extraTimeOrPenalties) {
      addScoringEntry(
        entries,
        matchDateKey(match),
        "Match",
        item,
        "Extra time / penalties pick",
        result.extraTimeOrPenalties ? 1 : -1
      );
    }
  });

  return entries;
}

function buildFinalsBonusScoringEntries(data) {
  const entries = [];
  const answers = data.finalsBonusAnswers || {};
  const results = data.finalsBonusResults || {};
  const dateKey = data.finalsBonusResultsDateKey || data.finalsResultsDateKey;
  const details = finalsBonusPointDetailsFor(answers, results);
  if (!finalsBonusKeyIsComplete(results)) return entries;

  addScoringEntry(
    entries,
    dateKey,
    "Bonus",
    "Finals bonus: combined shots on target",
    pointDetailLabel(details.combinedShotsOnTarget),
    details.combinedShotsOnTarget
  );

  addScoringEntry(
    entries,
    dateKey,
    "Bonus",
    "Finals bonus: more total goals match",
    answers.moreGoalsMatch ? finalsMatchAnswerLabel(answers.moreGoalsMatch) : "No answer",
    details.moreGoalsMatch
  );

  addScoringEntry(
    entries,
    dateKey,
    "Bonus",
    "Finals bonus: Final yellow cards",
    pointDetailLabel(details.finalYellowCards),
    details.finalYellowCards
  );

  addScoringEntry(
    entries,
    dateKey,
    "Bonus",
    "Finals bonus: most attempts at goal",
    answers.mostAttemptsTeam ? round32TeamLabel(answers.mostAttemptsTeam) : "No answer",
    details.mostAttemptsTeam
  );

  return entries;
}

function buildOpeningBonusScoringEntries(data) {
  const entries = [];
  const answers = data.bonusAnswers || {};
  const results = data.bonusResults || {};
  const dateKey = data.bonusResultsDateKey;

  if (openingMostGoalsCountryIsCorrect(answers.mostGoalsCountry, results)) {
    addScoringEntry(entries, dateKey, "Bonus", "Opening bonus: most goals country", countryOptionLabel(answers.mostGoalsCountry), 1);
  }

  const guessYellow = Number(answers.yellowCards);
  const actualYellow = Number(results.yellowCards);
  if (!Number.isNaN(guessYellow) && !Number.isNaN(actualYellow) && Math.abs(guessYellow - actualYellow) <= 10) {
    addScoringEntry(entries, dateKey, "Bonus", "Opening bonus: yellow cards", "Within 10", 1);
  }

  if (answers.usaOut && answers.usaOut === results.usaOut) {
    addScoringEntry(entries, dateKey, "Bonus", "Opening bonus: USA elimination round", answers.usaOut, 1);
  }

  if (
    answers.semifinalist &&
    Array.isArray(results.semifinalists) &&
    results.semifinalists.some(team => sameCountryOption(answers.semifinalist, team))
  ) {
    addScoringEntry(entries, dateKey, "Bonus", "Opening bonus: semifinalist", countryOptionLabel(answers.semifinalist), 1);
  }

  if (sameCountryOption(answers.winner, results.winner)) {
    addScoringEntry(entries, dateKey, "Bonus", "Opening bonus: champion", countryOptionLabel(answers.winner), 1);
  }

  return entries;
}

function buildScoringBreakdownEntries(data) {
  return [
    ...buildGroupScoringEntries(data),
    ...buildRound32ScoringEntries(data),
    ...buildRound16ScoringEntries(data),
    ...buildQuarterfinalScoringEntries(data),
    ...buildSemifinalScoringEntries(data),
    ...buildFinalsScoringEntries(data),
    ...buildRound32BonusScoringEntries(data),
    ...buildRound16BonusScoringEntries(data),
    ...buildQuarterfinalBonusScoringEntries(data),
    ...buildSemifinalBonusScoringEntries(data),
    ...buildFinalsBonusScoringEntries(data),
    ...buildOpeningBonusScoringEntries(data)
  ].sort((a, b) => {
    if (a.dateKey !== b.dateKey) return a.dateKey.localeCompare(b.dateKey);
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.item.localeCompare(b.item);
  });
}

function scoringEntriesForData(data) {
  return Array.isArray(data) ? data : buildScoringBreakdownEntries(data);
}

function defaultDailyPointsDateKey(data) {
  const todayKey = leaderboardDateKey();
  const entries = scoringEntriesForData(data).filter(entry => entry.dateKey);
  if (entries.some(entry => entry.dateKey === todayKey)) return todayKey;

  return entries
    .map(entry => entry.dateKey)
    .sort()
    .pop() || todayKey;
}

function renderAdminDailyPointsBreakdown(data, selectedDateKey) {
  const allEntries = scoringEntriesForData(data);
  const entries = allEntries
    .filter(entry => entry.dateKey === selectedDateKey);
  const matchPoints = entries
    .filter(entry => entry.category === "Match")
    .reduce((total, entry) => total + entry.points, 0);
  const bonusPoints = entries
    .filter(entry => entry.category === "Bonus")
    .reduce((total, entry) => total + entry.points, 0);
  const totalPoints = matchPoints + bonusPoints;

  if (!entries.length) {
    return `
      <div class="admin-daily-points-summary">
        <span>Match ${signedPointLabel(0)}</span>
        <span>Bonus ${signedPointLabel(0)}</span>
        <strong>Total ${signedPointLabel(0)}</strong>
      </div>
      <p class="mini-note">No scored items for this day.</p>
    `;
  }

  return `
    <div class="admin-daily-points-summary">
      <span>Match ${signedPointLabel(matchPoints)}</span>
      <span>Bonus ${signedPointLabel(bonusPoints)}</span>
      <strong>Total ${signedPointLabel(totalPoints)}</strong>
    </div>
    <table class="admin-player-table admin-daily-points-table">
      <thead>
        <tr>
          <th>Type</th>
          <th>Item</th>
          <th>Detail</th>
          <th>Pts</th>
        </tr>
      </thead>
      <tbody>
        ${entries.map(entry => `
          <tr>
            <td>${escapeHTML(entry.category)}</td>
            <td>${escapeHTML(entry.item)}</td>
            <td>${escapeHTML(entry.detail)}</td>
            <td class="${entry.points >= 0 ? "daily-points-positive" : "daily-points-negative"}">${signedPointLabel(entry.points)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderAdminDailyPointsPanel(data, selectedDateKey = defaultDailyPointsDateKey(data)) {
  return `
    <div class="admin-daily-points-panel">
      <div class="admin-daily-points-header">
        <div>
          <h3>Daily Points Breakdown</h3>
        </div>
        <label class="admin-date-control">
          Day
          <input id="adminDailyPointsDate" type="date" value="${escapeHTML(selectedDateKey)}" />
        </label>
      </div>
      <div id="adminDailyPointsBreakdown">
        ${renderAdminDailyPointsBreakdown(data, selectedDateKey)}
      </div>
    </div>
  `;
}

function renderPublicDailyPointsPanel(row = {}) {
  const entries = Array.isArray(row.publicScoringEntries) ? row.publicScoringEntries : [];
  if (entries.length) return renderAdminDailyPointsPanel(entries);

  const matchPoints = Number(row.match_points_delta || 0);
  const bonusPoints = Number(row.bonus_points_delta || 0);
  const totalPoints = matchPoints + bonusPoints;

  return `
    <div class="admin-daily-points-panel">
      <div class="admin-daily-points-header">
        <div>
          <h3>Daily Points Breakdown</h3>
        </div>
        <label class="admin-date-control">
          Day
          <input id="adminDailyPointsDate" type="date" value="${escapeHTML(leaderboardDateKey())}" disabled />
        </label>
      </div>
      <div id="adminDailyPointsBreakdown">
        <div class="admin-daily-points-summary">
          <span>Match ${signedPointLabel(matchPoints)}</span>
          <span>Bonus ${signedPointLabel(bonusPoints)}</span>
          <strong>Total ${signedPointLabel(totalPoints)}</strong>
        </div>
        <p class="mini-note">Detailed scored items will appear here after the next leaderboard refresh.</p>
      </div>
    </div>
  `;
}

function bindAdminDailyPointsPanel(data) {
  const input = document.getElementById("adminDailyPointsDate");
  const output = document.getElementById("adminDailyPointsBreakdown");
  if (!input || !output) return;

  input.addEventListener("change", () => {
    output.innerHTML = renderAdminDailyPointsBreakdown(data, input.value);
  });
}

function renderPlayerDrawerSection(title, contentHtml, startsExpanded = true) {
  return `
    <section class="player-drawer-section">
      <div class="player-drawer-section-header">
        <h3>${escapeHTML(title)}</h3>
        <button class="secondary-btn player-drawer-toggle">${startsExpanded ? "Minimize" : "Expand"}</button>
      </div>
      <div class="player-drawer-section-content" style="display:${startsExpanded ? "block" : "none"};">
        ${contentHtml}
      </div>
    </section>
  `;
}

function bindPlayerDrawerSections() {
  playerPicksContent.querySelectorAll(".player-drawer-section").forEach(section => {
    const button = section.querySelector(".player-drawer-toggle");
    const content = section.querySelector(".player-drawer-section-content");
    if (!button || !content) return;

    button.addEventListener("click", () => {
      const isHidden = content.style.display === "none";
      content.style.display = isHidden ? "block" : "none";
      button.textContent = isHidden ? "Minimize" : "Expand";
    });
  });
}

function renderPublicPickGrid(cardsHtml) {
  return `<div class="public-picks-grid">${cardsHtml}</div>`;
}

function renderPublicAnswerCard(title, answerHtml, note = "", points = null, correctHtml = "") {
  const hasPointResult = points !== null && points !== undefined;
  const verdictHtml = hasPointResult
    ? `<p class="${Number(points) > 0 ? "status-good" : "status-bad"}"><strong>${Number(points) > 0 ? "Correct" : "Wrong"}</strong></p>`
    : "";

  return `
    <div class="public-pick-card">
      <h3>${escapeHTML(title)}</h3>
      ${note ? `<p class="mini-note">${escapeHTML(note)}</p>` : ""}
      <p><strong>Your answer:</strong> ${answerHtml || `<span class="mini-note">No saved answer.</span>`}</p>
      ${correctHtml ? `<p><strong>Correct answer:</strong> ${correctHtml}</p>` : ""}
      ${verdictHtml}
      ${renderEarnedPoints(points)}
    </div>
  `;
}

function renderPublicGroupPicks(picks = {}) {
  return renderPublicPickGrid(
    Object.keys(groups).map(groupName => {
      const pick = picks[groupName] || {};
      return `
        <div class="public-pick-card">
          <h3>Group ${escapeHTML(groupName)}</h3>
          ${
            pick.first || pick.second
              ? `
                <p><strong>Pick #1:</strong> ${pick.first ? escapeHTML(countryOptionLabel(pick.first)) : `<span class="mini-note">No saved pick.</span>`}</p>
                <p><strong>Pick #2:</strong> ${pick.second ? escapeHTML(countryOptionLabel(pick.second)) : `<span class="mini-note">No saved pick.</span>`}</p>
              `
              : `<p class="mini-note">No saved picks for this group.</p>`
          }
        </div>
      `;
    }).join("")
  );
}

function renderPublicOpeningBonusAnswers(answers = {}, pointDetails = {}) {
  const correctAnswers = pointDetails.correctAnswers || {};

  return renderPublicPickGrid(`
    ${renderPublicAnswerCard(
      "Most goals country",
      answers.mostGoalsCountry ? escapeHTML(countryOptionLabel(answers.mostGoalsCountry)) : "",
      "",
      pointDetails.mostGoalsCountry,
      renderCorrectAnswerHtml(correctAnswers.mostGoalsCountry)
    )}
    ${renderPublicAnswerCard(
      "Yellow cards",
      answers.yellowCards !== "" && answers.yellowCards != null ? escapeHTML(String(answers.yellowCards)) : "",
      "Within 10 counts as correct.",
      pointDetails.yellowCards,
      renderCorrectAnswerHtml(correctAnswers.yellowCards)
    )}
    ${renderPublicAnswerCard(
      "USA elimination round",
      answers.usaOut ? escapeHTML(answers.usaOut) : "",
      "",
      pointDetails.usaOut,
      renderCorrectAnswerHtml(correctAnswers.usaOut)
    )}
    ${renderPublicAnswerCard(
      "Semifinalist",
      answers.semifinalist ? escapeHTML(countryOptionLabel(answers.semifinalist)) : "",
      "",
      pointDetails.semifinalist,
      renderCorrectAnswerHtml(correctAnswers.semifinalist)
    )}
    ${renderPublicAnswerCard(
      "World Cup winner",
      answers.winner ? escapeHTML(countryOptionLabel(answers.winner)) : "",
      "",
      pointDetails.winner,
      renderCorrectAnswerHtml(correctAnswers.winner)
    )}
  `);
}

function publicRound16BonusMatchLabel(matchId, round32Results = {}) {
  const match = round16Matches.find(item => item.id === matchId);
  return match ? round16MatchupLabel(match, round32Results) : "";
}

function publicQuarterfinalBonusMatchLabel(matchId, round16Results = {}, round32Results = {}) {
  const match = quarterfinalMatches.find(item => item.id === matchId);
  return match ? quarterfinalMatchupLabel(match, round16Results, round32Results) : "";
}

function renderPublicRound32BonusAnswers(answers = {}, pointDetails = {}, hasPublishedAnswers = true) {
  if (!hasPublishedAnswers) {
    return `
      <div class="public-pick-card">
        <h3>Round of 32 bonus answers</h3>
        <p class="mini-note">Detailed answers will appear here after the next leaderboard refresh.</p>
      </div>
    `;
  }

  const threeGoalWinners = Array.isArray(answers.threeGoalWinners)
    ? answers.threeGoalWinners
    : [answers.threeGoalWinner].filter(Boolean);
  const correctAnswers = pointDetails.correctAnswers || {};
  const threeGoalWinnerCorrectHtml = renderCorrectAnswerHtml(correctAnswers.threeGoalWinners);

  return renderPublicPickGrid(`
    ${renderPublicAnswerCard(
      "Extra time / penalties count",
      answers.extraTimeOrPenaltiesCount !== "" && answers.extraTimeOrPenaltiesCount != null
        ? escapeHTML(String(answers.extraTimeOrPenaltiesCount))
        : "",
      "",
      pointDetails.extraTimeOrPenaltiesCount,
      renderCorrectAnswerHtml(correctAnswers.extraTimeOrPenaltiesCount)
    )}
    ${renderPublicAnswerCard(
      "Red cards",
      answers.redCards !== "" && answers.redCards != null ? escapeHTML(String(answers.redCards)) : "",
      "",
      pointDetails.redCards,
      renderCorrectAnswerHtml(correctAnswers.redCards)
    )}
    ${renderPublicAnswerCard(
      "3+ goal winner #1",
      threeGoalWinners[0] ? escapeHTML(countryOptionLabel(threeGoalWinners[0])) : "",
      "",
      pointDetails.threeGoalWinner1,
      threeGoalWinnerCorrectHtml
    )}
    ${renderPublicAnswerCard(
      "3+ goal winner #2",
      threeGoalWinners[1] ? escapeHTML(countryOptionLabel(threeGoalWinners[1])) : "",
      "",
      pointDetails.threeGoalWinner2,
      threeGoalWinnerCorrectHtml
    )}
  `);
}

function renderPublicRound16BonusAnswers(answers = {}, round32Results = {}, hasPublishedAnswers = true, pointDetails = {}) {
  if (!hasPublishedAnswers) {
    return `
      <div class="public-pick-card">
        <h3>Round of 16 bonus answers</h3>
        <p class="mini-note">Detailed answers will appear here after the next leaderboard refresh.</p>
      </div>
    `;
  }

  const regionOrder = Array.isArray(answers.regionOrder)
    ? answers.regionOrder.filter(Boolean)
    : [];
  const regionOrderHtml = regionOrder.length
    ? regionOrder.map((region, index) => `${index + 1}. ${escapeHTML(region)}`).join("<br>")
    : "";
  const correctAnswers = pointDetails.correctAnswers || {};

  return renderPublicPickGrid(`
    ${renderPublicAnswerCard(
      "Most total goals match",
      publicRound16BonusMatchLabel(answers.mostGoalsMatch, round32Results)
        ? escapeHTML(publicRound16BonusMatchLabel(answers.mostGoalsMatch, round32Results))
        : "",
      "",
      pointDetails.mostGoalsMatch,
      renderCorrectAnswerHtml(correctAnswers.mostGoalsMatch)
    )}
    ${renderPublicAnswerCard(
      "Clean sheets",
      answers.cleanSheets !== "" && answers.cleanSheets != null ? escapeHTML(String(answers.cleanSheets)) : "",
      "",
      pointDetails.cleanSheets,
      renderCorrectAnswerHtml(correctAnswers.cleanSheets)
    )}
    ${renderPublicAnswerCard(
      "Region rank #1",
      regionOrder[0] ? escapeHTML(regionOrder[0]) : "",
      "",
      pointDetails.regionRank1,
      renderCorrectAnswerHtml(correctAnswers.regionRank1)
    )}
    ${renderPublicAnswerCard(
      "Region rank #2",
      regionOrder[1] ? escapeHTML(regionOrder[1]) : "",
      "",
      pointDetails.regionRank2,
      renderCorrectAnswerHtml(correctAnswers.regionRank2)
    )}
    ${renderPublicAnswerCard(
      "Region rank #3",
      regionOrder[2] ? escapeHTML(regionOrder[2]) : "",
      "",
      pointDetails.regionRank3,
      renderCorrectAnswerHtml(correctAnswers.regionRank3)
    )}
    ${renderPublicAnswerCard(
      "Region rank #4",
      regionOrder[3] ? escapeHTML(regionOrder[3]) : "",
      "",
      pointDetails.regionRank4,
      renderCorrectAnswerHtml(correctAnswers.regionRank4)
    )}
  `);
}

function renderCorrectAnswerHtml(value) {
  if (Array.isArray(value)) {
    return value.length ? value.map(item => escapeHTML(item)).join("<br>") : "";
  }

  return value ? escapeHTML(value) : "";
}

function renderPublicQuarterfinalBonusAnswers(answers = {}, isRevealable, round16Results = {}, round32Results = {}, pointDetails = {}, correctAnswers = {}) {
  if (!isRevealable) {
    return `
      <div class="public-pick-card public-pick-hidden">
        <h3>Quarterfinals bonus answers</h3>
        <p class="hidden-pick-marker">Hidden until the first Quarterfinal starts</p>
      </div>
    `;
  }

  const mostFreeKicksMatchLabel = publicQuarterfinalBonusMatchLabel(
    answers.mostFreeKicksMatch,
    round16Results,
    round32Results
  );
  const resolvedCorrectAnswers = Object.keys(correctAnswers || {}).length
    ? correctAnswers
    : pointDetails.correctAnswers || {};

  return renderPublicPickGrid(`
    ${renderPublicAnswerCard(
      "Any clean sheet?",
      answers.anyCleanSheet ? escapeHTML(answers.anyCleanSheet === "yes" ? "Yes" : "No") : "",
      "",
      pointDetails.anyCleanSheet,
      renderCorrectAnswerHtml(resolvedCorrectAnswers.anyCleanSheet)
    )}
    ${renderPublicAnswerCard(
      "Most goals team",
      answers.mostGoalsTeam ? escapeHTML(round32TeamLabel(answers.mostGoalsTeam)) : "",
      "Tied top scorer counts.",
      pointDetails.mostGoalsTeam,
      renderCorrectAnswerHtml(resolvedCorrectAnswers.mostGoalsTeam)
    )}
    ${renderPublicAnswerCard(
      "Most free kicks match",
      mostFreeKicksMatchLabel ? escapeHTML(mostFreeKicksMatchLabel) : "",
      "Combined total for both teams.",
      pointDetails.mostFreeKicksMatch,
      renderCorrectAnswerHtml(resolvedCorrectAnswers.mostFreeKicksMatch)
    )}
  `);
}

function renderPublicSemifinalBonusAnswers(answers = {}, isRevealable, pointDetails = {}) {
  if (!isRevealable) {
    return `
      <div class="public-pick-card public-pick-hidden">
        <h3>Semifinal bonus answers</h3>
        <p class="hidden-pick-marker">Hidden until the first Semifinal starts</p>
      </div>
    `;
  }

  const matchLabel = matchId => {
    const match = semifinalMatches.find(item => item.id === matchId);
    return match ? semifinalMatchupLabel(match) : "";
  };
  const correctAnswers = pointDetails.correctAnswers || {};

  return renderPublicPickGrid(`
    ${renderPublicAnswerCard(
      "More total goals",
      answers.moreGoalsMatch ? escapeHTML(matchLabel(answers.moreGoalsMatch)) : "",
      "An unlucky tie results in zero points awarded for this question.",
      pointDetails.moreGoalsMatch,
      renderCorrectAnswerHtml(correctAnswers.moreGoalsMatch)
    )}
    ${renderPublicAnswerCard(
      "More corner kicks",
      answers.moreCornerKicksMatch ? escapeHTML(matchLabel(answers.moreCornerKicksMatch)) : "",
      "An unlucky tie results in zero points awarded for this question.",
      pointDetails.moreCornerKicksMatch,
      renderCorrectAnswerHtml(correctAnswers.moreCornerKicksMatch)
    )}
    ${renderPublicAnswerCard(
      "Most shots on target",
      answers.mostShotsOnTargetTeam ? escapeHTML(round32TeamLabel(answers.mostShotsOnTargetTeam)) : "",
      "Ties reward points for either team.",
      pointDetails.mostShotsOnTargetTeam,
      renderCorrectAnswerHtml(correctAnswers.mostShotsOnTargetTeam)
    )}
    ${renderPublicAnswerCard(
      "Most yellow cards",
      answers.mostYellowCardsTeam ? escapeHTML(round32TeamLabel(answers.mostYellowCardsTeam)) : "",
      "Ties reward points for either team.",
      pointDetails.mostYellowCardsTeam,
      renderCorrectAnswerHtml(correctAnswers.mostYellowCardsTeam)
    )}
    ${renderPublicAnswerCard(
      "Most completed passes",
      answers.mostPassesTeam ? escapeHTML(round32TeamLabel(answers.mostPassesTeam)) : "",
      "Ties reward points for either team.",
      pointDetails.mostPassesTeam,
      renderCorrectAnswerHtml(correctAnswers.mostPassesTeam)
    )}
    ${renderPublicAnswerCard(
      "Want to win it all",
      answers.rootingForWinner ? escapeHTML(round32TeamLabel(answers.rootingForWinner)) : "",
      "Not worth points, just for kicks."
    )}
  `);
}

function renderPublicFinalsPickCard(match, pick, isRevealable, points = null) {
  const matchupLabel = `${match.label}: ${finalsMatchupLabel(match)}`;
  const hasPick = !!(pick && pick.winner);

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
        hasPick
          ? `
            <p><strong>Winner pick:</strong> ${escapeHTML(round32TeamLabel(pick.winner))}</p>
            <p><strong>Final score:</strong> ${escapeHTML(normalizeWinnerFirstScore(pick.score))}</p>
            <p><strong>Extra time / penalties:</strong> ${pick.extraTimeOrPenalties ? "Yes" : "No"}</p>
            ${renderEarnedPoints(points)}
          `
          : `<p class="mini-note">No saved pick for this match.</p>`
      }
    </div>
  `;
}

function renderPublicFinalsBonusAnswers(answers = {}, isRevealable, pointDetails = {}) {
  if (!isRevealable) {
    return `
      <div class="public-pick-card public-pick-hidden">
        <h3>Finals bonus answers</h3>
        <p class="hidden-pick-marker">Hidden until the third-place match starts</p>
      </div>
    `;
  }

  const correctAnswers = pointDetails.correctAnswers || {};

  return renderPublicPickGrid(`
    ${renderPublicAnswerCard(
      "How many combined shots on target will there be across both matches?",
      answers.combinedShotsOnTarget !== "" && answers.combinedShotsOnTarget != null
        ? escapeHTML(String(answers.combinedShotsOnTarget))
        : "",
      "Across the third-place match and World Cup Final.",
      pointDetails.combinedShotsOnTarget,
      renderCorrectAnswerHtml(correctAnswers.combinedShotsOnTarget)
    )}
    ${renderPublicAnswerCard(
      "Which match will produce more total goals?",
      answers.moreGoalsMatch ? escapeHTML(finalsMatchAnswerLabel(answers.moreGoalsMatch)) : "",
      "Extra-time goals count, but shootout kicks do not.",
      pointDetails.moreGoalsMatch,
      renderCorrectAnswerHtml(correctAnswers.moreGoalsMatch)
    )}
    ${renderPublicAnswerCard(
      "How many total yellow cards will be shown in the finals match?",
      answers.finalYellowCards !== "" && answers.finalYellowCards != null
        ? escapeHTML(String(answers.finalYellowCards))
        : "",
      "World Cup Final only.",
      pointDetails.finalYellowCards,
      renderCorrectAnswerHtml(correctAnswers.finalYellowCards)
    )}
    ${renderPublicAnswerCard(
      "Which team will record the most attempts at goal in the finals match?",
      answers.mostAttemptsTeam ? escapeHTML(round32TeamLabel(answers.mostAttemptsTeam)) : "",
      "No points if there’s a tie. This includes regulation time and any extra time played, not shootout kicks.",
      pointDetails.mostAttemptsTeam,
      renderCorrectAnswerHtml(correctAnswers.mostAttemptsTeam)
    )}
  `);
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
  const revealAllSavedAnswers = currentUserIsAdmin();

  if (!currentUser) {
    showPublicRound32PicksFromLeaderboard(publicRow, displayName);
    return;
  }

  const [
    picksSnap,
    resultsSnap,
    round16PicksSnap,
    quarterfinalPicksSnap,
    semifinalPicksSnap,
    finalsPicksSnap,
    round16ResultsSnap,
    semifinalResultsSnap,
    round16BonusAnswersSnap,
    quarterfinalBonusAnswersSnap,
    semifinalBonusAnswersSnap,
    finalsBonusAnswersSnap,
    scoringBreakdownData
  ] = await Promise.all([
    getDoc(doc(db, "round32Picks", uid)),
    getDoc(doc(db, "round32Results", "official")),
    getDoc(doc(db, "round16Picks", uid)),
    getOptionalDoc("quarterfinalPicks", uid),
    getOptionalDoc("semifinalPicks", uid),
    getOptionalDoc("finalsPicks", uid),
    getDoc(doc(db, "round16Results", "official")),
    getOptionalDoc("semifinalResults", "official"),
    getDoc(doc(db, "round16BonusAnswers", uid)),
    getOptionalDoc("quarterfinalBonusAnswers", uid),
    getOptionalDoc("semifinalBonusAnswers", uid),
    getOptionalDoc("finalsBonusAnswers", uid),
    loadPlayerScoringBreakdownData(uid)
  ]);

  const picks = picksSnap.exists() ? picksSnap.data().picks || {} : {};
  const results = resultsSnap.exists() ? resultsSnap.data().results || {} : {};
  const round16Picks = round16PicksSnap.exists() ? round16PicksSnap.data().picks || {} : {};
  const quarterfinalPicks = quarterfinalPicksSnap?.exists() ? quarterfinalPicksSnap.data().picks || {} : {};
  const semifinalPicks = semifinalPicksSnap?.exists() ? semifinalPicksSnap.data().picks || {} : {};
  const finalsPicks = finalsPicksSnap?.exists() ? finalsPicksSnap.data().picks || {} : {};
  const round16Results = round16ResultsSnap.exists() ? round16ResultsSnap.data().results || {} : {};
  const semifinalResults = semifinalResultsSnap?.exists() ? semifinalResultsSnap.data().results || {} : {};
  const round16BonusAnswers = round16BonusAnswersSnap.exists() ? round16BonusAnswersSnap.data().answers || {} : {};
  const quarterfinalBonusAnswers = quarterfinalBonusAnswersSnap?.exists()
    ? quarterfinalBonusAnswersSnap.data().answers || {}
    : {};
  const semifinalBonusAnswers = semifinalBonusAnswersSnap?.exists()
    ? semifinalBonusAnswersSnap.data().answers || {}
    : {};
  const finalsBonusAnswers = finalsBonusAnswersSnap?.exists()
    ? finalsBonusAnswersSnap.data().answers || {}
    : {};

  playerPicksTitle.textContent = `${displayName}'s Knockout Picks`;
  playerPicksContent.innerHTML = `
    ${renderAdminDailyPointsPanel(scoringBreakdownData)}
    ${renderPlayerDrawerSection("Finals Picks", renderPublicPickGrid(
      finalsMatches.map(match =>
        renderPublicFinalsPickCard(
          match,
          finalsPicks[match.id],
          revealAllSavedAnswers || finalsPickIsRevealable(match),
          finalsPickPointsFor(match.id, finalsPicks[match.id], scoringBreakdownData.finalsResults)
        )
      ).join("")
    ))}
    ${renderPlayerDrawerSection(
      "Finals Bonus Questions",
      renderPublicFinalsBonusAnswers(
        finalsBonusAnswers,
        revealAllSavedAnswers || finalsBonusAnswersAreRevealable(),
        finalsBonusPointDetailsFor(
          finalsBonusAnswers,
          scoringBreakdownData.finalsBonusResults
        )
      )
    )}
    ${renderPlayerDrawerSection("Semifinals Picks", renderPublicPickGrid(
      semifinalMatches.map(match =>
        renderPublicSemifinalPickCard(
          match,
          semifinalPicks[match.id],
          revealAllSavedAnswers || semifinalPickIsRevealable(match),
          semifinalPickPointsFor(match.id, semifinalPicks[match.id], semifinalResults)
        )
      ).join("")
    ))}
    ${renderPlayerDrawerSection(
      "Semifinal Bonus Questions",
      renderPublicSemifinalBonusAnswers(
        semifinalBonusAnswers,
        revealAllSavedAnswers || semifinalBonusAnswersAreRevealable(),
        semifinalBonusPointDetailsFor(
          semifinalBonusAnswers,
          scoringBreakdownData.semifinalBonusResults
        )
      )
    , false)}
    ${renderPlayerDrawerSection("Quarterfinals Picks", renderPublicPickGrid(
      quarterfinalMatches.map(match =>
        renderPublicQuarterfinalPickCard(
          match,
          quarterfinalPicks[match.id],
          revealAllSavedAnswers || quarterfinalPickIsRevealable(match),
          round16Results,
          results,
          quarterfinalPickPointsFor(match.id, quarterfinalPicks[match.id], scoringBreakdownData.quarterfinalResults)
        )
      ).join("")
    ), false)}
    ${renderPlayerDrawerSection(
      "Quarterfinals Bonus Questions",
      renderPublicQuarterfinalBonusAnswers(
        quarterfinalBonusAnswers,
        revealAllSavedAnswers || quarterfinalBonusAnswersAreRevealable(),
        round16Results,
        results,
        quarterfinalBonusPointDetailsFor(
          quarterfinalBonusAnswers,
          scoringBreakdownData.quarterfinalResults,
          scoringBreakdownData.round16Results,
          scoringBreakdownData.round32Results,
          scoringBreakdownData.quarterfinalBonusResults
        ),
        quarterfinalBonusCorrectAnswersFor(
          scoringBreakdownData.quarterfinalResults,
          scoringBreakdownData.round16Results,
          scoringBreakdownData.round32Results,
          scoringBreakdownData.quarterfinalBonusResults
        )
      ),
      false
    )}
    ${renderPlayerDrawerSection("Round of 16 Picks", renderPublicPickGrid(
      round16Matches.map(match =>
        renderPublicRound16PickCard(
          match,
          round16Picks[match.id],
          revealAllSavedAnswers || round16PickIsRevealable(match),
          results,
          round16PickPointsFor(match.id, round16Picks[match.id], scoringBreakdownData.round16Results)
        )
      ).join("")
    ), false)}
    ${renderPlayerDrawerSection(
      "Round of 16 Bonus Question Answers",
      renderPublicRound16BonusAnswers(
        round16BonusAnswers,
        results,
        true,
        round16BonusPointDetailsFor(
          round16BonusAnswers,
          scoringBreakdownData.round16Results,
          scoringBreakdownData.round32Results
        )
      ),
      false
    )}
    ${renderPlayerDrawerSection("Round of 32 Picks", renderPublicPickGrid(
      round32Matches.map(match =>
        renderPublicRound32PickCard(
          match,
          picks[match.id],
          revealAllSavedAnswers || round32PickIsRevealable(match, results),
          round32PickPointsFor(match.id, picks[match.id], scoringBreakdownData.round32Results)
        )
      ).join("")
    ), false)}
    ${renderPlayerDrawerSection(
      "Round of 32 Bonus Question Answers",
      renderPublicRound32BonusAnswers(
        scoringBreakdownData.round32BonusAnswers,
        round32BonusPointDetailsFor(
          scoringBreakdownData.round32BonusAnswers,
          scoringBreakdownData.round32BonusResults,
          scoringBreakdownData.round32Results
        ),
        true
      ),
      false
    )}
    ${revealAllSavedAnswers ? renderPlayerDrawerSection(
      "Group Stage Picks",
      renderPublicGroupPicks(scoringBreakdownData.groupPicks),
      false
    ) : ""}
    ${revealAllSavedAnswers ? renderPlayerDrawerSection(
      "Opening Bonus Question Answers",
      renderPublicOpeningBonusAnswers(
        scoringBreakdownData.bonusAnswers,
        openingBonusPointDetailsFor(scoringBreakdownData.bonusAnswers, scoringBreakdownData.bonusResults)
      ),
      false
    ) : ""}
  `;

  bindAdminDailyPointsPanel(scoringBreakdownData);
  bindPlayerDrawerSections();
  playerPicksViewer.style.display = "block";
  playerPicksViewer.scrollIntoView({ behavior: "smooth", block: "start" });
}

function showPublicRound32PicksFromLeaderboard(row, displayName) {
  playerPicksTitle.textContent = `${displayName}'s Knockout Picks`;

  if (!row) {
    playerPicksContent.innerHTML = `<p class="mini-note">Could not find this player on the public leaderboard.</p>`;
  } else {
    const picks = row.publicRound32Picks || {};
    const round32PickPoints = row.publicRound32PickPoints || {};
    const hasPublishedRound32BonusAnswers =
      Object.prototype.hasOwnProperty.call(row, "publicRound32BonusAnswers");
    const round32BonusAnswers = row.publicRound32BonusAnswers || {};
    const round32BonusPointDetails = row.publicRound32BonusPointDetails || {};
    const revealableMatchIds = Array.isArray(row.publicRound32RevealableMatchIds)
      ? row.publicRound32RevealableMatchIds
      : Array.isArray(row.publicRound32FinishedMatchIds)
        ? row.publicRound32FinishedMatchIds
      : [];
    const round16Picks = row.publicRound16Picks || {};
    const round16PickPoints = row.publicRound16PickPoints || {};
    const round16RevealableMatchIds = Array.isArray(row.publicRound16RevealableMatchIds)
      ? row.publicRound16RevealableMatchIds
      : round16Matches.filter(match => round16PickIsRevealable(match)).map(match => match.id);
    const hasPublishedRound16BonusAnswers =
      Object.prototype.hasOwnProperty.call(row, "publicRound16BonusAnswers");
    const round16BonusAnswers = row.publicRound16BonusAnswers || {};
    const round16BonusPointDetails = row.publicRound16BonusPointDetails || {};
    const quarterfinalPicks = row.publicQuarterfinalPicks || {};
    const quarterfinalPickPoints = row.publicQuarterfinalPickPoints || {};
    const quarterfinalMatchupLabels = row.publicQuarterfinalMatchupLabels || {};
    const quarterfinalRevealableMatchIds = Array.isArray(row.publicQuarterfinalRevealableMatchIds)
      ? row.publicQuarterfinalRevealableMatchIds
      : [];
    const quarterfinalBonusAnswers = row.publicQuarterfinalBonusAnswers || {};
    const quarterfinalBonusPointDetails = row.publicQuarterfinalBonusPointDetails || {};
    const quarterfinalBonusCorrectAnswers = row.publicQuarterfinalBonusCorrectAnswers || {};
    const quarterfinalBonusRevealable =
      typeof row.publicQuarterfinalBonusRevealable === "boolean"
        ? row.publicQuarterfinalBonusRevealable
        : quarterfinalBonusAnswersAreRevealable();
    const semifinalPicks = row.publicSemifinalPicks || {};
    const semifinalPickPoints = row.publicSemifinalPickPoints || {};
    const semifinalRevealableMatchIds = Array.isArray(row.publicSemifinalRevealableMatchIds)
      ? row.publicSemifinalRevealableMatchIds
      : [];
    const semifinalBonusAnswers = row.publicSemifinalBonusAnswers || {};
    const semifinalBonusPointDetails = row.publicSemifinalBonusPointDetails || {};
    const semifinalBonusRevealable =
      typeof row.publicSemifinalBonusRevealable === "boolean"
        ? row.publicSemifinalBonusRevealable
        : semifinalBonusAnswersAreRevealable();
    const finalsPicks = row.publicFinalsPicks || {};
    const finalsPickPoints = row.publicFinalsPickPoints || {};
    const finalsRevealableMatchIds = Array.isArray(row.publicFinalsRevealableMatchIds)
      ? row.publicFinalsRevealableMatchIds
      : [];
    const finalsBonusAnswers = row.publicFinalsBonusAnswers || {};
    const finalsBonusPointDetails = row.publicFinalsBonusPointDetails || {};
    const finalsBonusRevealable =
      typeof row.publicFinalsBonusRevealable === "boolean"
        ? row.publicFinalsBonusRevealable
        : finalsBonusAnswersAreRevealable();

    playerPicksContent.innerHTML = `
      ${renderPublicDailyPointsPanel(row)}
      ${renderPlayerDrawerSection("Finals Picks", renderPublicPickGrid(
        finalsMatches.map(match =>
          renderPublicFinalsPickCard(
            match,
            finalsPicks[match.id],
            finalsRevealableMatchIds.includes(match.id),
            finalsPickPoints[match.id]
          )
        ).join("")
      ))}
      ${renderPlayerDrawerSection(
        "Finals Bonus Questions",
        renderPublicFinalsBonusAnswers(
          finalsBonusAnswers,
          finalsBonusRevealable,
          finalsBonusPointDetails
        )
      )}
      ${renderPlayerDrawerSection("Semifinals Picks", renderPublicPickGrid(
        semifinalMatches.map(match =>
          renderPublicSemifinalPickCard(
            match,
            semifinalPicks[match.id],
            semifinalRevealableMatchIds.includes(match.id),
            semifinalPickPoints[match.id]
          )
        ).join("")
      ))}
      ${renderPlayerDrawerSection(
        "Semifinal Bonus Questions",
        renderPublicSemifinalBonusAnswers(
          semifinalBonusAnswers,
          semifinalBonusRevealable,
          semifinalBonusPointDetails
        )
      , false)}
      ${renderPlayerDrawerSection("Quarterfinals Picks", renderPublicPickGrid(
        quarterfinalMatches.map(match =>
          renderPublicQuarterfinalPickCard(
            match,
            quarterfinalPicks[match.id],
            quarterfinalRevealableMatchIds.includes(match.id),
            {},
            {},
            quarterfinalPickPoints[match.id],
            quarterfinalMatchupLabels[match.id]
          )
        ).join("")
      ), false)}
      ${renderPlayerDrawerSection(
        "Quarterfinals Bonus Questions",
        renderPublicQuarterfinalBonusAnswers(
          quarterfinalBonusAnswers,
          quarterfinalBonusRevealable,
          {},
          {},
          quarterfinalBonusPointDetails,
          quarterfinalBonusCorrectAnswers
        ),
        false
      )}
      ${renderPlayerDrawerSection("Round of 16 Picks", renderPublicPickGrid(
        round16Matches.map(match =>
          renderPublicRound16PickCard(
            match,
            round16Picks[match.id],
            round16RevealableMatchIds.includes(match.id),
            {},
            round16PickPoints[match.id]
        )
      ).join("")
      ), false)}
      ${renderPlayerDrawerSection(
        "Round of 16 Bonus Question Answers",
        renderPublicRound16BonusAnswers(
          round16BonusAnswers,
          {},
          hasPublishedRound16BonusAnswers,
          round16BonusPointDetails
        ),
        false
      )}
      ${renderPlayerDrawerSection("Round of 32 Picks", renderPublicPickGrid(
        round32Matches.map(match =>
          renderPublicRound32PickCard(
            match,
            picks[match.id],
            revealableMatchIds.includes(match.id),
            round32PickPoints[match.id]
          )
        ).join("")
      ), false)}
      ${renderPlayerDrawerSection(
        "Round of 32 Bonus Question Answers",
        renderPublicRound32BonusAnswers(
          round32BonusAnswers,
          round32BonusPointDetails,
          hasPublishedRound32BonusAnswers
        ),
        false
      )}
    `;

    if (Array.isArray(row.publicScoringEntries) && row.publicScoringEntries.length) {
      bindAdminDailyPointsPanel(row.publicScoringEntries);
    }
    bindPlayerDrawerSections();
  }

  playerPicksViewer.style.display = "block";
  playerPicksViewer.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderPublicRound32PickCard(match, pick, isRevealable, points = null) {
  const matchupLabel = round32MatchupLabel(match);
  const hasPick = !!(pick && pick.winner);

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
        hasPick
          ? `
            <p><strong>Winner pick:</strong> ${escapeHTML(round32TeamLabel(pick.winner))}</p>
            <p><strong>Extra time / penalties:</strong> ${pick.extraTimeOrPenalties ? "Yes" : "No"}</p>
            ${renderEarnedPoints(points)}
          `
          : `<p class="mini-note">No saved pick for this match.</p>`
      }
    </div>
  `;
}

function renderPublicRound16PickCard(match, pick, isRevealable, round32Results = {}, points = null) {
  const matchupLabel = round16MatchupLabel(match, round32Results);
  const hasPick = !!(pick && pick.winner);

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
        hasPick
          ? `
            <p><strong>Winner pick:</strong> ${escapeHTML(round32TeamLabel(pick.winner))}</p>
            <p><strong>Final score:</strong> ${escapeHTML(normalizeWinnerFirstScore(pick.score))}</p>
            <p><strong>Extra time / penalties:</strong> ${pick.extraTimeOrPenalties ? "Yes" : "No"}</p>
            ${renderEarnedPoints(points)}
          `
          : `<p class="mini-note">No saved pick for this match.</p>`
      }
    </div>
  `;
}

function renderPublicQuarterfinalPickCard(match, pick, isRevealable, round16Results = {}, round32Results = {}, points = null, matchupLabelOverride = "") {
  const matchupLabel = matchupLabelOverride || quarterfinalMatchupLabel(match, round16Results, round32Results);
  const hasPick = !!(pick && pick.winner);

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
        hasPick
          ? `
            <p><strong>Winner pick:</strong> ${escapeHTML(round32TeamLabel(pick.winner))}</p>
            <p><strong>Final score:</strong> ${escapeHTML(normalizeWinnerFirstScore(pick.score))}</p>
            <p><strong>Extra time / penalties:</strong> ${pick.extraTimeOrPenalties ? "Yes" : "No"}</p>
            ${renderEarnedPoints(points)}
          `
          : `<p class="mini-note">No saved pick for this match.</p>`
      }
    </div>
  `;
}

function renderPublicSemifinalPickCard(match, pick, isRevealable, points = null) {
  const matchupLabel = semifinalMatchupLabel(match);
  const hasPick = !!(pick && pick.winner);

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
        hasPick
          ? `
            <p><strong>Winner pick:</strong> ${escapeHTML(round32TeamLabel(pick.winner))}</p>
            <p><strong>Final score:</strong> ${escapeHTML(normalizeWinnerFirstScore(pick.score))}</p>
            <p><strong>Extra time / penalties:</strong> ${pick.extraTimeOrPenalties ? "Yes" : "No"}</p>
            ${renderEarnedPoints(points)}
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

  const hasLiveMatch = matches.some(match =>
    match.status?.type === "live" || match.status?.type === "started"
  );

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

  const matches = await buildWorldCupTickerMatches();
  latestTickerMatches = matches;

  ticker.innerHTML = matches.map(renderTickerMatch).join("");
  scheduleNextTickerRefresh(matches);

  if (updated) {
    updated.textContent = "Final weekend";
  }
}

async function buildWorldCupTickerMatches() {
  const staticMatches = [
    ...semifinalMatches.map(buildCompletedSemifinalTickerMatch),
    buildStaticTickerMatch(thirdPlaceMatch, "3rd Place"),
    buildStaticTickerMatch(finalMatch, "Final")
  ];
  const feedMatches = await loadTickerFeedMatches();

  return staticMatches.map(match =>
    applyTickerFeedMatch(match, feedMatches) || match
  );
}

async function loadTickerFeedMatches() {
  try {
    const res = await fetch(MATCH_TICKER_URL);
    if (!res.ok) throw new Error(`Ticker feed returned ${res.status}`);
    const data = await res.json();
    return Array.isArray(data.matches) ? data.matches : [];
  } catch (err) {
    console.warn("Using static final-weekend ticker schedule:", err);
    return [];
  }
}

function buildCompletedSemifinalTickerMatch(match) {
  const result = completedSemifinalTickerResults[match.id] || {};

  return {
    id: match.id,
    round: "SF",
    date: match.startTime,
    venue: match.venue,
    tickerVenue: match.tickerVenue,
    tickerLocation: match.tickerLocation,
    status: {
      type: "final",
      detail: ""
    },
    winnerName: result.winner || "",
    home: tickerTeamFromCountry(match.home, result.homeScore),
    away: tickerTeamFromCountry(match.away, result.awayScore)
  };
}

function buildStaticTickerMatch(match, round) {
  return {
    id: match.id,
    round,
    date: match.startTime,
    venue: match.venue,
    tickerVenue: match.tickerVenue,
    tickerLocation: match.tickerLocation,
    status: {
      type: matchIsLocked(match) ? "started" : "scheduled",
      detail: ""
    },
    home: tickerTeamFromCountry(match.home),
    away: tickerTeamFromCountry(match.away)
  };
}

function matchIsLocked(match) {
  return new Date() >= new Date(match.startTime);
}

function applyTickerFeedMatch(staticMatch, feedMatches = []) {
  const feedMatch = findTickerFeedMatch(staticMatch, feedMatches);
  if (!feedMatch) return null;

  const feedStatusType = String(feedMatch.status?.type || "").toLowerCase();
  const shouldUseFeedScore =
    feedStatusType === "live" ||
    feedStatusType === "final" ||
    feedMatch.home?.score != null ||
    feedMatch.away?.score != null;

  if (!shouldUseFeedScore) return null;

  const feedHomeMatchesStaticHome = sameTickerTeam(feedMatch.home?.name, staticMatch.home.name);
  const feedHome = feedHomeMatchesStaticHome ? feedMatch.home : feedMatch.away;
  const feedAway = feedHomeMatchesStaticHome ? feedMatch.away : feedMatch.home;

  return {
    ...staticMatch,
    status: {
      ...staticMatch.status,
      ...feedMatch.status,
      detail: feedMatch.status?.detail || staticMatch.status.detail
    },
    winner: feedMatch.winner || staticMatch.winner,
    winnerName: feedMatch.winnerName || feedMatch.winner_name || staticMatch.winnerName,
    winnerCode: feedMatch.winnerCode || feedMatch.winner_code || staticMatch.winnerCode,
    penalties: feedMatch.penalties || feedMatch.penaltyScore || feedMatch.penalty_score || feedMatch.shootout || staticMatch.penalties,
    home: {
      ...staticMatch.home,
      ...feedHome,
      name: staticMatch.home.name,
      code: staticMatch.home.code,
      flag: staticMatch.home.flag
    },
    away: {
      ...staticMatch.away,
      ...feedAway,
      name: staticMatch.away.name,
      code: staticMatch.away.code,
      flag: staticMatch.away.flag
    }
  };
}

function findTickerFeedMatch(staticMatch, feedMatches = []) {
  return feedMatches.find(feedMatch => {
    const home = feedMatch.home?.name || "";
    const away = feedMatch.away?.name || "";

    return (
      sameTickerTeam(home, staticMatch.home.name) &&
      sameTickerTeam(away, staticMatch.away.name)
    ) || (
      sameTickerTeam(home, staticMatch.away.name) &&
      sameTickerTeam(away, staticMatch.home.name)
    );
  }) || null;
}

function tickerTeamFromCountry(country, score = null) {
  return {
    name: country,
    code: TICKER_COUNTRY_CODES[country] || cleanCountryName(country).slice(0, 3).toUpperCase(),
    flag: round32Flags[country] || countryFlagFromOption(country) || "",
    ...(score !== null && score !== undefined ? { score } : {})
  };
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
    minute: "2-digit",
    timeZoneName: "short"
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
      : status.type === "started"
        ? `<span class="started-pill">STARTED</span>`
        : `<span class="upcoming-pill">UPCOMING</span>`;

  const scoreHome = showScore ? Number(match.home.score ?? 0) : "";
  const scoreAway = showScore ? Number(match.away.score ?? 0) : "";
  const winnerName = getTickerWinnerName(match);
  const winnerLabel = winnerName ? getTickerWinnerLabel(match, winnerName) : "";
  const homeIsWinner = winnerName && sameTickerTeam(match.home.name, winnerName);
  const awayIsWinner = winnerName && sameTickerTeam(match.away.name, winnerName);
  const venueLabel = tickerVenueLabel(match);

  return `
    <div class="match-card ${escapeHTML(status.type || "")}">
      <div class="match-card-top">
        <span>${statusLabel}</span>
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
        <div class="match-footer-line">${escapeHTML(match.round || "")} · ${dateTimeLabel}</div>
        ${venueLabel ? `<div class="match-footer-line">${escapeHTML(venueLabel)}</div>` : ""}
        ${winnerLabel ? `<div class="match-footer-line match-winner-footer">${escapeHTML(winnerLabel)}</div>` : ""}
      </div>
    </div>
  `;
}

function tickerVenueLabel(match) {
  if (match.tickerVenue && match.tickerLocation) {
    return `${match.tickerVenue} at ${match.tickerLocation}`;
  }

  return match.tickerVenue || match.venue || "";
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
  const homeName = match.home && match.home.name ? match.home.name : "";
  const awayName = match.away && match.away.name ? match.away.name : "";

  return tickerWinnerOverrides[`${homeName}|${awayName}`] ||
    tickerWinnerOverrides[`${awayName}|${homeName}`] ||
    null;
}

function sameTickerTeam(a, b) {
  return cleanCountryName(a || "").toLowerCase() === cleanCountryName(b || "").toLowerCase();
}

loadWorldCupTicker();

let saveNotificationTimer = null;

function showSaveNotification(message) {
  let toast = document.getElementById("saveNotificationToast");

  if (!toast) {
    toast = document.createElement("div");
    toast.id = "saveNotificationToast";
    toast.className = "save-toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    document.body.appendChild(toast);
  }

  toast.textContent = `✅ ${message}`;
  toast.classList.add("save-toast-visible");

  if (saveNotificationTimer) clearTimeout(saveNotificationTimer);
  saveNotificationTimer = setTimeout(() => {
    toast.classList.remove("save-toast-visible");
  }, 2200);
}

function getValue(id) {
  return document.getElementById(id)?.value || "";
}

function setValue(id, value) {
  const el = document.getElementById(id);
  if (!el) return;

  const nextValue = value ?? "";
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
