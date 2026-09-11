import { expect, gotoAuthenticated, resetDemoData, test } from "./fixtures";

test("capture a new pilot checkpoint from the ROI page", async ({ page }) => {
  test.slow();
  await resetDemoData(page);
  await gotoAuthenticated(page, "/roi");

  await expect(page.getByRole("heading", { name: "Executive ROI" })).toBeVisible();

  const snapshots = page.locator("[data-testid^='pilot-snapshot-']");
  const beforeCount = await snapshots.count();

  const captureButton = page.getByRole("button", { name: "Capture checkpoint" });
  await expect(captureButton).toBeEnabled({ timeout: 15000 });
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/api/pilot/snapshot") &&
        response.request().method() === "POST" &&
        response.ok(),
      { timeout: 30000 },
    ),
    captureButton.click(),
  ]);

  await expect
    .poll(
      async () => {
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.getByRole("heading", { name: "Executive ROI" }).waitFor();
        return page.locator("[data-testid^='pilot-snapshot-']").count();
      },
      { timeout: 30000 },
    )
    .toBe(beforeCount + 1);
});

test("deployment health route returns a live health snapshot", async ({ page }) => {
  await resetDemoData(page);

  const response = await page.context().request.get("/api/health");
  expect(response.ok()).toBe(true);

  const payload = (await response.json()) as {
    status: string;
    checks: Array<{ key: string; status: string }>;
  };

  expect(["healthy", "degraded"]).toContain(payload.status);
  expect(payload.checks.some((check) => check.key === "database")).toBe(true);
});
