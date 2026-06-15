import {
  db,
  storage,
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from "./firebase.js";

function expensesRef(uid) {
  return collection(db, "users", uid, "expenses");
}

function roundsRef(uid) {
  return collection(db, "users", uid, "rounds");
}

function budgetRef(uid) {
  return doc(db, "users", uid, "settings", "budget");
}

export async function listExpenses(uid) {
  const snap = await getDocs(query(expensesRef(uid), orderBy("date", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addExpense(uid, data) {
  return addDoc(expensesRef(uid), data);
}

export async function updateExpense(uid, id, data) {
  return updateDoc(doc(db, "users", uid, "expenses", id), data);
}

export async function deleteExpense(uid, id) {
  return deleteDoc(doc(db, "users", uid, "expenses", id));
}

export async function listRounds(uid) {
  const snap = await getDocs(query(roundsRef(uid), orderBy("date", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addRound(uid, data) {
  return addDoc(roundsRef(uid), data);
}

export async function updateRound(uid, id, data) {
  return updateDoc(doc(db, "users", uid, "rounds", id), data);
}

export async function deleteRound(uid, id) {
  return deleteDoc(doc(db, "users", uid, "rounds", id));
}

export async function getBudget(uid) {
  const snap = await getDoc(budgetRef(uid));
  return snap.exists() ? snap.data() : { yearlyTarget: 0, monthlyTarget: 0 };
}

export async function setBudget(uid, data) {
  return setDoc(budgetRef(uid), data, { merge: true });
}

export async function uploadScorecard(uid, file) {
  const path = `users/${uid}/scorecards/${Date.now()}_${file.name}`;
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, file);
  const url = await getDownloadURL(fileRef);
  return { url, path };
}

export async function deleteScorecard(path) {
  if (!path) return;
  try {
    await deleteObject(ref(storage, path));
  } catch (e) {
    console.warn("Konnte Scorecard-Datei nicht löschen:", e);
  }
}
