import { monthlyContribution, yearlyContribution } from "./calc.js";
import { computeHandicap, START_INDEX } from "./handicap.js";
import { getSettings } from "./budget.js";

let categoryChart, monthlyChart, scoreChart;
let cachedExpenses = [];
let cachedRounds = [];
let initialized = false;

const yearSelect = document.getElementById("statsYear");
const monthSelect = document.getElementById("statsMonth");

const CATEGORY_COLORS = {
  "Greenfee": "#1f7a3f",
  "Mitgliedschaft": "#2e9e5b",
  "Driving Range": "#14b8a6",
  "Golf Pro Stunde": "#0ea5e9",
  "Ausrüstung": "#f59e0b",
  "Bälle & Zubehör": "#3b82f6",
  "Kleidung": "#8b5cf6",
  "Reise": "#ec4899",
  "Sonstiges": "#6b7280"
};

const MONTH_LABELS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

export function renderStats(expenses, rounds) {
  cachedExpenses = expenses;
  cachedRounds = rounds;
  setupControls();

  const year = parseInt(yearSelect.value, 10);
  const month = monthSelect.value === "all" ? null : parseInt(monthSelect.value, 10);

  renderHandicap(rounds);
  renderWaldkirch(rounds);
  renderCategoryChart(expenses, year, month);
  renderMonthlyChart(expenses, year);
  renderScoreChart(rounds, year, month);
}

function setupControls() {
  const years = new Set([new Date().getFullYear()]);
  for (const e of cachedExpenses) years.add(new Date(e.date).getFullYear());
  for (const r of cachedRounds) years.add(new Date(r.date).getFullYear());
  const sortedYears = [...years].sort((a, b) => b - a);

  const existing = new Set([...yearSelect.options].map((o) => o.value));
  const missing = sortedYears.filter((y) => !existing.has(String(y)));
  if (missing.length > 0 || yearSelect.options.length === 0) {
    const selected = yearSelect.value;
    yearSelect.innerHTML = "";
    for (const y of sortedYears) {
      const opt = document.createElement("option");
      opt.value = String(y);
      opt.textContent = String(y);
      yearSelect.appendChild(opt);
    }
    yearSelect.value = selected && existing.has(selected) ? selected : String(new Date().getFullYear());
  }

  if (!initialized) {
    yearSelect.addEventListener("change", () => renderStats(cachedExpenses, cachedRounds));
    monthSelect.addEventListener("change", () => renderStats(cachedExpenses, cachedRounds));
    initialized = true;
  }
}

function renderCategoryChart(expenses, year, month) {
  const totals = {};
  for (const e of expenses) {
    const amount = month != null
      ? monthlyContribution(e, new Date(year, month, 1))
      : yearlyContribution(e, year);
    if (amount > 0) totals[e.category] = (totals[e.category] || 0) + amount;
  }
  const labels = Object.keys(totals).filter((k) => totals[k] > 0);
  const data = labels.map((l) => Math.round(totals[l] * 100) / 100);
  const colors = labels.map((l) => CATEGORY_COLORS[l] || "#6b7280");

  const periodLabel = month != null
    ? `${MONTH_LABELS[month]} ${year}`
    : String(year);

  if (categoryChart) categoryChart.destroy();
  categoryChart = new Chart(document.getElementById("categoryChart"), {
    type: "doughnut",
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors }]
    },
    options: {
      plugins: {
        legend: { position: "bottom" },
        title: { display: true, text: `Ausgaben ${periodLabel} (CHF)` }
      }
    }
  });
}

function renderMonthlyChart(expenses, year) {
  const months = [];
  for (let m = 0; m < 12; m++) {
    months.push(new Date(year, m, 1));
  }

  const totals = months.map((m) =>
    expenses.reduce((sum, e) => sum + monthlyContribution(e, m), 0)
  );

  if (monthlyChart) monthlyChart.destroy();
  monthlyChart = new Chart(document.getElementById("monthlyChart"), {
    type: "bar",
    data: {
      labels: MONTH_LABELS,
      datasets: [
        {
          label: "Ausgaben (CHF)",
          data: totals.map((t) => Math.round(t * 100) / 100),
          backgroundColor: "#1f7a3f"
        }
      ]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } }
    }
  });
}

