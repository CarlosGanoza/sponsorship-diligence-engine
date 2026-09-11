import { createRequire } from "node:module";
import { inflateSync } from "node:zlib";

import { getBundledOcrStatus, runBundledPdfOcr } from "@/lib/artifacts/ocr";
import { parsedArtifactSchema, type ParsedArtifact } from "@/lib/artifacts/schema";

export const MAX_UPLOAD_SIZE_BYTES = 8 * 1024 * 1024;
const MAX_PDF_OCR_PAGES = 4;
const PDF_OCR_RENDER_WIDTH = 2200;
const require = createRequire(import.meta.url);

const EXTENSION_MAP = {
  txt: "txt",
  text: "txt",
  md: "md",
  markdown: "md",
  pdf: "pdf",
  docx: "docx",
} as const;

const MIME_MAP = {
  "text/plain": "txt",
  "text/markdown": "md",
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
} as const;

export type SupportedUploadKind = keyof typeof EXTENSION_MAP;

function cleanExtractedText(value: string) {
  return value.replace(/\u0000/g, "").replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function inferUploadKind(fileName: string, mimeType: string) {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";

  if (extension in EXTENSION_MAP) {
    return EXTENSION_MAP[extension as keyof typeof EXTENSION_MAP];
  }

  if (mimeType in MIME_MAP) {
    return MIME_MAP[mimeType as keyof typeof MIME_MAP];
  }

  return null;
}

export function fileNameToTitle(fileName: string) {
  return fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function parseTextFile(buffer: Buffer) {
  return cleanExtractedText(buffer.toString("utf8"));
}

function hasMeaningfulPdfText(value: string) {
  const normalized = cleanExtractedText(value);
  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  return normalized.length >= 60 || wordCount >= 10;
}

function decodePdfLiteralString(value: string) {
  return value
    .replace(/\\([0-7]{1,3})/g, (_, octal: string) => String.fromCharCode(parseInt(octal, 8)))
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\b/g, "\b")
    .replace(/\\f/g, "\f")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\");
}

function extractPdfTextFromStream(streamText: string) {
  const segments: string[] = [];
  const literalMatches = streamText.matchAll(/\((?:\\.|[^()\\])*\)\s*Tj/g);

  for (const match of literalMatches) {
    const literal = match[0].replace(/\)\s*Tj$/, "").slice(1);
    const decoded = decodePdfLiteralString(literal).trim();

    if (decoded) {
      segments.push(decoded);
    }
  }

  const arrayMatches = streamText.matchAll(/\[(.*?)\]\s*TJ/gs);

  for (const match of arrayMatches) {
    const literals = match[1]?.match(/\((?:\\.|[^()\\])*\)/g) ?? [];
    const decoded = literals
      .map((literal) => decodePdfLiteralString(literal.slice(1, -1)).trim())
      .filter(Boolean)
      .join(" ");

    if (decoded) {
      segments.push(decoded);
    }
  }

  return segments.join("\n");
}

function extractPdfTextFallback(buffer: Buffer) {
  const pdfSource = buffer.toString("latin1");
  const objectMatches = pdfSource.matchAll(/(\d+\s+\d+\s+obj[\s\S]*?endobj)/g);
  const extracted: string[] = [];

  for (const match of objectMatches) {
    const objectText = match[1];

    if (!objectText?.includes("stream")) {
      continue;
    }

    const streamMatch = objectText.match(/stream\r?\n([\s\S]*?)\r?\nendstream/);

    if (!streamMatch?.[1]) {
      continue;
    }

    try {
      const streamBuffer = objectText.includes("/FlateDecode")
        ? inflateSync(Buffer.from(streamMatch[1], "latin1"))
        : Buffer.from(streamMatch[1], "latin1");
      const decoded = extractPdfTextFromStream(streamBuffer.toString("latin1")).trim();

      if (decoded) {
        extracted.push(decoded);
      }
    } catch {
      continue;
    }
  }

  return cleanExtractedText(extracted.join("\n\n"));
}

type PdfParseInstance = {
  destroy: () => Promise<void>;
  getText: () => Promise<{ text: string; total: number }>;
  getScreenshot: (options: {
    desiredWidth: number;
    first: number;
    imageBuffer: boolean;
    imageDataUrl: boolean;
  }) => Promise<{
    total: number;
    pages: Array<{
      data: Uint8Array;
      pageNumber?: number;
    }>;
  }>;
};

