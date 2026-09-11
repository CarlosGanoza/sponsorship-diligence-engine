import { expect, gotoAuthenticated, resetDemoData, test } from "./fixtures";

test("persist reviewer calibration workflow updates across reloads", async ({ page }) => {
  test.slow();
  await resetDemoData(page);
  await gotoAuthenticated(page, "/calibration");

  const calibrationItem = page.getByTestId("calibration-item-jordan-lee");
  const reviewerId = await calibrationItem.getAttribute("data-reviewer-id");
  expect(reviewerId).toBeTruthy();
  const response = await page.context().request.post(`/api/calibration/reviewers/${reviewerId}`, {
    data: {
      status: "READY",
      owner: "Jordan Lee",
      dueAt: "2026-04-01",
      note: "Threshold documented for the next governance review.",
    },
  });
  expect(response.ok()).toBe(true);

  await expect
    .poll(
      async () => {
        await page.reload({ waitUntil: "domcontentloaded" });
        return page.getByTestId("calibration-item-jordan-lee").locator("select").first().inputValue();
      },
      { timeout: 45000 },
    )
    .toBe("READY");
});