function renderScoreChart(rounds, year, month) {
  const filtered = rounds.filter((r) => {
    const d = new Date(r.date);
    if (d.getFullYear() !== year) return false;
    if (month != null && d.getMonth() !== month) return false;
    return true;
  });
  const sorted = [...filtered].sort((a, b) => new Date(a.date) - new Date(b.date));
  const labels = sorted.map((r) => new Date(r.date).toLocaleDateString("de-CH"));
  const gross = sorted.map((r) => r.scoreGross ?? null);
  const net = sorted.map((r) => r.scoreNet ?? null);

  if (scoreChart) scoreChart.destroy();
  scoreChart = new Chart(document.getElementById("scoreChart"), {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Par",
          data: gross,
          borderColor: "#1f7a3f",
          backgroundColor: "transparent",
          spanGaps: true
        },
        {
          label: "Anzahl Schläge",
          data: net,
          borderColor: "#3b82f6",
          backgroundColor: "transparent",
          spanGaps: true
        }
      ]
    },
    options: {
      plugins: { legend: { position: "bottom" } },
      scales: { y: { beginAtZero: false } }
    }
  });
}


function fmt1(x) {
  return x == null ? "–" : x.toLocaleString("de-CH", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function infoText(res, label) {
  if (res.count === 0) return res.skipped ? `${res.skipped} ohne Daten übersprungen` : `Noch keine ${label}`;
  const skipped = res.skipped ? `, ${res.skipped} ohne Daten übersprungen` : "";
  return `aus ${res.count} ${label}${skipped}`;
}

function renderHandicap(rounds) {
  const effective = computeHandicap(rounds, { onlyRelevant: true });
  const all = computeHandicap(rounds, { onlyRelevant: false });

  document.getElementById("hcpEffective").textContent = fmt1(effective.index);
  document.getElementById("hcpEffectiveInfo").textContent = infoText(effective, "handicapwirksamen Runden");
  document.getElementById("hcpAll").textContent = fmt1(all.index);
  document.getElementById("hcpAllInfo").textContent = infoText(all, "Runden");

  const official = getSettings().currentHandicap;
  const officialPart = official != null ? ` Offiziell (Budget-Tab): ${fmt1(official)}.` : "";
  document.getElementById("hcpNote").textContent =
    "Berechnet nach Swiss Golf WHS aus Stableford netto (8 aus 20, 9-Loch hochgerechnet), ohne PCC. " +
    `Ausgangswert ${fmt1(START_INDEX)}.` + officialPart;
}

const WALDKIRCH_COURSES = [
  { name: "Rot", word: "rot", tee: /^R\d/i, color: "#c0392b" },
  { name: "Grün", word: "grün|gruen", tee: /^Gr\d/i, color: "#2e9e5b" },
  { name: "Gelb", word: "gelb", tee: /^Ge\d|^Y\d/i, color: "#eab308" },
  { name: "Blau", word: "blau", tee: /^B\d/i, color: "#3b82f6" }
];

function hasWord(text, words) {
  return new RegExp(`(^|[^a-zäöüéè])(${words})([^a-zäöüéè]|$)`, "i").test(text);
}

function waldkirchCourse(round) {
  const text = `${round.club || ""} ${round.notes || ""}`;
  if (!/waldkirch/i.test(text)) return null;
  const tee = (round.tee || "").trim();
  for (const c of WALDKIRCH_COURSES) {
    if (hasWord(`${round.notes || ""} ${tee}`, c.word) || c.tee.test(tee)) return c.name;
  }
  return null;
}

function renderWaldkirch(rounds) {
  const body = document.getElementById("waldkirchBody");
  body.innerHTML = "";
  for (const c of WALDKIRCH_COURSES) {
    const rs = rounds.filter((r) => r.holes === 9 && r.stablefordNetto != null && waldkirchCourse(r) === c.name);
    const strokes = rs.map((r) => r.stablefordNetto);
    const pars = [...new Set(rs.map((r) => r.scoreGross).filter((p) => p != null))].sort((a, b) => a - b);

    const tr = document.createElement("tr");
    const nameCell = document.createElement("td");
    const dot = document.createElement("span");
    dot.className = "dot";
    dot.style.background = c.color;
    nameCell.appendChild(dot);
    nameCell.appendChild(document.createTextNode(c.name));
    tr.appendChild(nameCell);

    const values = rs.length === 0
      ? [String(0), "–", "–", "–", "–"]
      : [
          String(rs.length),
          pars.join(" / "),
          String(Math.max(...strokes)),
          String(Math.min(...strokes)),
          fmt1(strokes.reduce((s, v) => s + v, 0) / strokes.length)
        ];
    for (const v of values) {
      const td = document.createElement("td");
      td.textContent = v;
      tr.appendChild(td);
    }
    body.appendChild(tr);
  }
}
import { monthlyContribution, yearlyContribution } from "./calc.js";

let categoryChart, monthlyChart, scoreChart;
let cachedExpenses = [];
let cachedRounds = [];
let initialized = false;

const yearSelect = document.getElementById("statsYear");
const monthSelect = document.getElementById("statsMonth");

const CATEGORY_COLORS = {
  "Greenfee": "#1f7a3f",
  "Mitgliedschaft": "#2e9e5b",
  "Driving Range": "#14b8a6",
  "Golf Pro Stunde": "#0ea5e9",
  "Ausrüstung": "#f59e0b",
  "Bälle & Zubehör": "#3b82f6",
  "Kleidung": "#8b5cf6",
  "Reise": "#ec4899",
  "Sonstiges": "#6b7280"
};

const MONTH_LABELS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

export function renderStats(expenses, rounds) {
  cachedExpenses = expenses;
  cachedRounds = rounds;
  setupControls();

  const year = parseInt(yearSelect.value, 10);
  const month = monthSelect.value === "all" ? null : parseInt(monthSelect.value, 10);

  renderCategoryChart(expenses, year, month);
  renderMonthlyChart(expenses, year);
  renderScoreChart(rounds, year, month);
}

function setupControls() {
  const years = new Set([new Date().getFullYear()]);
  for (const e of cachedExpenses) years.add(new Date(e.date).getFullYear());
  for (const r of cachedRounds) years.add(new Date(r.date).getFullYear());
  const sortedYears = [...years].sort((a, b) => b - a);

  const existing = new Set([...yearSelect.options].map((o) => o.value));
  const missing = sortedYears.filter((y) => !existing.has(String(y)));
  if (missing.length > 0 || yearSelect.options.length === 0) {
    const selected = yearSelect.value;
    yearSelect.innerHTML = "";
    for (const y of sortedYears) {
      const opt = document.createElement("option");
      opt.value = String(y);
      opt.textContent = String(y);
      yearSelect.appendChild(opt);
    }
    yearSelect.value = selected && existing.has(selected) ? selected : String(new Date().getFullYear());
  }

  if (!initialized) {
    yearSelect.addEventListener("change", () => renderStats(cachedExpenses, cachedRounds));
    monthSelect.addEventListener("change", () => renderStats(cachedExpenses, cachedRounds));
    initialized = true;
  }
}

function renderCategoryChart(expenses, year, month) {
  const totals = {};
  for (const e of expenses) {
    const amount = month != null
      ? monthlyContribution(e, new Date(year, month, 1))
      : yearlyContribution(e, year);
    if (amount > 0) totals[e.category] = (totals[e.category] || 0) + amount;
  }
  const labels = Object.keys(totals).filter((k) => totals[k] > 0);
  const data = labels.map((l) => Math.round(totals[l] * 100) / 100);
  const colors = labels.map((l) => CATEGORY_COLORS[l] || "#6b7280");

  const periodLabel = month != null
    ? `${MONTH_LABELS[month]} ${year}`
    : String(year);

  if (categoryChart) categoryChart.destroy();
  categoryChart = new Chart(document.getElementById("categoryChart"), {
    type: "doughnut",
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors }]
    },
    options: {
      plugins: {
        legend: { position: "bottom" },
        title: { display: true, text: `Ausgaben ${periodLabel} (CHF)` }
      }
    }
  });
}

