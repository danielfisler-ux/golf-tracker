if (window.pdfjsLib) {
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

function parseText(text) {
  const result = {
    date: null,
    club: null,
    tee: null,
    phcp: null,
    holes: null,
    par: null,
    strokes: null
  };

  const dateMatch = text.match(/(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/);
  if (dateMatch) {
    const [, day, month, year] = dateMatch;
    result.date = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  const platzIndex = lines.findIndex((l) => /platz\s*:?/i.test(l));
  if (platzIndex !== -1) {
    const sameLine = lines[platzIndex].replace(/platz\s*:?/i, "").trim();
    result.club = sameLine || lines[platzIndex + 1] || null;
  } else {
    const golfLine = lines.find((l) => /golf/i.test(l));
    if (golfLine) result.club = golfLine;
  }

  const teeIndex = lines.findIndex((l) => /^tee\s*:?/i.test(l));
  if (teeIndex !== -1) {
    const sameLine = lines[teeIndex].replace(/^tee\s*:?/i, "").trim();
    result.tee = sameLine || lines[teeIndex + 1] || null;
  }

  const phcpMatch = text.match(/phcp\s*:?\s*(\d+)/i);
  if (phcpMatch) result.phcp = parseInt(phcpMatch[1], 10);

  // Rows of the scorecard table: hole number followed by 5 more numbers
  // (Par, HCP, Brutto, Netto, Ergebnis)
  const holeRowRegex = /^(\d{1,2})\D+\d+\D+\d+\D+\d+\D+\d+\D+\d+$/;
  const holeCount = lines.filter((l) => holeRowRegex.test(l)).length;
  if (holeCount === 9 || holeCount === 18) result.holes = holeCount;

  // Totals row, e.g. "1 - 9  35  ---  3  21  68" → Par-Total = 35, Ergebnis-Total = 68
  const totalsLine = lines.find((l) => /^\d{1,2}\s*-\s*\d{1,2}\b/.test(l));
  if (totalsLine) {
    const nums = totalsLine.match(/\d+/g) || [];
    if (nums.length >= 4) {
      result.par = parseInt(nums[2], 10);
      result.strokes = parseInt(nums[nums.length - 1], 10);
    }
  }

  return result;
}

export async function runOcr(file, onStatus) {
  onStatus("Datei wird vorbereitet...");

  let imageSource = file;
  if (file.type === "application/pdf") {
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
