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
          label: "Brutto",
          data: gross,
          borderColor: "#1f7a3f",
          backgroundColor: "transparent",
          spanGaps: true
        },
        {
          label: "Netto",
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
