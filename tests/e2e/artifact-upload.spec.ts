import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Page } from "@playwright/test";

import { expect, gotoAuthenticated, resetDemoData, test } from "./fixtures";

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

function createScannedPdf(text: string) {
  const tempDir = mkdtempSync(join(tmpdir(), "signalsponsor-scanned-pdf-"));
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
  return pdfPath;
}

async function reauthenticate(page: Page) {
  await resetDemoData(page);
  await gotoAuthenticated(page, "/dashboard");
}

async function uploadArtifactAndWaitForParse(page: Page, filePath: string) {
  await expect(page.locator("#sourceLabel")).toHaveValue("Candidate upload", { timeout: 30000 });
  await page.getByTestId("artifact-file-input").setInputFiles(filePath);
}

function getCandidateIdFromUrl(page: Page) {
  const candidateId = new URL(page.url()).pathname.split("/").pop();

  if (!candidateId) {
    throw new Error("Could not resolve candidate id from page URL.");
  }

  return candidateId;
}

async function waitForArtifactPersisted(page: Page, candidateId: string, title: string, timeout = 30000) {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    const response = await page.context().request.get(`/api/test/candidates/${candidateId}/artifacts`);

    expect(response.ok()).toBe(true);

    const payload = (await response.json()) as {
      titles: string[];
      artifacts: Array<{ id: string; title: string }>;
    };
    const artifact = payload.artifacts.find((item) => item.title === title);

    if (artifact) {
      return artifact;
    }

    await page.waitForTimeout(500);
  }

  throw new Error(`Artifact "${title}" was not persisted in time.`);
}

async function saveArtifactAndWaitForPersistence(page: Page, expectedTitle: string) {
  const candidateId = getCandidateIdFromUrl(page);

  const [response] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes(`/api/candidates/${candidateId}/artifacts`) &&
        response.request().method() === "POST",
      { timeout: 60000 },
    ),
    page.getByRole("button", { name: "Save artifact" }).click(),
  ]);

  expect(response.ok(), `Artifact save failed with status ${response.status()}.`).toBe(true);

  const artifact = await waitForArtifactPersisted(page, candidateId, expectedTitle, 60000);

  await gotoAuthenticated(page, `/candidates/${candidateId}?tab=evidence`);

  return artifact;
}

test("upload docx artifact and populate the evidence form", async ({ page }) => {
  test.slow();
  test.setTimeout(420_000);
  test.skip(process.platform !== "darwin", "DOCX smoke test uses macOS textutil to generate a fixture.");

  const tempDir = mkdtempSync(join(tmpdir(), "signalsponsor-docx-"));
  const txtPath = join(tempDir, "signal-sponsor-upload.txt");
  const docxPath = join(tempDir, "signal-sponsor-upload.docx");
  const content =
    "SignalSponsor DOCX upload verifies server-side parsing, auto-filled metadata, and artifact creation for review.";

  writeFileSync(txtPath, content, "utf8");
  execFileSync("textutil", ["-convert", "docx", txtPath, "-output", docxPath]);

  await reauthenticate(page);
  await gotoAuthenticated(page, "/candidates");
  await page.getByRole("link", { name: "Diego Alvarez" }).click();
  await uploadArtifactAndWaitForParse(page, docxPath);

  await expect(page.locator("#sourceLabel")).toHaveValue("Parsed DOCX upload", { timeout: 300000 });
  await expect(page.locator("#title")).toHaveValue("signal sponsor upload", { timeout: 300000 });
  await expect(page.locator("#rawText")).toHaveValue(
    new RegExp("SignalSponsor DOCX upload verifies server-side parsing"),
    { timeout: 300000 },
  );

  await saveArtifactAndWaitForPersistence(page, "signal sponsor upload");
  await expect(page.getByRole("heading", { name: "signal sponsor upload" })).toBeVisible();
});

test("upload pdf artifact and populate the evidence form", async ({ page }) => {
  test.slow();
  const tempDir = mkdtempSync(join(tmpdir(), "signalsponsor-pdf-"));
  const pdfPath = join(tempDir, "signal-sponsor-pdf.pdf");
  const content =
    "SignalSponsor PDF upload verifies server-side parsing, auto-filled metadata, and artifact creation for review.";

  writeFileSync(pdfPath, createSimplePdf(content));

  await reauthenticate(page);
  await gotoAuthenticated(page, "/candidates");
  await page.getByRole("link", { name: "Diego Alvarez" }).click();
  await uploadArtifactAndWaitForParse(page, pdfPath);

  await expect(page.locator("#sourceLabel")).toHaveValue("Parsed PDF upload", { timeout: 120000 });
  await expect(page.locator("#title")).toHaveValue("signal sponsor pdf", { timeout: 120000 });
  await expect(page.locator("#rawText")).toHaveValue(
    new RegExp("SignalSponsor PDF upload verifies server-side parsing"),
    { timeout: 120000 },
  );

  await saveArtifactAndWaitForPersistence(page, "signal sponsor pdf");
  await expect(page.getByRole("heading", { name: "signal sponsor pdf" })).toBeVisible();
});

test("upload scanned pdf artifact and use bundled OCR to populate the evidence form", async ({ page }) => {
  test.slow();
  test.skip(
    process.platform !== "darwin" || !hasPythonPillow(),
    "Scanned PDF OCR smoke test is tuned for the local macOS environment.",
  );

  const pdfPath = createScannedPdf(
    "Sponsor memo proof lives in scanned images. Review evidence before outreach.",
  );

  await reauthenticate(page);
  await gotoAuthenticated(page, "/candidates");
  await page.getByRole("link", { name: "Diego Alvarez" }).click();
  await uploadArtifactAndWaitForParse(page, pdfPath);

  await expect(page.locator("#sourceLabel")).toHaveValue("Scanned PDF OCR", { timeout: 120000 });
  await expect(page.locator("#title")).toHaveValue("signal sponsor scanned", { timeout: 120000 });
  await expect(page.locator("#rawText")).toHaveValue(/Sponsor memo proof lives in/i, { timeout: 120000 });
  await expect(page.getByText(/Ran bundled OCR/i)).toBeVisible({ timeout: 120000 });

  await saveArtifactAndWaitForPersistence(page, "signal sponsor scanned");
  await expect(page.getByRole("heading", { name: "signal sponsor scanned" })).toBeVisible();
});
