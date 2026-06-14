export function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function monthlyContribution(expense, target) {
  const start = new Date(expense.date);
  if (expense.recurrence === "monthly") {
    return target >= startOfMonth(start) ? expense.amount : 0;
  }
  if (expense.recurrence === "yearly") {
    return target >= startOfMonth(start) && target.getMonth() === start.getMonth() ? expense.amount : 0;
  }
  return monthKey(start) === monthKey(target) ? expense.amount : 0;
}

export function estimateAnnualCost(expense) {
  if (expense.recurrence === "monthly") return expense.amount * 12;
  if (expense.recurrence === "yearly") return expense.amount;
  const year = new Date(expense.date).getFullYear();
  return year === new Date().getFullYear() ? expense.amount : 0;
}

export function formatChf(amount) {
  return new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" }).format(amount);
}