function createPdfParser(buffer: Buffer): PdfParseInstance {
  const { PDFParse } = require("pdf-parse") as {
    PDFParse: new (options: { data: Buffer }) => PdfParseInstance;
  };

  return new PDFParse({ data: buffer });
}

async function extractPdfText(buffer: Buffer) {
  let parser: PdfParseInstance | null = null;

  try {
    parser = createPdfParser(buffer);
    const result = await parser.getText();
    return {
      rawText: cleanExtractedText(result.text),
      totalPages: result.total,
    };
  } catch {
    const fallbackText = extractPdfTextFallback(buffer);
    return fallbackText
      ? {
          rawText: fallbackText,
          totalPages: 0,
        }
      : null;
  } finally {
    if (parser) {
      await parser.destroy();
    }
  }
}

async function renderPdfPagesForOcr(buffer: Buffer) {
  let parser: PdfParseInstance | null = null;

  try {
    parser = createPdfParser(buffer);
    const result = await parser.getScreenshot({
      desiredWidth: PDF_OCR_RENDER_WIDTH,
      first: MAX_PDF_OCR_PAGES,
      imageBuffer: true,
      imageDataUrl: false,
    });

    return {
      totalPages: result.total,
      pages: result.pages.map((page, index) => ({
        data: page.data,
        pageNumber: page.pageNumber ?? index + 1,
      })),
    };
  } finally {
    if (parser) {
      await parser.destroy();
    }
  }
}

async function parsePdfFile(buffer: Buffer) {
  const extractedText = await extractPdfText(buffer);

  if (extractedText && hasMeaningfulPdfText(extractedText.rawText)) {
    return {
      rawText: extractedText.rawText,
      sourceLabel: "Parsed PDF upload",
    };
  }

  try {
    const renderedPdf = await renderPdfPagesForOcr(buffer);
    const ocrResult = await runBundledPdfOcr({
      pages: renderedPdf.pages,
      totalPages: renderedPdf.totalPages || extractedText?.totalPages || renderedPdf.pages.length,
    });

    if (ocrResult) {
      return {
        rawText: ocrResult.rawText,
        sourceLabel: "Scanned PDF OCR",
        processingNote: ocrResult.processingNote,
      };
    }
  } catch {
    // If OCR fails, fall back to any limited selectable text we still have.
  }

  if (extractedText?.rawText) {
    return {
      rawText: extractedText.rawText,
      sourceLabel: "Parsed PDF upload",
      processingNote: getBundledOcrStatus().available
        ? "The PDF exposed only limited selectable text, and OCR did not produce a stronger extract."
        : "The PDF exposed only limited selectable text, and the bundled OCR runtime is not available.",
    };
  }

  throw new Error("The uploaded PDF could not be parsed into readable text.");
}

async function parseDocxFile(buffer: Buffer) {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return cleanExtractedText(result.value);
}

export async function parseArtifactUpload({
  fileName,
  mimeType,
  buffer,
}: {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}): Promise<ParsedArtifact> {
  if (buffer.byteLength > MAX_UPLOAD_SIZE_BYTES) {
    throw new Error("Uploaded file is too large for MVP parsing. Keep files under 8 MB.");
  }

  const uploadKind = inferUploadKind(fileName, mimeType);

  if (!uploadKind) {
    throw new Error("Unsupported file type. Upload txt, md, pdf, or docx.");
  }

  const parsedUpload =
    uploadKind === "pdf"
      ? await parsePdfFile(buffer)
      : uploadKind === "docx"
        ? {
            rawText: await parseDocxFile(buffer),
            sourceLabel: "Parsed DOCX upload",
          }
        : {
            rawText: await parseTextFile(buffer),
            sourceLabel: "Parsed text upload",
          };

  if (!parsedUpload.rawText) {
    throw new Error("The uploaded file did not produce readable text.");
  }

  return parsedArtifactSchema.parse({
    uploadKind,
    title: fileNameToTitle(fileName),
    rawText: parsedUpload.rawText,
    sourceLabel: parsedUpload.sourceLabel,
    fileName,
    processingNote: parsedUpload.processingNote,
  });
}
