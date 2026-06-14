import { listRounds, addRound, updateRound, deleteRound, uploadScorecard, deleteScorecard } from "./db.js";
import { runOcr } from "./ocr.js";

let currentUid = null;
let rounds = [];
let onChangeCallback = null;
let pendingFile = null;
let existingScorecard = null;

const form = document.getElementById("roundForm");
const formTitle = document.getElementById("roundFormTitle");
const idField = document.getElementById("roundId");
const fileField = document.getElementById("scorecardFile");
const ocrStatus = document.getElementById("ocrStatus");
const ocrTextDetails = document.getElementById("ocrTextDetails");
const ocrTextEl = document.getElementById("ocrText");
const clubField = document.getElementById("roundClub");
const dateField = document.getElementById("roundDate");
const holesField = document.getElementById("roundHoles");
const grossField = document.getElementById("roundGross");
const netField = document.getElementById("roundNet");
const notesField = document.getElementById("roundNotes");
const cancelBtn = document.getElementById("roundCancelBtn");
const listEl = document.getElementById("roundList");

export function getRounds() {
  return rounds;
}

export async function initRounds(uid, onChange) {
  currentUid = uid;
  onChangeCallback = onChange;
  await reload();
}

async function reload() {
  rounds = await listRounds(currentUid);
  render();
  if (onChangeCallback) onChangeCallback();
}

function resetForm() {
  idField.value = "";
  form.reset();
  dateField.value = new Date().toISOString().slice(0, 10);
  holesField.value = "18";
  formTitle.textContent = "Neue Runde";
  cancelBtn.classList.add("hidden");
  pendingFile = null;
  existingScorecard = null;
  ocrStatus.classList.add("hidden");
  ocrTextDetails.classList.add("hidden");
}

function fillForm(round) {
  idField.value = round.id;
  clubField.value = round.club;
  dateField.value = round.date;
  holesField.value = String(round.holes);
  grossField.value = round.scoreGross ?? "";
  netField.value = round.scoreNet ?? "";
  notesField.value = round.notes || "";
  formTitle.textContent = "Runde bearbeiten";
  cancelBtn.classList.remove("hidden");
  pendingFile = null;
  existingScorecard = round.scorecardUrl
    ? { url: round.scorecardUrl, path: round.scorecardPath }
    : null;
  ocrStatus.classList.add("hidden");
  ocrTextDetails.classList.add("hidden");
  form.scrollIntoView({ behavior: "smooth" });
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("de-CH");
}

function render() {
  listEl.innerHTML = "";
  if (rounds.length === 0) {
    listEl.innerHTML = '<li class="hint">Noch keine Runden erfasst.</li>';
    return;
  }

  for (const round of rounds) {
    const li = document.createElement("li");
    li.className = "list-item";

    const meta = document.createElement("div");
    meta.className = "meta";
    const title = document.createElement("span");
    title.className = "title";
    title.textContent = round.club;
    const sub = document.createElement("span");
    sub.className = "sub";
    sub.textContent = `${formatDate(round.date)} · ${round.holes} Loch`;
    meta.appendChild(title);
    meta.appendChild(sub);

    if (round.scorecardUrl) {
      const link = document.createElement("a");
      link.href = round.scorecardUrl;
      link.target = "_blank";
      link.rel = "noopener";
      link.className = "sub";
      link.textContent = "📎 Scorecard ansehen";
      meta.appendChild(link);
    }

    const right = document.createElement("div");
    right.className = "right";
    const amount = document.createElement("span");
    amount.className = "amount";
    const netPart = round.scoreNet != null ? ` / ${round.scoreNet}` : "";
    amount.textContent = `${round.scoreGross}${netPart}`;
    amount.title = "Brutto / Netto";

    const editBtn = document.createElement("button");
    editBtn.className = "icon-btn";
    editBtn.textContent = "✏️";
    editBtn.title = "Bearbeiten";
    editBtn.addEventListener("click", () => fillForm(round));

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "icon-btn";
    deleteBtn.textContent = "🗑️";
    deleteBtn.title = "Löschen";
    deleteBtn.addEventListener("click", async () => {
      if (confirm("Diese Runde wirklich löschen?")) {
        await deleteScorecard(round.scorecardPath);
        await deleteRound(currentUid, round.id);
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

fileField.addEventListener("change", async () => {
  const file = fileField.files[0];
  if (!file) return;
  pendingFile = file;

  ocrStatus.classList.remove("hidden");
  ocrTextDetails.classList.add("hidden");

  try {
    const { text, parsed } = await runOcr(file, (msg) => {
      ocrStatus.textContent = msg;
    });

    ocrTextEl.textContent = text;
    ocrTextDetails.classList.remove("hidden");

    if (parsed.date) dateField.value = parsed.date;
    if (parsed.club && !clubField.value) clubField.value = parsed.club;

    ocrStatus.textContent = "Texterkennung abgeschlossen. Bitte Werte unten prüfen und ergänzen.";
  } catch (err) {
    console.error(err);
    ocrStatus.textContent = "Texterkennung fehlgeschlagen. Bitte Werte manuell eingeben.";
  }
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const data = {
    club: clubField.value.trim(),
    date: dateField.value,
    holes: parseInt(holesField.value, 10),
    scoreGross: parseInt(grossField.value, 10),
    scoreNet: netField.value ? parseInt(netField.value, 10) : null,
    notes: notesField.value.trim()
  };

  if (pendingFile) {
    if (existingScorecard) await deleteScorecard(existingScorecard.path);
    const uploaded = await uploadScorecard(currentUid, pendingFile);
    data.scorecardUrl = uploaded.url;
    data.scorecardPath = uploaded.path;
  } else if (existingScorecard) {
    data.scorecardUrl = existingScorecard.url;
    data.scorecardPath = existingScorecard.path;
  }

  if (idField.value) {
    await updateRound(currentUid, idField.value, data);
  } else {
    await addRound(currentUid, data);
  }

  resetForm();
  await reload();
});

cancelBtn.addEventListener("click", resetForm);

resetForm();
