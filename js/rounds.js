import { listRounds, addRound, updateRound, deleteRound } from "./db.js";
import { runOcr } from "./ocr.js";

let currentUid = null;
let rounds = [];
let onChangeCallback = null;

const form = document.getElementById("roundForm");
const formTitle = document.getElementById("roundFormTitle");
const idField = document.getElementById("roundId");
const fileField = document.getElementById("scorecardFile");
const ocrStatus = document.getElementById("ocrStatus");
const ocrTextDetails = document.getElementById("ocrTextDetails");
const ocrTextEl = document.getElementById("ocrText");
const clubField = document.getElementById("roundClub");
const teeField = document.getElementById("roundTee");
const dateField = document.getElementById("roundDate");
const phcpField = document.getElementById("roundPhcp");
const holesField = document.getElementById("roundHoles");
const grossField = document.getElementById("roundGross");
const netField = document.getElementById("roundNet");
const sfBruttoField = document.getElementById("roundSfBrutto");
const sfNettoField = document.getElementById("roundSfNetto");
const countsField = document.getElementById("roundCounts");
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

function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function resetForm() {
  idField.value = "";
  form.reset();
  dateField.value = todayLocal();
  countsField.checked = false;
  holesField.value = "18";
  formTitle.textContent = "Neue Runde";
  cancelBtn.classList.add("hidden");
  ocrStatus.classList.add("hidden");
  ocrTextDetails.classList.add("hidden");
}

function fillForm(round) {
  idField.value = round.id;
  clubField.value = round.club;
  teeField.value = round.tee || "";
  dateField.value = round.date;
  phcpField.value = round.phcp ?? "";
  holesField.value = String(round.holes);
  grossField.value = round.scoreGross ?? "";
  netField.value = round.scoreNet ?? "";
  sfBruttoField.value = round.stablefordBrutto ?? "";
  sfNettoField.value = round.stablefordNetto ?? "";
  countsField.checked = !!round.handicapRelevant;
  notesField.value = round.notes || "";
  formTitle.textContent = "Runde bearbeiten";
  cancelBtn.classList.remove("hidden");
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
    const teePart = round.tee ? ` · Tee ${round.tee}` : "";
    const phcpPart = round.phcp != null ? ` · PHCP ${round.phcp}` : "";
    const sfPart = round.stablefordBrutto != null || round.stablefordNetto != null
      ? ` · Stableford ${round.stablefordBrutto ?? "–"} brutto / ${round.stablefordNetto ?? "–"} netto`
      : "";
    sub.textContent = `${formatDate(round.date)} · ${round.holes} Loch${teePart}${phcpPart}${sfPart}`;
    meta.appendChild(title);
    meta.appendChild(sub);
    if (round.handicapRelevant) {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = "Handicapwirksam";
      meta.appendChild(badge);
    }

    const right = document.createElement("div");
    right.className = "right";
    const amount = document.createElement("span");
    amount.className = "amount";
    const netPart = round.scoreNet != null ? ` / ${round.scoreNet}` : "";
    amount.textContent = `${round.scoreGross}${netPart}`;
    amount.title = "Par / Anzahl Schläge";

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
    if (parsed.tee && !teeField.value) teeField.value = parsed.tee;
    if (parsed.phcp != null && !phcpField.value) phcpField.value = parsed.phcp;
    if (parsed.holes && !idField.value) holesField.value = String(parsed.holes);
    if (parsed.par != null && !grossField.value) grossField.value = parsed.par;
    if (parsed.strokes != null && !netField.value) netField.value = parsed.strokes;
    if (parsed.sfBrutto != null && !sfBruttoField.value) sfBruttoField.value = parsed.sfBrutto;
    if (parsed.sfNetto != null && !sfNettoField.value) sfNettoField.value = parsed.sfNetto;
    if (parsed.platz && !notesField.value) notesField.value = "Platz: " + parsed.platz;

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
    tee: teeField.value.trim(),
    date: dateField.value,
    phcp: phcpField.value ? parseInt(phcpField.value, 10) : null,
    holes: parseInt(holesField.value, 10),
    scoreGross: parseInt(grossField.value, 10),
    scoreNet: netField.value ? parseInt(netField.value, 10) : null,
    stablefordBrutto: sfBruttoField.value !== "" ? parseInt(sfBruttoField.value, 10) : null,
    stablefordNetto: sfNettoField.value !== "" ? parseInt(sfNettoField.value, 10) : null,
    handicapRelevant: countsField.checked,
    notes: notesField.value.trim()
  };

  try {
    if (idField.value) {
      await updateRound(currentUid, idField.value, data);
    } else {
      await addRound(currentUid, data);
    }

    resetForm();
    await reload();
  } catch (err) {
    console.error(err);
    alert("Speichern fehlgeschlagen: " + err.message);
  }
});

cancelBtn.addEventListener("click", resetForm);

resetForm();
