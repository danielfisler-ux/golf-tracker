if (typeof window !== "undefined" && window.pdfjsLib) {
  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
}

async function pdfToCanvas(file) {
  const data = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d");
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
}

// Digitale PDFs (z.B. PC CADDIE) enthalten echten Text – der ist exakter als OCR.
async function pdfToText(file) {
  const data = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data }).promise;
  const lines = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const items = content.items
      .filter((it) => it.str && it.str.trim())
      .map((it) => ({ str: it.str.trim(), x: it.transform[4], y: it.transform[5] }))
      .sort((a, b) => b.y - a.y || a.x - b.x);
    let row = [];
    let rowY = null;
    for (const it of items) {
      if (rowY !== null && Math.abs(it.y - rowY) > 2) {
        lines.push(row.sort((a, b) => a.x - b.x).map((r) => r.str).join(" "));
        row = [];
      }
      if (row.length === 0) rowY = it.y;
      row.push(it);
    }
    if (row.length) lines.push(row.sort((a, b) => a.x - b.x).map((r) => r.str).join(" "));
  }
  return lines.join("\n");
}

const TOTAL_LABEL = /^(\d{1,2}\s*-\s*\d{1,2}|out|in|total|gesamt)\b/i;

function lastNumbers(line) {
  // Zahlen nach dem Label der Summenzeile: Par, Brutto-SF, Netto-SF, Ergebnis (Schläge)
  const rest = line.replace(TOTAL_LABEL, " ");
  return (rest.match(/\d+/g) || []).map((n) => parseInt(n, 10));
}

export function parseText(text) {
  const result = {
    date: null,
    club: null,
    platz: null,
    tee: null,
    phcp: null,
    holes: null,
    par: null,
    strokes: null,
    sfBrutto: null,
    sfNetto: null
  };

  const dateMatch = text.match(/(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/);
  if (dateMatch) {
    const [, day, month, year] = dateMatch;
    result.date = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  const valueAfter = (regex) => {
    const i = lines.findIndex((l) => regex.test(l));
    if (i === -1) return null;
    const same = lines[i].replace(regex, "").trim();
    return same || lines[i + 1] || null;
  };

  result.platz = valueAfter(/^platz\s*:?/i);
  result.club = valueAfter(/^club\s*:?/i);
  if (!result.club) {
    const golfLine = lines.find((l) => /golf/i.test(l));
    result.club = golfLine || result.platz;
  }
  result.tee = valueAfter(/^tee\s*:?/i);

  const phcpMatch = text.match(/phcp\s*:?\s*(\d+)/i);
  if (phcpMatch) result.phcp = parseInt(phcpMatch[1], 10);

  // Lochzeilen: Loch, Par, HCP, Brutto, Netto, Ergebnis (Summenzeilen ausgeschlossen)
  const holeRowRegex = /^(\d{1,2})\D+\d+\D+\d+\D+\d+\D+\d+\D+\d+$/;
  const holeCount = lines.filter((l) => !TOTAL_LABEL.test(l) && holeRowRegex.test(l)).length;
  if (holeCount === 9 || holeCount === 18) result.holes = holeCount;

  // Summenzeile: bei 18 Loch "1 - 18", sonst "1 - 9"; Ersatz: OUT + IN
  const wanted = result.holes === 18 ? /^1\s*-\s*18\b/ : /^1\s*-\s*9\b/;
  const totalsLine = lines.find((l) => wanted.test(l)) || lines.find((l) => /^1\s*-\s*18\b/.test(l));
  let nums = totalsLine ? lastNumbers(totalsLine) : [];
  if (nums.length < 4) {
    const out = lines.find((l) => /^out\b/i.test(l));
    const inn = lines.find((l) => /^in\b/i.test(l));
    if (out && inn) {
      const a = lastNumbers(out);
      const b = lastNumbers(inn);
      if (a.length >= 4 && b.length >= 4) nums = a.map((v, i) => v + b[i]);
    }
  }
  if (nums.length >= 4) {
    result.par = nums[0];
    result.sfBrutto = nums[1];
    result.sfNetto = nums[2];
    result.strokes = nums[3];
  }

  return result;
}

export async function runOcr(file, onStatus) {
  onStatus("Datei wird vorbereitet...");

  let imageSource = file;
  if (file.type === "application/pdf") {
    try {
      const text = await pdfToText(file);
      if (text.replace(/\s/g, "").length > 80) {
        onStatus("PDF-Text gelesen.");
        return { text, parsed: parseText(text) };
      }
    } catch (err) {
      console.warn("PDF-Text konnte nicht gelesen werden, wechsle zu OCR", err);
    }
    imageSource = await pdfToCanvas(file);
  }

  onStatus("Text wird erkannt (OCR)... das kann eine Weile dauern.");

  const { data } = await window.Tesseract.recognize(imageSource, "deu", {
    logger: (m) => {
      if (m.status === "recognizing text") {
        onStatus(`Texterkennung läuft... ${Math.round(m.progress * 100)}%`);
      }
    }
  });

  const parsed = parseText(data.text);
  onStatus("Texterkennung abgeschlossen.");
  return { text: data.text, parsed };
}
