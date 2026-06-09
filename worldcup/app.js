/*
Danz World Cup League 2026
Main client-side app for:
- Google login with Firebase Auth
- Firestore saves for users, group picks, match picks, bonus answers, and admin results
- Admin controls for paid/banned players
- Leaderboard scoring

Scoring notes:
- Group pick that finishes top 2 = 2 points
- Group pick that finishes 3rd and qualifies = 1 point
- Test match picks currently score as 2 points each
- Bonus points are stored on the user record as bonus_points
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

function cleanCountryName(team) {
  // Removes flag/emoji characters so alphabetical sorting is based on country name.
  return team.replace(/^[^\p{L}\p{N}]+/u, "").trim();
}

function sortTeamsAlphabetically(teams) {
  return [...teams].sort((a, b) =>
    cleanCountryName(a).localeCompare(cleanCountryName(b))
  );
}

const countryOptions = sortTeamsAlphabetically([...new Set(Object.values(groups).flat())]);

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

let bonusSection;
let bonusContent;
let bonusForm;
let saveBonusBtn;
let bonusStatus;
let adminPlayerList;

injectBonusSection();
injectAdminPlayerManagement();

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
    bonusSection.style.display = "none";
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
    paid: false,
    banned: false,
    bonus_points: 0,
    lastLogin: new Date().toISOString()
  }, { merge: true });

  const userSnap = await getDoc(doc(db, "users", user.uid));
  if (usernameBox) usernameBox.style.display = "block";
  if (userSnap.exists() && usernameInput) {
    usernameInput.value = userSnap.data().username || "";
  }

  groupPicksSection.style.display = "block";
  matchPicksSection.style.display = "block";
  bonusSection.style.display = "block";

  renderGroupPicks();
  renderMatchPicks();
  renderBonusQuiz();

  await loadExistingGroupPicks();
  await loadExistingMatchPicks();
  await loadExistingBonusAnswers();
  await renderLeaderboardFromFirestore();

  if (ADMIN_EMAILS.includes(user.email)) {
    adminSection.style.display = "block";
    renderAdminGroupResults();
    renderAdminMatchResults();
    await loadExistingGroupResults();
    await loadExistingMatchResults();
    await renderAdminPlayerList();
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
    <p class="mini-note">Only paid, non-banned players appear on the leaderboard.</p>
    <div id="adminPlayerList"></div>
  `;

  adminSection.insertBefore(box, adminSection.firstChild);
  adminPlayerList = document.getElementById("adminPlayerList");
}

function groupPicksAreLocked() {
  return new Date() >= GROUP_PICK_LOCK_TIME;
}

function renderGroupPicks() {
  groupPicksForm.innerHTML = "";

  Object.entries(groups).forEach(([groupName, teams]) => {
    const sortedTeams = sortTeamsAlphabetically(teams);
    const wrapper = document.createElement("div");
    wrapper.className = "pick-card";

    wrapper.innerHTML = `
      <h3>Group ${groupName}</h3>

      <label>Pick #1</label>
      <select id="group-${groupName}-first">
        <option value="">Select team</option>
        ${sortedTeams.map(team => `<option value="${team}">${team}</option>`).join("")}
      </select>

      <label>Pick #2</label>
      <select id="group-${groupName}-second">
        <option value="">Select team</option>
        ${sortedTeams.map(team => `<option value="${team}">${team}</option>`).join("")}
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
  if (groupPicksAreLocked()) return alert("Group picks are locked.");

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
    scoring: { topTwo: 2, thirdPlaceQualifier: 1, eliminated: 0 },
    updatedAt: new Date().toISOString()
  }, { merge: true });

  groupPicksStatus.textContent = "✅ Group picks saved!";
  await renderLeaderboardFromFirestore();
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
      <label>2. How many yellow cards total in the tournament?</label>
      <input id="bonus-yellowCards" type="number" min="0" placeholder="ex: 220" />
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

  if (groupPicksAreLocked()) {
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

  if (!groupPicksAreLocked()) bonusStatus.textContent = "Loaded saved bonus answers.";
}

async function saveBonusAnswers() {
  if (!currentUser) return alert("Please sign in first.");
  if (groupPicksAreLocked()) return alert("Bonus answers are locked.");

  const answers = {
    mostGoalsCountry: getValue("bonus-mostGoalsCountry"),
    yellowCards: getValue("bonus-yellowCards"),
    usaOut: getValue("bonus-usaOut"),
    semifinalist: getValue("bonus-semifinalist"),
    winner: getValue("bonus-winner")
  };

  for (const [key, value] of Object.entries(answers)) {
    if (!value) return alert("Please answer all bonus questions before saving.");
  }

  await setDoc(doc(db, "bonusAnswers", currentUser.uid), {
    uid: currentUser.uid,
    email: currentUser.email,
    answers,
    points: 0,
    updatedAt: new Date().toISOString()
  }, { merge: true });

  bonusStatus.textContent = "✅ Bonus answers saved!";
}

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
    setValue(`result-match-${matchId}`, result);
  });
}

saveMatchResultsBtn?.addEventListener("click", async () => {
  const results = {};

  for (const match of testMatches) {
    results[match.id] = getValue(`result-match-${match.id}`);
  }

  await setDoc(doc(db, "matchResults", "official"), {
    results,
    updatedAt: new Date().toISOString(),
    updatedBy: currentUser.email
  }, { merge: true });

  matchResultsStatus.textContent = "✅ Match results saved!";
  await renderLeaderboardFromFirestore();
});

async function renderAdminPlayerList() {
  if (!adminPlayerList) return;

  const usersSnap = await getDocs(collection(db, "users"));
  adminPlayerList.innerHTML = "";

  usersSnap.forEach(docSnap => {
    const u = docSnap.data();
    const row = document.createElement("div");
    row.className = "admin-player-row";

    row.innerHTML = `
      <strong>${escapeHTML(u.username || u.googleDisplayName || "Player")}</strong>
      <span>${escapeHTML(u.email || "")}</span>
      <label><input type="checkbox" data-uid="${u.uid}" data-field="paid" ${u.paid ? "checked" : ""}/> Paid</label>
      <label><input type="checkbox" data-uid="${u.uid}" data-field="banned" ${u.banned ? "checked" : ""}/> Banned</label>
    `;

    adminPlayerList.appendChild(row);
  });

  adminPlayerList.querySelectorAll("input[type='checkbox']").forEach(input => {
    input.addEventListener("change", async (e) => {
      const uid = e.target.dataset.uid;
      const field = e.target.dataset.field;
      await setDoc(doc(db, "users", uid), {
        [field]: e.target.checked,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      await renderLeaderboardFromFirestore();
    });
  });
}

refreshLeaderboardBtn?.addEventListener("click", async () => {
  await renderAdminPlayerList();
  await renderLeaderboardFromFirestore();
});

async function renderLeaderboardFromFirestore() {
  const usersSnap = await getDocs(collection(db, "users"));
  const groupPicksSnap = await getDocs(collection(db, "groupPicks"));
  const matchPicksSnap = await getDocs(collection(db, "matchPicks"));
  const bonusAnswersSnap = await getDocs(collection(db, "bonusAnswers"));

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
      email: u.email || "",
      paid: !!u.paid,
      banned: !!u.banned,
      bonus_points: Number(u.bonus_points || 0)
    };
  });

  const scores = {};

  function ensurePlayer(uid, email) {
    const user = users[uid];
    if (!user || !user.paid || user.banned) return null;

    if (!scores[uid]) {
      scores[uid] = {
        uid,
        display_name: user.username || user.googleDisplayName || "Player",
        match_points: 0,
        group_points: 0,
        bonus_points: user.bonus_points || 0,
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

  matchPicksSnap.forEach(docSnap => {
    const data = docSnap.data();
    const player = ensurePlayer(data.uid, data.email);
    if (!player) return;

    Object.entries(data.picks || {}).forEach(([matchId, pick]) => {
      if (matchResults[matchId] && pick === matchResults[matchId]) {
        player.match_points += 2;
      }
    });
  });

  bonusAnswersSnap.forEach(docSnap => {
    const data = docSnap.data();
    const player = ensurePlayer(data.uid, data.email);
    if (!player) return;
  });

  Object.values(scores).forEach(player => {
    player.total_points = player.group_points + player.match_points + player.bonus_points;
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

function getValue(id) {
  return document.getElementById(id)?.value || "";
}

function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value || "";
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