// @vitest-environment node

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { fileNameToTitle, inferUploadKind, parseArtifactUpload } from "@/lib/artifacts/parser";

function hasPythonPillow() {
  try {
    execFileSync("python3", ["-c", "import PIL"]);
    return true;
  } catch {
    return false;
  }
}

function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function createSimplePdf(text: string) {
  const content = `BT
/F1 18 Tf
72 720 Td
(${escapePdfText(text)}) Tj
ET`;

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref
0 ${objects.length + 1}
0000000000 65535 f 
`;

  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${offsets[index]!.toString().padStart(10, "0")} 00000 n 
`;
  }

  pdf += `trailer
<< /Size ${objects.length + 1} /Root 1 0 R >>
startxref
${xrefOffset}
%%EOF`;

  return Buffer.from(pdf, "utf8");
}

function createScannedPdfFixture(text: string) {
  const tempDir = mkdtempSync(join(tmpdir(), "signalsponsor-unit-scan-"));
  const pdfPath = join(tempDir, "signal-sponsor-scanned.pdf");
  const script = `
from PIL import Image, ImageDraw, ImageFont
import sys
import textwrap

pdf_path = sys.argv[1]
text = sys.argv[2]
img = Image.new("RGB", (2200, 1600), "white")
draw = ImageDraw.Draw(img)
font = None
for candidate in [
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
    "/System/Library/Fonts/Supplemental/Helvetica.ttc",
]:
    try:
        font = ImageFont.truetype(candidate, 64)
        break
    except Exception:
        pass
if font is None:
    font = ImageFont.load_default()
wrapped = "\\n".join(textwrap.wrap(text, width=28))
draw.multiline_text((160, 220), wrapped, fill="black", font=font, spacing=28)
img.save(pdf_path, "PDF", resolution=200.0)
`;

  execFileSync("python3", ["-c", script, pdfPath, text]);
  return readFileSync(pdfPath);
}

describe("artifact upload parsing helpers", () => {
  it("detects supported upload kinds from file names and mime types", () => {
    expect(inferUploadKind("resume.pdf", "application/pdf")).toBe("pdf");
    expect(
      inferUploadKind(
        "mentor-note.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).toBe("docx");
    expect(inferUploadKind("reflection.md", "text/markdown")).toBe("md");
    expect(inferUploadKind("artifact.txt", "text/plain")).toBe("txt");
    expect(inferUploadKind("archive.zip", "application/zip")).toBeNull();
  });

  it("derives a readable title from the uploaded file name", () => {
    expect(fileNameToTitle("community_health_ops-summary_v2.docx")).toBe(
      "community health ops summary v2",
    );
  });

  it("parses pdf uploads into inspectable text", async () => {
    const rawText =
      "SignalSponsor PDF parsing should preserve readable evidence text for inspection.";
    const parsed = await parseArtifactUpload({
      fileName: "signal-sponsor-proof.pdf",
      mimeType: "application/pdf",
      buffer: createSimplePdf(rawText),
    });

    expect(parsed.uploadKind).toBe("pdf");
    expect(parsed.sourceLabel).toBe("Parsed PDF upload");
    expect(parsed.title).toBe("signal sponsor proof");
    expect(parsed.rawText).toContain("SignalSponsor PDF parsing should preserve readable evidence text");
  }, 15_000);

  const scannedPdfTest = process.platform === "darwin" && hasPythonPillow() ? it : it.skip;

  scannedPdfTest("runs OCR for scanned pdf uploads when selectable text is missing", async () => {
    const parsed = await parseArtifactUpload({
      fileName: "signal-sponsor-scanned.pdf",
      mimeType: "application/pdf",
      buffer: createScannedPdfFixture(
        "Sponsor memo proof lives in scanned images. Review evidence before outreach.",
      ),
    });

    expect(parsed.sourceLabel).toBe("Scanned PDF OCR");
    expect(parsed.processingNote).toContain("Ran bundled OCR");
    expect(parsed.rawText.toLowerCase()).toContain("sponsor memo proof");
    expect(parsed.rawText.toLowerCase()).toContain("evidence before outreach");
  }, 20_000);
});