function renderMonthlyChart(expenses, year) {
  const months = [];
  for (let m = 0; m < 12; m++) {
    months.push(new Date(year, m, 1));
  }

  const totals = months.map((m) =>
    expenses.reduce((sum, e) => sum + monthlyContribution(e, m), 0)
  );

  if (monthlyChart) monthlyChart.destroy();
  monthlyChart = new Chart(document.getElementById("monthlyChart"), {
    type: "bar",
    data: {
      labels: MONTH_LABELS,
      datasets: [
        {
          label: "Ausgaben (CHF)",
          data: totals.map((t) => Math.round(t * 100) / 100),
          backgroundColor: "#1f7a3f"
        }
      ]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } }
    }
  });
}

function renderScoreChart(rounds, year, month) {
  const filtered = rounds.filter((r) => {
    const d = new Date(r.date);
    if (d.getFullYear() !== year) return false;
    if (month != null && d.getMonth() !== month) return false;
    return true;
  });
  const sorted = [...filtered].sort((a, b) => new Date(a.date) - new Date(b.date));
  const labels = sorted.map((r) => new Date(r.date).toLocaleDateString("de-CH"));
  const gross = sorted.map((r) => r.scoreGross ?? null);
  const net = sorted.map((r) => r.scoreNet ?? null);

  if (scoreChart) scoreChart.destroy();
  scoreChart = new Chart(document.getElementById("scoreChart"), {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Par",
          data: gross,
          borderColor: "#1f7a3f",
          backgroundColor: "transparent",
          spanGaps: true
        },
        {
          label: "Anzahl Schläge",
          data: net,
          borderColor: "#3b82f6",
          backgroundColor: "transparent",
          spanGaps: true
        }
      ]
    },
    options: {
      plugins: { legend: { position: "bottom" } },
      scales: { y: { beginAtZero: false } }
    }
  });
}
