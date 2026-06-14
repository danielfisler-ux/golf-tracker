import { monthlyContribution, estimateAnnualCost } from "./calc.js";

let categoryChart, monthlyChart, scoreChart;

const CATEGORY_COLORS = {
  "Greenfee": "#1f7a3f",
  "Mitgliedschaft": "#2e9e5b",
  "Ausrüstung": "#f59e0b",
  "Bälle & Zubehör": "#3b82f6",
  "Kleidung": "#8b5cf6",
  "Reise": "#ec4899",
  "Sonstiges": "#6b7280"
};

function monthLabel(date) {
  return date.toLocaleDateString("de-CH", { month: "short", year: "2-digit" });
}

export function renderStats(expenses, rounds) {
  renderCategoryChart(expenses);
  renderMonthlyChart(expenses);
  renderScoreChart(rounds);
}

function renderCategoryChart(expenses) {
  const totals = {};
  for (const e of expenses) {
    totals[e.category] = (totals[e.category] || 0) + estimateAnnualCost(e);
  }
  const labels = Object.keys(totals).filter((k) => totals[k] > 0);
  const data = labels.map((l) => Math.round(totals[l] * 100) / 100);
  const colors = labels.map((l) => CATEGORY_COLORS[l] || "#6b7280");

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
        title: { display: true, text: "Geschätzte Jahreskosten (CHF)" }
      }
    }
  });
}

function renderMonthlyChart(expenses) {
  const months = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    months.push(new Date(now.getFullYear(), now.getMonth() - i, 1));
  }

  const totals = months.map((m) =>
    expenses.reduce((sum, e) => sum + monthlyContribution(e, m), 0)
  );

  if (monthlyChart) monthlyChart.destroy();
  monthlyChart = new Chart(document.getElementById("monthlyChart"), {
    type: "bar",
    data: {
      labels: months.map(monthLabel),
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

function renderScoreChart(rounds) {
  const sorted = [...rounds].sort((a, b) => new Date(a.date) - new Date(b.date));
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
