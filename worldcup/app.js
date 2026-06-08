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
  getDoc
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
  {
    id: "M001",
    label: "🇲🇽 Mexico vs 🇿🇦 South Africa",
    options: ["🇲🇽 Mexico", "Draw", "🇿🇦 South Africa"]
  },
  {
    id: "M004",
    label: "🇺🇸 USA vs 🇵🇾 Paraguay",
    options: ["🇺🇸 USA", "Draw", "🇵🇾 Paraguay"]
  },
  {
    id: "M010",
    label: "🇳🇱 Netherlands vs 🇯🇵 Japan",
    options: ["🇳🇱 Netherlands", "Draw", "🇯🇵 Japan"]
  }
];

const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const userInfo = document.getElementById("userInfo");

const groupPicksSection = document.getElementById("groupPicksSection");
const groupPicksForm = document.getElementById("groupPicksForm");
const saveGroupPicksBtn = document.getElementById("saveGroupPicksBtn");
const groupPicksStatus = document.getElementById("groupPicksStatus");

const matchPicksSection = document.getElementById("matchPicksSection");
const matchPicksForm = document.getElementById("matchPicksForm");
const saveMatchPicksBtn = document.getElementById("saveMatchPicksBtn");
const matchPicksStatus = document.getElementById("matchPicksStatus");

loginBtn.addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error("Login failed:", error);
    alert("Google login failed. Check console for details.");
  }
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
});

onAuthStateChanged(auth, async (user) => {
  currentUser = user;

  if (user) {
    loginBtn.style.display = "none";
    logoutBtn.style.display = "inline-block";
    userInfo.textContent = `Signed in as ${user.email}`;

    await setDoc(
      doc(db, "users", user.uid),
      {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || "",
        photoURL: user.photoURL || "",
        lastLogin: new Date().toISOString()
      },
      { merge: true }
    );

    groupPicksSection.style.display = "block";
    matchPicksSection.style.display = "block";

    updateGroupRulesText();
    renderGroupPicks();
    renderMatchPicks();

    await loadExistingGroupPicks();
    await loadExistingMatchPicks();

    console.log("User saved to Firestore:", user.email);
  } else {
    loginBtn.style.display = "inline-block";
    logoutBtn.style.display = "none";
    userInfo.textContent = "Not signed in";

    groupPicksSection.style.display = "none";
    matchPicksSection.style.display = "none";
  }
});

function updateGroupRulesText() {
  const paragraph = groupPicksSection.querySelector("p");
  if (paragraph) {
    paragraph.innerHTML = `
      Pick the <strong>top 2 teams</strong> from each group.
      Scoring: <strong>2 points</strong> if your pick finishes top 2,
      <strong>1 point</strong> if your pick finishes 3rd and qualifies as a lucky loser,
      <strong>0 points</strong> otherwise.
    `;
  }
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
}

async function loadExistingGroupPicks() {
  if (!currentUser) return;

  const ref = doc(db, "groupPicks", currentUser.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) return;

  const data = snap.data();

  Object.entries(data.picks || {}).forEach(([groupName, pick]) => {
    const first = document.getElementById(`group-${groupName}-first`);
    const second = document.getElementById(`group-${groupName}-second`);

    if (first) first.value = pick.first || "";
    if (second) second.value = pick.second || "";
  });

  groupPicksStatus.textContent = "Loaded your saved group picks.";
}

saveGroupPicksBtn.addEventListener("click", async () => {
  if (!currentUser) {
    alert("Please sign in first.");
    return;
  }

  const picks = {};

  for (const groupName of Object.keys(groups)) {
    const first = document.getElementById(`group-${groupName}-first`).value;
    const second = document.getElementById(`group-${groupName}-second`).value;

    if (!first || !second) {
      alert(`Please pick both teams for Group ${groupName}.`);
      return;
    }

    if (first === second) {
      alert(`Group ${groupName}: your two picks cannot be the same team.`);
      return;
    }

    picks[groupName] = { first, second };
  }

  await setDoc(
    doc(db, "groupPicks", currentUser.uid),
    {
      uid: currentUser.uid,
      email: currentUser.email,
      picks,
      scoring: {
        correctTopTwoTeam: 2,
        correctThirdPlaceQualifier: 1,
        incorrectOrEliminated: 0,
        note: "Each player picks 2 teams per group. Each picked team earns 2 points if it finishes top 2, 1 point if it finishes 3rd and qualifies, 0 otherwise."
      },
      updatedAt: new Date().toISOString()
    },
    { merge: true }
  );

  groupPicksStatus.textContent = "✅ Group picks saved!";
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
  if (!currentUser) return;

  const ref = doc(db, "matchPicks", currentUser.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) return;

  const data = snap.data();

  Object.entries(data.picks || {}).forEach(([matchId, pick]) => {
    const select = document.getElementById(`match-${matchId}`);
    if (select) select.value = pick;
  });

  matchPicksStatus.textContent = "Loaded your saved match picks.";
}

saveMatchPicksBtn.addEventListener("click", async () => {
  if (!currentUser) {
    alert("Please sign in first.");
    return;
  }

  const picks = {};

  for (const match of testMatches) {
    const prediction = document.getElementById(`match-${match.id}`).value;

    if (!prediction) {
      alert(`Please pick: ${match.label}`);
      return;
    }

    picks[match.id] = prediction;
  }

  await setDoc(
    doc(db, "matchPicks", currentUser.uid),
    {
      uid: currentUser.uid,
      email: currentUser.email,
      picks,
      scoring: {
        groupStageMatchWinner: 2,
        roundOf32AndRoundOf16: 3,
        quarterfinalsAndLater: 5
      },
      updatedAt: new Date().toISOString()
    },
    { merge: true }
  );

  matchPicksStatus.textContent = "✅ Match picks saved!";
});