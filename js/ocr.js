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
  const result = { date: null, club: null };

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
