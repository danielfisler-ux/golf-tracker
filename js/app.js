import { isFirebaseConfigured } from "./firebase.js";
import { login, logout, watchAuth } from "./auth.js";
import { initExpenses, getExpenses } from "./expenses.js";
import { initRounds, getRounds } from "./rounds.js";
import { renderStats } from "./stats.js";
import { initBudget, renderBudgetProgress } from "./budget.js";
import { computeHandicap } from "./handicap.js";
import { startOfMonth, monthlyContribution, formatChf } from "./calc.js";

const PAGE_SIZE = 5;
let roundsPage = 0;

function fmtHcp(x) {
  return x == null ? "–" : x.toLocaleString("de-CH", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

const views = ["dashboard", "expenses", "rounds", "stats", "budget"];

const userBox = document.getElementById("userBox");
const loginBtn = document.getElementById("loginBtn");
const configWarning = document.getElementById("configWarning");
const bottomnav = document.getElementById("bottomnav");

if (!isFirebaseConfigured) {
  configWarning.classList.remove("hidden");
  loginBtn.disabled = true;
}

loginBtn.addEventListener("click", () => {
  login().catch((err) => alert("Anmeldung fehlgeschlagen: " + err.message));
});

bottomnav.addEventListener("click", (e) => {
  const btn = e.target.closest(".navbtn");
  if (!btn) return;
  showView(btn.dataset.view);
});

function showView(name) {
  for (const v of views) {
    document.getElementById(`view-${v}`).classList.toggle("hidden", v !== name);
  }
  for (const btn of bottomnav.querySelectorAll(".navbtn")) {
    btn.classList.toggle("active", btn.dataset.view === name);
  }
  if (name === "dashboard") { roundsPage = 0; renderDashboard(); }
  if (name === "stats") renderStats(getExpenses(), getRounds());
  if (name === "budget") renderBudgetProgress(getExpenses());
}

function refreshDerivedViews() {
  const dashboardVisible = !document.getElementById("view-dashboard").classList.contains("hidden");
  const statsVisible = !document.getElementById("view-stats").classList.contains("hidden");
  const budgetVisible = !document.getElementById("view-budget").classList.contains("hidden");

  if (dashboardVisible) renderDashboard();
  if (statsVisible) renderStats(getExpenses(), getRounds());
  if (budgetVisible) renderBudgetProgress(getExpenses());
}

function renderDashboard() {
  const expenses = getExpenses();
  const rounds = getRounds();
  const now = new Date();

  const monthTotal = expenses.reduce((sum, e) => sum + monthlyContribution(e, startOfMonth(now)), 0);

  let yearTotal = 0;
  for (let m = 0; m <= now.getMonth(); m++) {
    yearTotal += expenses.reduce((sum, e) => sum + monthlyContribution(e, new Date(now.getFullYear(), m, 1)), 0);
  }

  const roundsThisYear = rounds.filter((r) => new Date(r.date).getFullYear() === now.getFullYear());
  const hcpEff = computeHandicap(rounds, { onlyRelevant: true }).index;
  const hcpAll = computeHandicap(rounds, { onlyRelevant: false }).index;

  const cards = [
    { label: "Ausgaben dieses Jahr", value: formatChf(yearTotal) },
    { label: "Ausgaben diesen Monat", value: formatChf(monthTotal) },
    { label: "Handicap (handicapwirksam)", value: fmtHcp(hcpEff) },
    { label: "Handicap (alle Runden)", value: fmtHcp(hcpAll) },
    { label: "Runden dieses Jahr", value: String(roundsThisYear.length) }
  ];

  const cardsEl = document.getElementById("dashboardCards");
  cardsEl.innerHTML = "";
  for (const c of cards) {
    const div = document.createElement("div");
    div.className = "stat-card";
    div.innerHTML = `<div class="label">${c.label}</div><div class="value">${c.value}</div>`;
    cardsEl.appendChild(div);
  }

  const recentRoundsList = document.getElementById("recentRoundsList");
  recentRoundsList.innerHTML = "";
  const sorted = [...rounds].sort((a, b) => new Date(b.date) - new Date(a.date));
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  roundsPage = Math.min(Math.max(roundsPage, 0), pages - 1);
  const recentRounds = sorted.slice(roundsPage * PAGE_SIZE, (roundsPage + 1) * PAGE_SIZE);

  const pager = document.getElementById("roundsPager");
  pager.classList.toggle("hidden", sorted.length <= PAGE_SIZE);
  document.getElementById("roundsPageInfo").textContent = `${roundsPage + 1} / ${pages}`;
  document.getElementById("roundsNewer").disabled = roundsPage === 0;
  document.getElementById("roundsOlder").disabled = roundsPage >= pages - 1;

  if (recentRounds.length === 0) {
    recentRoundsList.innerHTML = '<li class="hint">Noch keine Runden erfasst.</li>';
  }

  for (const round of recentRounds) {
    const li = document.createElement("li");
    li.className = "list-item";
    const netPart = round.scoreNet != null ? ` / ${round.scoreNet}` : "";
    const sfPart = round.stablefordNetto != null ? ` / ${round.stablefordNetto}` : "";
    li.innerHTML = `
      <div class="meta">
        <span class="title">⛳ ${round.club}</span>
        <span class="sub">${new Date(round.date).toLocaleDateString("de-CH")}</span>
      </div>
      <div class="right"><span class="amount" title="Par / Anzahl Schläge / Stableford netto">${round.scoreGross}${netPart}${sfPart}</span></div>
    `;
    recentRoundsList.appendChild(li);
  }
}

document.getElementById("roundsNewer").addEventListener("click", () => { roundsPage--; renderDashboard(); });
document.getElementById("roundsOlder").addEventListener("click", () => { roundsPage++; renderDashboard(); });

document.getElementById("budgetForm").addEventListener("budget-saved", () => {
  renderBudgetProgress(getExpenses());
  renderDashboard();
});

function showLoggedOut() {
  document.getElementById("view-login").classList.remove("hidden");
  for (const v of views) document.getElementById(`view-${v}`).classList.add("hidden");
  bottomnav.classList.add("hidden");
  userBox.innerHTML = "";
}

async function showLoggedIn(user) {
  document.getElementById("view-login").classList.add("hidden");
  bottomnav.classList.remove("hidden");

  userBox.innerHTML = "";
  const img = document.createElement("img");
  img.src = user.photoURL || "icons/icon-192.svg";
  const name = document.createElement("span");
  name.textContent = user.displayName || user.email || "";
  const logoutBtn = document.createElement("button");
  logoutBtn.textContent = "Abmelden";
  logoutBtn.addEventListener("click", () => logout());
  userBox.appendChild(img);
  userBox.appendChild(name);
  userBox.appendChild(logoutBtn);

  await Promise.all([
    initExpenses(user.uid, refreshDerivedViews),
    initRounds(user.uid, refreshDerivedViews),
    initBudget(user.uid)
  ]);

  showView("dashboard");
}

if (isFirebaseConfigured) {
  watchAuth((user) => {
    if (user) {
      showLoggedIn(user);
    } else {
      showLoggedOut();
    }
  });
} else {
  showLoggedOut();
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((err) => console.warn("SW registration failed", err));
  });
}
