/*
SETUP:
1. Create a Google Sheet with tabs named:
   - Leaderboard
   - Matches
2. File -> Share -> Publish to web.
3. Publish each tab as CSV.
4. Replace the two URLs below.

Leaderboard columns:
display_name,match_points,survey_points,bonus_points,total_points

Matches columns:
date,team_a,team_b,winner_actual
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

// June uses daylight time in Texas, so this is 2:00 PM CT/CDT.
const GROUP_PICK_LOCK_TIME = new Date("2026-06-11T14:00:00-05:00");

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

const testMatches = [
  { id: "M001", label: "🇲🇽 Mexico vs 🇿🇦 South Africa", options: ["🇲🇽 Mexico", "Draw", "🇿🇦 South Africa"] },
  { id: "M004", label: "🇺🇸 USA vs 🇵🇾 Paraguay", options: ["🇺🇸 USA", "Draw", "🇵🇾 Paraguay"] },
  { id: "M010", label: "🇳🇱 Netherlands vs 🇯🇵 Japan", options: ["🇳🇱 Netherlands", "Draw", "🇯🇵 Japan"] }
];

const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const userInfo = document.getElementById("userInfo");

const usernameBox = document.getElementById("usernameBox");
const usernameInput = document.getElementById("usernameInput");
const saveUsernameBtn = document.getElementById("saveUsernameBtn");
const usernameStatus = document.getElementById("usernameStatus");

const groupPicksSection = document.getElementById("groupPicksSection");
const groupPicksForm = document.getElementById("groupPicksForm");
const saveGroupPicksBtn = document.getElementById("saveGroupPicksBtn");
const groupPicksStatus = document.getElementById("groupPicksStatus");

const matchPicksSection = document.getElementById("matchPicksSection");
const matchPicksForm = document.getElementById("matchPicksForm");
const saveMatchPicksBtn = document.getElementById("saveMatchPicksBtn");
const matchPicksStatus = document.getElementById("matchPicksStatus");

const adminSection = document.getElementById("adminSection");
const adminGroupResultsForm = document.getElementById("adminGroupResultsForm");
const saveGroupResultsBtn = document.getElementById("saveGroupResultsBtn");
const groupResultsStatus = document.getElementById("groupResultsStatus");
const adminMatchResultsForm = document.getElementById("adminMatchResultsForm");
const saveMatchResultsBtn = document.getElementById("saveMatchResultsBtn");
const matchResultsStatus = document.getElementById("matchResultsStatus");
const refreshLeaderboardBtn = document.getElementById("refreshLeaderboardBtn");

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

  usernameStatus.textContent = "✅ Username saved!";
  await renderLeaderboardFromFirestore();
});

onAuthStateChanged(auth, async (user) => {
  currentUser = user;

  if (!user) {
    loginBtn.style.display = "inline-block";
    logoutBtn.style.display = "none";
    userInfo.textContent = "Not signed in";

    if (usernameBox) usernameBox.style.display = "none";
    groupPicksSection.style.display = "none";
    matchPicksSection.style.display = "none";
    if (adminSection) adminSection.style.display = "none";
    return;
  }

  loginBtn.style.display = "none";
  logoutBtn.style.display = "inline-block";
  userInfo.textContent = `Signed in as ${user.email}`;

  await setDoc(doc(db, "users", user.uid), {
    uid: user.uid,
    email: user.email,
    googleDisplayName: user.displayName || "",
    photoURL: user.photoURL || "",
    lastLogin: new Date().toISOString()
  }, { merge: true });

  const userSnap = await getDoc(doc(db, "users", user.uid));
  if (usernameBox) usernameBox.style.display = "block";
  if (userSnap.exists() && usernameInput) {
    usernameInput.value = userSnap.data().username || "";
  }

  groupPicksSection.style.display = "block";
  matchPicksSection.style.display = "block";

  renderGroupPicks();
  renderMatchPicks();

  await loadExistingGroupPicks();
  await loadExistingMatchPicks();
  await renderLeaderboardFromFirestore();

  if (ADMIN_EMAILS.includes(user.email)) {
    adminSection.style.display = "block";
    renderAdminGroupResults();
    renderAdminMatchResults();
    await loadExistingGroupResults();
    await loadExistingMatchResults();
  }
});

function groupPicksAreLocked() {
  return new Date() >= GROUP_PICK_LOCK_TIME;
}

function renderGroupPicks() {
  groupPicksForm.innerHTML = "";

  Object.entries(groups).forEach(([groupName, teams]) => {
    const wrapper = document.createElement("div");
    wrapper.className = "pick-card";

    wrapper.innerHTML = `
      <h3>Group ${groupName}</h3>

      <label>Pick #1</label>
      <select id="group-${groupName}-first">
        <option value="">Select team</option>
        ${teams.map(team => `<option value="${team}">${team}</option>`).join("")}
      </select>

      <label>Pick #2</label>
      <select id="group-${groupName}-second">
        <option value="">Select team</option>
        ${teams.map(team => `<option value="${team}">${team}</option>`).join("")}
      </select>
    `;

    groupPicksForm.appendChild(wrapper);
  });

  if (groupPicksAreLocked()) {
    groupPicksStatus.textContent = "🔒 Group picks are locked.";
    saveGroupPicksBtn.disabled = true;
    saveGroupPicksBtn.textContent = "Group Picks Locked";

    Object.keys(groups).forEach(groupName => {
      document.getElementById(`group-${groupName}-first`).disabled = true;
      document.getElementById(`group-${groupName}-second`).disabled = true;
    });
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

  if (!groupPicksAreLocked()) {
    groupPicksStatus.textContent = "Loaded saved group picks.";
  }
}

saveGroupPicksBtn.addEventListener("click", async () => {
  if (groupPicksAreLocked()) {
    alert("Group picks are locked.");
    return;
  }

  const picks = {};

  for (const groupName of Object.keys(groups)) {
    const first = document.getElementById(`group-${groupName}-first`).value;
    const second = document.getElementById(`group-${groupName}-second`).value;

    if (!first || !second) return alert(`Pick both teams for Group ${groupName}.`);
    if (first === second) return alert(`Group ${groupName}: picks cannot be the same.`);

    picks[groupName] = { first, second };
  }

  await setDoc(doc(db, "groupPicks", currentUser.uid), {
    uid: currentUser.uid,
    email: currentUser.email,
    picks,
    scoring: {
      topTwo: 2,
      thirdPlaceQualifier: 1,
      eliminated: 0
    },
    updatedAt: new Date().toISOString()
  }, { merge: true });

  groupPicksStatus.textContent = "✅ Group picks saved!";
  await renderLeaderboardFromFirestore();
});

function renderMatchPicks() {
  matchPicksForm.innerHTML = "";

  testMatches.forEach(match => {
    const wrapper = document.createElement("div");
    wrapper.className = "pick-card";

    wrapper.innerHTML = `
      <h3>${match.label}</h3>
      <select id="match-${match.id}">
        <option value="">Select prediction</option>
        ${match.options.map(option => `<option value="${option}">${option}</option>`).join("")}
      </select>
    `;

    matchPicksForm.appendChild(wrapper);
  });
}

async function loadExistingMatchPicks() {
  const snap = await getDoc(doc(db, "matchPicks", currentUser.uid));
  if (!snap.exists()) return;

  const data = snap.data();
  Object.entries(data.picks || {}).forEach(([matchId, pick]) => {
    const select = document.getElementById(`match-${matchId}`);
    if (select) select.value = pick;
  });

  matchPicksStatus.textContent = "Loaded saved match picks.";
}

saveMatchPicksBtn.addEventListener("click", async () => {
  const picks = {};

  for (const match of testMatches) {
    const prediction = document.getElementById(`match-${match.id}`).value;
    if (!prediction) return alert(`Pick: ${match.label}`);
    picks[match.id] = prediction;
  }

  await setDoc(doc(db, "matchPicks", currentUser.uid), {
    uid: currentUser.uid,
    email: currentUser.email,
    picks,
    updatedAt: new Date().toISOString()
  }, { merge: true });

  matchPicksStatus.textContent = "✅ Match picks saved!";
  await renderLeaderboardFromFirestore();
});

function renderAdminGroupResults() {
  adminGroupResultsForm.innerHTML = "";

  Object.entries(groups).forEach(([groupName, teams]) => {
    const wrapper = document.createElement("div");
    wrapper.className = "pick-card";

    wrapper.innerHTML = `
      <h3>Group ${groupName} Official Result</h3>

      <label>1st place</label>
      <select id="result-${groupName}-first">
        <option value="">Select team</option>
        ${teams.map(team => `<option value="${team}">${team}</option>`).join("")}
      </select>

      <label>2nd place</label>
      <select id="result-${groupName}-second">
        <option value="">Select team</option>
        ${teams.map(team => `<option value="${team}">${team}</option>`).join("")}
      </select>

      <label>3rd place</label>
      <select id="result-${groupName}-third">
        <option value="">Select team</option>
        ${teams.map(team => `<option value="${team}">${team}</option>`).join("")}
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
    const first = document.getElementById(`result-${groupName}-first`);
    const second = document.getElementById(`result-${groupName}-second`);
    const third = document.getElementById(`result-${groupName}-third`);
    const thirdQualified = document.getElementById(`result-${groupName}-thirdQualified`);

    if (first) first.value = result.first || "";
    if (second) second.value = result.second || "";
    if (third) third.value = result.third || "";
    if (thirdQualified) thirdQualified.checked = !!result.thirdQualified;
  });
}

saveGroupResultsBtn?.addEventListener("click", async () => {
  const results = {};

  for (const groupName of Object.keys(groups)) {
    const first = document.getElementById(`result-${groupName}-first`).value;
    const second = document.getElementById(`result-${groupName}-second`).value;
    const third = document.getElementById(`result-${groupName}-third`).value;
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

function renderAdminMatchResults() {
  adminMatchResultsForm.innerHTML = "";

  testMatches.forEach(match => {
    const wrapper = document.createElement("div");
    wrapper.className = "pick-card";

    wrapper.innerHTML = `
      <h3>${match.label}</h3>
      <select id="result-match-${match.id}">
        <option value="">Select winner/result</option>
        ${match.options.map(option => `<option value="${option}">${option}</option>`).join("")}
      </select>
    `;

    adminMatchResultsForm.appendChild(wrapper);
  });
}

async function loadExistingMatchResults() {
  const snap = await getDoc(doc(db, "matchResults", "official"));
  if (!snap.exists()) return;

  const results = snap.data().results || {};

  Object.entries(results).forEach(([matchId, result]) => {
    const select = document.getElementById(`result-match-${matchId}`);
    if (select) select.value = result;
  });
}

saveMatchResultsBtn?.addEventListener("click", async () => {
  const results = {};

  for (const match of testMatches) {
    results[match.id] = document.getElementById(`result-match-${match.id}`).value;
  }

  await setDoc(doc(db, "matchResults", "official"), {
    results,
    updatedAt: new Date().toISOString(),
    updatedBy: currentUser.email
  }, { merge: true });

  matchResultsStatus.textContent = "✅ Match results saved!";
  await renderLeaderboardFromFirestore();
});

refreshLeaderboardBtn?.addEventListener("click", renderLeaderboardFromFirestore);

async function renderLeaderboardFromFirestore() {
  const usersSnap = await getDocs(collection(db, "users"));
  const groupPicksSnap = await getDocs(collection(db, "groupPicks"));
  const matchPicksSnap = await getDocs(collection(db, "matchPicks"));

  const groupResultsSnap = await getDoc(doc(db, "groupResults", "official"));
  const matchResultsSnap = await getDoc(doc(db, "matchResults", "official"));

  const groupResults = groupResultsSnap.exists() ? groupResultsSnap.data().results || {} : {};
  const matchResults = matchResultsSnap.exists() ? matchResultsSnap.data().results || {} : {};

  const users = {};

  usersSnap.forEach(docSnap => {
    const u = docSnap.data();
    users[u.uid] = {
      username: u.username || "",
      googleDisplayName: u.googleDisplayName || "",
      email: u.email || ""
    };
  });

  const scores = {};

  function getDisplayName(uid, fallbackEmail) {
    return (
      users[uid]?.username ||
      users[uid]?.googleDisplayName ||
      "Player"
    );
  }

  function ensurePlayer(uid, email) {
    if (!scores[uid]) {
      scores[uid] = {
        uid,
        display_name: getDisplayName(uid, email),
        match_points: 0,
        group_points: 0,
        bonus_points: 0,
        total_points: 0
      };
    }
  }

  groupPicksSnap.forEach(docSnap => {
    const data = docSnap.data();
    ensurePlayer(data.uid, data.email);

    Object.entries(data.picks || {}).forEach(([groupName, pick]) => {
      const result = groupResults[groupName];
      if (!result) return;

      [pick.first, pick.second].forEach(team => {
        if (!team) return;

        if (team === result.first || team === result.second) {
          scores[data.uid].group_points += 2;
        } else if (team === result.third && result.thirdQualified) {
          scores[data.uid].group_points += 1;
        }
      });
    });
  });

  matchPicksSnap.forEach(docSnap => {
    const data = docSnap.data();
    ensurePlayer(data.uid, data.email);

    Object.entries(data.picks || {}).forEach(([matchId, pick]) => {
      if (matchResults[matchId] && pick === matchResults[matchId]) {
        scores[data.uid].match_points += 2;
      }
    });
  });

  Object.values(scores).forEach(player => {
    player.total_points =
      player.group_points +
      player.match_points +
      player.bonus_points;
  });

  renderLeaderboard(Object.values(scores));
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
      <td>${escapeHTML(r.display_name)}</td>
      <td>${r.group_points + r.match_points}</td>
      <td>${r.bonus_points}</td>
      <td><strong>${r.total_points}</strong></td>
    `;
    tbody.appendChild(tr);
  });

  const playerCount = document.querySelector("#playerCount");
  const lastUpdated = document.querySelector("#lastUpdated");
  const matchCount = document.querySelector("#matchCount");

  if (playerCount) playerCount.textContent = sorted.length;
  if (lastUpdated) lastUpdated.textContent = new Date().toLocaleString();
  if (matchCount) matchCount.textContent = "—";
}

function escapeHTML(str) {
  return String(str || "").replace(/[&<>"']/g, s => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[s]));
}