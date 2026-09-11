import { expect, gotoAuthenticated, test } from "./fixtures";

test("show reviewer calibration and outcome learning on the analytics page", async ({ page }) => {
  test.slow();
  await gotoAuthenticated(page, "/analytics");

  const calibrationRegion = page.getByRole("region", { name: "Reviewer calibration" });
  const outcomeRegion = page.getByRole("region", { name: "Outcome learning" });
  const qualityRegion = page.getByRole("region", { name: "Decision quality" });
  const recalibrationRegion = page.getByRole("region", { name: "Score recalibration" });

  await expect(calibrationRegion).toBeVisible();
  await expect(outcomeRegion).toBeVisible();
  await expect(qualityRegion).toBeVisible();
  await expect(recalibrationRegion).toBeVisible();
  await expect(outcomeRegion.getByText("Positive outcomes")).toBeVisible();
  await expect(qualityRegion.getByText("System false positives")).toBeVisible();
  await expect(calibrationRegion.getByText("Jordan Lee")).toBeVisible();
  await expect(calibrationRegion.getByText("Tighten the proof threshold before sponsor-facing movement.")).toBeVisible();
});
