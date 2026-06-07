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
const provider = new GoogleAuthProvider();

const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const userInfo = document.getElementById("userInfo");

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

onAuthStateChanged(auth, (user) => {
  if (user) {
    loginBtn.style.display = "none";
    logoutBtn.style.display = "inline-block";
    userInfo.textContent = `Signed in as ${user.email}`;
  } else {
    loginBtn.style.display = "inline-block";
    logoutBtn.style.display = "none";
    userInfo.textContent = "Not signed in";
  }
});


const LEADERBOARD_CSV_URL = "PASTE_PUBLISHED_LEADERBOARD_CSV_URL_HERE";
const MATCHES_CSV_URL = "PASTE_PUBLISHED_MATCHES_CSV_URL_HERE";

async function fetchCSV(url) {
  if (!url || url.includes("PASTE_")) return [];
  const res = await fetch(url);
  const text = await res.text();
  return parseCSV(text);
}

function parseCSV(text) {
  const rows = [];
  let current = [];
  let value = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      value += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      current.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (value || current.length) {
        current.push(value);
        rows.push(current);
        current = [];
        value = "";
      }
      if (char === "\r" && next === "\n") i++;
    } else {
      value += char;
    }
  }

  if (value || current.length) {
    current.push(value);
    rows.push(current);
  }

  const headers = rows.shift()?.map(h => h.trim()) || [];
  return rows.map(row => Object.fromEntries(headers.map((h, i) => [h, row[i] || ""])));
}

function num(x) {
  return Number(x || 0);
}

function renderLeaderboard(rows) {
  const tbody = document.querySelector("#leaderboard tbody");
  tbody.innerHTML = "";

  const sorted = rows
    .map(r => ({
      display_name: r.display_name,
      match_points: num(r.match_points),
      survey_points: num(r.survey_points),
      bonus_points: num(r.bonus_points),
      total_points: num(r.total_points)
    }))
    .sort((a, b) => b.total_points - a.total_points || b.match_points - a.match_points);

  sorted.forEach((r, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${escapeHTML(r.display_name)}</td>
      <td>${r.match_points}</td>
      <td>${r.survey_points}</td>
      <td>${r.bonus_points}</td>
      <td><strong>${r.total_points}</strong></td>
    `;
    tbody.appendChild(tr);
  });

  document.querySelector("#playerCount").textContent = sorted.length;
}

function renderMatches(rows) {
  const tbody = document.querySelector("#matches tbody");
  tbody.innerHTML = "";

  const scored = rows.filter(r => r.winner_actual && r.winner_actual.trim());

  rows.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHTML(r.date)}</td>
      <td>${escapeHTML(r.team_a)} vs ${escapeHTML(r.team_b)}</td>
      <td>${escapeHTML(r.winner_actual || "TBD")}</td>
    `;
    tbody.appendChild(tr);
  });

  document.querySelector("#matchCount").textContent = scored.length;
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

async function init() {
  const [leaderboard, matches] = await Promise.all([
    fetchCSV(LEADERBOARD_CSV_URL),
    fetchCSV(MATCHES_CSV_URL)
  ]);

  renderLeaderboard(leaderboard);
  renderMatches(matches);
  document.querySelector("#lastUpdated").textContent = new Date().toLocaleString();
}

init().catch(err => {
  console.error(err);
  alert("Could not load league data. Check your published Google Sheet CSV URLs.");
});
