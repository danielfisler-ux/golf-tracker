import { listExpenses, addExpense, updateExpense, deleteExpense } from "./db.js";
import { formatChf } from "./calc.js";

let currentUid = null;
let expenses = [];
let onChangeCallback = null;

const form = document.getElementById("expenseForm");
const formTitle = document.getElementById("expenseFormTitle");
const idField = document.getElementById("expenseId");
const descField = document.getElementById("expenseDescription");
const categoryField = document.getElementById("expenseCategory");
const amountField = document.getElementById("expenseAmount");
const dateField = document.getElementById("expenseDate");
const recurrenceField = document.getElementById("expenseRecurrence");
const cancelBtn = document.getElementById("expenseCancelBtn");
const filterSelect = document.getElementById("expenseFilter");
const listEl = document.getElementById("expenseList");

const RECURRENCE_LABEL = {
  once: "Einmalig",
  monthly: "Monatlich",
  yearly: "Jährlich"
};

export function getExpenses() {
  return expenses;
}

export async function initExpenses(uid, onChange) {
  currentUid = uid;
  onChangeCallback = onChange;
  await reload();
}

async function reload() {
  expenses = await listExpenses(currentUid);
  render();
  if (onChangeCallback) onChangeCallback();
}

function resetForm() {
  idField.value = "";
  form.reset();
  dateField.value = new Date().toISOString().slice(0, 10);
  recurrenceField.value = "once";
  formTitle.textContent = "Neue Ausgabe";
  cancelBtn.classList.add("hidden");
}

function fillForm(expense) {
  idField.value = expense.id;
  descField.value = expense.description;
  categoryField.value = expense.category;
  amountField.value = expense.amount;
  dateField.value = expense.date;
  recurrenceField.value = expense.recurrence || "once";
  formTitle.textContent = "Ausgabe bearbeiten";
  cancelBtn.classList.remove("hidden");
  form.scrollIntoView({ behavior: "smooth" });
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("de-CH");
}

function render() {
  const filter = filterSelect.value;
  const filtered = filter === "all" ? expenses : expenses.filter((e) => e.category === filter);

  listEl.innerHTML = "";
  if (filtered.length === 0) {
    listEl.innerHTML = '<li class="hint">Keine Ausgaben vorhanden.</li>';
    return;
  }

  for (const expense of filtered) {
    const li = document.createElement("li");
    li.className = "list-item";

    const meta = document.createElement("div");
    meta.className = "meta";
    const title = document.createElement("span");
    title.className = "title";
    title.textContent = expense.description;
    const sub = document.createElement("span");
    sub.className = "sub";
    sub.textContent = `${expense.category} · ${formatDate(expense.date)}`;
    meta.appendChild(title);
    meta.appendChild(sub);

    if (expense.recurrence && expense.recurrence !== "once") {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = RECURRENCE_LABEL[expense.recurrence];
      meta.appendChild(badge);
    }

    const right = document.createElement("div");
    right.className = "right";
    const amount = document.createElement("span");
    amount.className = "amount";
    amount.textContent = formatChf(expense.amount);

    const editBtn = document.createElement("button");
    editBtn.className = "icon-btn";
    editBtn.textContent = "✏️";
    editBtn.title = "Bearbeiten";
    editBtn.addEventListener("click", () => fillForm(expense));

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "icon-btn";
    deleteBtn.textContent = "🗑️";
    deleteBtn.title = "Löschen";
    deleteBtn.addEventListener("click", async () => {
      if (confirm("Diese Ausgabe wirklich löschen?")) {
        await deleteExpense(currentUid, expense.id);
        await reload();
      }
    });

    right.appendChild(amount);
    right.appendChild(editBtn);
    right.appendChild(deleteBtn);

    li.appendChild(meta);
    li.appendChild(right);
    listEl.appendChild(li);
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = {
    description: descField.value.trim(),
    category: categoryField.value,
    amount: parseFloat(amountField.value),
    date: dateField.value,
    recurrence: recurrenceField.value
  };

  if (idField.value) {
    await updateExpense(currentUid, idField.value, data);
  } else {
    await addExpense(currentUid, data);
  }

  resetForm();
  await reload();
});

cancelBtn.addEventListener("click", resetForm);
filterSelect.addEventListener("change", render);

resetForm();
