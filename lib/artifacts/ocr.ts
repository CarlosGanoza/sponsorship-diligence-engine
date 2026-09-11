import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const require = createRequire(import.meta.url);
const OCR_CACHE_PATH = join(tmpdir(), "signalsponsor-tesseract-cache");
const OCR_CORE_PATH = join(process.cwd(), "node_modules", "tesseract.js-core");
const OCR_LANG_PATH = join(process.cwd(), "node_modules", "@tesseract.js-data", "eng", "4.0.0");
const OCR_MIN_CHARACTERS = 40;
const OCR_MIN_WORDS = 6;

type OcrPageImage = {
  pageNumber: number;
  data: Uint8Array;
};

type OcrResult = {
  rawText: string;
  processingNote: string;
};

function cleanOcrText(value: string) {
  return value.replace(/\u0000/g, "").replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function hasMeaningfulOcrText(value: string) {
  const normalized = cleanOcrText(value);
  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  return normalized.length >= OCR_MIN_CHARACTERS || wordCount >= OCR_MIN_WORDS;
}

export function getBundledOcrStatus() {
  const available =
    existsSync(join(OCR_LANG_PATH, "eng.traineddata.gz")) &&
    existsSync(join(OCR_CORE_PATH, "tesseract-core.wasm.js"));

  if (available) {
    return {
      available: true,
      label: "bundled",
      detail: "Image-only PDFs can be processed locally with bundled OCR after dependency install.",
    };
  }

  return {
    available: false,
    label: "missing",
    detail: "Install bundled OCR packages to extract text from scanned PDFs offline.",
  };
}

async function createOcrWorker() {
  const { createWorker } = require("tesseract.js") as typeof import("tesseract.js");

  const worker = await createWorker("eng", 1, {
    cachePath: OCR_CACHE_PATH,
    corePath: OCR_CORE_PATH,
    gzip: true,
    langPath: OCR_LANG_PATH,
    logger: () => {},
  });

  await worker.setParameters({
    preserve_interword_spaces: "1",
    user_defined_dpi: "300",
  });

  return worker;
}

export async function runBundledPdfOcr({
  pages,
  totalPages,
}: {
  pages: OcrPageImage[];
  totalPages: number;
}): Promise<OcrResult | null> {
  if (pages.length === 0) {
    return null;
  }

  const worker = await createOcrWorker();
  const sections: string[] = [];

  try {
    for (const page of pages) {
      const result = await worker.recognize(Buffer.from(page.data), { rotateAuto: true });
      const text = cleanOcrText(result.data.text);

      if (!hasMeaningfulOcrText(text)) {
        continue;
      }

      sections.push(pages.length > 1 ? `Page ${page.pageNumber}\n${text}` : text);
    }
  } finally {
    await worker.terminate();
  }

  const rawText = cleanOcrText(sections.join("\n\n"));

  if (!hasMeaningfulOcrText(rawText)) {
    return null;
  }

  const truncated = totalPages > pages.length;
  const processingNote = truncated
    ? `Ran bundled OCR on the first ${pages.length} pages because the PDF did not include enough selectable text. OCR is limited to the first ${pages.length} pages for MVP speed.`
    : `Ran bundled OCR on ${pages.length} page${pages.length === 1 ? "" : "s"} because the PDF did not include enough selectable text.`;

  return {
    rawText,
    processingNote,
  };
}
