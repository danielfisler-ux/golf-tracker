// Handicap-Berechnung nach Swiss Golf WHS (Broschüre "Wie funktioniert das WHS?")
// Vereinfachungen: keine PCC (=0), keine Soft-/Hard-Caps, keine Exceptional Score Reduction.

export const START_INDEX = 54.0; // Ausgangswert, solange noch kein Handicap Index besteht
const MAX_INDEX = 54.0;

const round1 = (x) => Math.round(x * 10) / 10;

export function parseRating(tee) {
  const m = String(tee || "").match(/\((\d+(?:[.,]\d+)?)\s*\/\s*(\d+)\)/);
  if (!m) return null;
  return { cr: parseFloat(m[1].replace(",", ".")), slope: parseInt(m[2], 10) };
}

// Score Differential aus Stableford (netto):
// (113 / Slope) × (Par + Playing Handicap − (Punkte − 36) − Course Rating)
// 9-Loch: Punkte-Basis 18, danach "Upscaling": + erwartetes Differential 0.52 × Index + 1.2
export function scoreDifferential(round, indexAtTime) {
  const rating = parseRating(round.tee);
  const holes = round.holes;
  if (!rating || (holes !== 9 && holes !== 18)) return null;
  if (round.scoreGross == null || round.phcp == null || round.stablefordNetto == null) return null;
  const base = holes === 18 ? 36 : 18;
  const ags = round.scoreGross + round.phcp - (round.stablefordNetto - base);
  let diff = (113 / rating.slope) * (ags - rating.cr);
  if (holes === 9) diff += 0.52 * indexAtTime + 1.2;
  return round1(diff);
}

// Handicap Index aus den Differentials (chronologisch), Tabelle für < 20 Ergebnisse
export function indexFromDiffs(diffs) {
  if (diffs.length === 0) return null;
  const last = diffs.slice(-20);
  const k = last.length;
  let take;
  let adj = 0;
  if (k <= 3) { take = 1; adj = -2; }
  else if (k === 4) { take = 1; adj = -1; }
  else if (k === 5) { take = 1; }
  else if (k === 6) { take = 2; adj = -1; }
  else if (k <= 8) { take = 2; }
  else if (k <= 11) { take = 3; }
  else if (k <= 14) { take = 4; }
  else if (k <= 16) { take = 5; }
  else if (k <= 18) { take = 6; }
  else if (k === 19) { take = 7; }
  else { take = 8; }
  const best = [...last].sort((a, b) => a - b).slice(0, take);
  const avg = best.reduce((s, v) => s + v, 0) / best.length;
  return Math.min(MAX_INDEX, round1(avg + adj));
}

export function computeHandicap(rounds, { onlyRelevant }) {
  const list = rounds
    .filter((r) => !onlyRelevant || r.handicapRelevant)
    .sort((a, b) => a.date.localeCompare(b.date));
  let idx = START_INDEX;
  let current = null;
  const diffs = [];
  const used = [];
  let skipped = 0;
  for (const r of list) {
    const d = scoreDifferential(r, idx);
    if (d == null) { skipped++; continue; }
    diffs.push(d);
    idx = indexFromDiffs(diffs);
    current = idx;
    used.push({ date: r.date, club: r.club, diff: d, index: idx });
  }
  return { index: current, count: diffs.length, skipped, used };
}
