import { getBudget, setBudget } from "./db.js";
import { startOfMonth, monthlyContribution, formatChf } from "./calc.js";

let currentUid = null;
let settings = { yearlyTarget: 0, monthlyTarget: 0, currentHandicap: null };

const form = document.getElementById("budgetForm");
const yearlyField = document.getElementById("budgetYearly");
const monthlyField = document.getElementById("budgetMonthly");
const handicapField = document.getElementById("currentHandicap");
const progressEl = document.getElementById("budgetProgress");

export async function initBudget(uid) {
  currentUid = uid;
  const budget = await getBudget(uid);
  settings = { yearlyTarget: 0, monthlyTarget: 0, currentHandicap: null, ...budget };
  yearlyField.value = settings.yearlyTarget || "";
  monthlyField.value = settings.monthlyTarget || "";
  handicapField.value = settings.currentHandicap ?? "";
}

export function getSettings() {
  return settings;
}

export function renderBudgetProgress(expenses) {
  const now = new Date();
  const monthTotal = expenses.reduce((sum, e) => sum + monthlyContribution(e, startOfMonth(now)), 0);

  let yearTotal = 0;
  for (let m = 0; m <= now.getMonth(); m++) {
    const target = new Date(now.getFullYear(), m, 1);
    yearTotal += expenses.reduce((sum, e) => sum + monthlyContribution(e, target), 0);
  }

  const monthlyTarget = parseFloat(monthlyField.value) || 0;
  const yearlyTarget = parseFloat(yearlyField.value) || 0;

  progressEl.innerHTML = "";
  progressEl.appendChild(buildProgressItem("Dieser Monat", monthTotal, monthlyTarget));
  progressEl.appendChild(buildProgressItem("Dieses Jahr", yearTotal, yearlyTarget));
}

function buildProgressItem(label, value, target) {
  const wrap = document.createElement("div");
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  const over = target > 0 && value > target;

  const labelEl = document.createElement("div");
  labelEl.className = "row-between";
  const left = document.createElement("span");
  left.textContent = label;
  const right = document.createElement("span");
  right.textContent = target > 0
    ? `${formatChf(value)} / ${formatChf(target)}`
    : `${formatChf(value)} (kein Ziel gesetzt)`;
  labelEl.appendChild(left);
  labelEl.appendChild(right);

  const bar = document.createElement("div");
  bar.className = "progress-bar" + (over ? " over" : "");
  const fill = document.createElement("div");
  fill.style.width = `${pct}%`;
  bar.appendChild(fill);

  wrap.appendChild(labelEl);
  wrap.appendChild(bar);
  return wrap;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  settings = {
    yearlyTarget: parseFloat(yearlyField.value) || 0,
    monthlyTarget: parseFloat(monthlyField.value) || 0,
    currentHandicap: handicapField.value !== "" ? parseFloat(handicapField.value) : null
  };
  await setBudget(currentUid, settings);
  form.dispatchEvent(new CustomEvent("budget-saved", { bubbles: true }));
});
