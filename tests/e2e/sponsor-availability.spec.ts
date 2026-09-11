import { expect, gotoAuthenticated, resetDemoData, test } from "./fixtures";

test("update sponsor availability and persist the operating note", async ({ page }) => {
  await resetDemoData(page);
  await gotoAuthenticated(page, "/sponsors");

  const sponsorHref = await page.getByRole("link", { name: "Open sponsor detail" }).first().getAttribute("href");
  expect(sponsorHref).toBeTruthy();

  await gotoAuthenticated(page, sponsorHref!);
  await expect(page.getByText("Availability controls")).toBeVisible();
  await expect(page.getByText("Sponsor portfolio")).toBeVisible();

  const availabilitySelect = page.getByLabel("Availability", { exact: true });
  const maxConcurrentPathsInput = page.getByLabel("Max concurrent paths");
  const availabilityNoteInput = page.getByLabel("Availability note");
  const blackoutUntilInput = page.getByLabel("Blackout until");
  const blackoutReasonInput = page.getByLabel("Blackout reason");

  await availabilitySelect.selectOption("PAUSED");
  await expect(availabilitySelect).toHaveValue("PAUSED");
  await maxConcurrentPathsInput.fill("2");
  await expect(maxConcurrentPathsInput).toHaveValue("2");
  const warmIntroCheckbox = page.getByLabel("Warm intro currently available");
  if (await warmIntroCheckbox.isChecked()) {
    await warmIntroCheckbox.uncheck();
  }
  await expect(warmIntroCheckbox).not.toBeChecked();
  await availabilityNoteInput.fill("Paused for internal diligence review.");
  await expect(availabilityNoteInput).toHaveValue("Paused for internal diligence review.");
  await blackoutUntilInput.fill("2026-04-15");
  await expect(blackoutUntilInput).toHaveValue("2026-04-15");
  await blackoutReasonInput.fill("Hold new sponsor asks until the current board cycle closes.");
  await expect(blackoutReasonInput).toHaveValue("Hold new sponsor asks until the current board cycle closes.");
  const saveButton = page.getByRole("button", { name: "Save availability" });
  const sponsorId = sponsorHref!.split("/").pop();
  expect(sponsorId).toBeTruthy();
  const [response] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes(`/api/sponsors/${sponsorId}/availability`) &&
        response.request().method() === "POST",
      { timeout: 30000 },
    ),
    saveButton.click(),
  ]);
  expect(response.ok()).toBe(true);
  const payload = (await response.json()) as {
    success: boolean;
    sponsor: {
      availabilityStatus: string;
      maxConcurrentPaths: number;
      warmIntroAvailable: boolean;
      availabilityNote: string | null;
      blackoutUntil: string | null;
      blackoutReason: string | null;
    };
  };
  expect(payload.success).toBe(true);
  expect(payload.sponsor.availabilityStatus).toBe("PAUSED");
  expect(payload.sponsor.maxConcurrentPaths).toBe(2);
  expect(payload.sponsor.warmIntroAvailable).toBe(false);
  expect(payload.sponsor.availabilityNote).toBe("Paused for internal diligence review.");
  expect(payload.sponsor.blackoutUntil).toBe("2026-04-15");
  expect(payload.sponsor.blackoutReason).toBe("Hold new sponsor asks until the current board cycle closes.");
  await expect(saveButton).toBeVisible({ timeout: 30000 });

  await page.reload();
  await expect(page.getByLabel("Availability", { exact: true })).toHaveValue("PAUSED");
  await expect(page.getByLabel("Max concurrent paths")).toHaveValue("2");
  await expect(page.getByLabel("Availability note")).toHaveValue("Paused for internal diligence review.");
  await expect(page.getByLabel("Blackout until")).toHaveValue("2026-04-15");
  await expect(page.getByLabel("Blackout reason")).toHaveValue("Hold new sponsor asks until the current board cycle closes.");
  await expect(page.getByText("Paused for internal diligence review.")).toBeVisible();
  await expect(page.getByText(/Hold new sponsor asks until the current board cycle closes\./).first()).toBeVisible();
  await expect(page.getByText(/^PAUSED$/)).toBeVisible();
});
