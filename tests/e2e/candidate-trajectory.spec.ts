import { expect, gotoAuthenticated, resetDemoData, test } from "./fixtures";

test("open a candidate trajectory and inspect conviction movement", async ({ page }) => {
  test.slow();
  await resetDemoData(page);
  await gotoAuthenticated(page, "/candidates?q=Maya");
  const candidateHref = await page.getByRole("link", { name: "Maya Rios" }).first().getAttribute("href");
  expect(candidateHref).toBeTruthy();
  await page.goto(candidateHref!, { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/candidates\/.+/);
  await page.goto(`${page.url().split("?")[0]}?tab=trajectory`, { waitUntil: "domcontentloaded" });

  await expect(page.getByText("Conviction trend")).toBeVisible();
  await expect(page.getByText("Progress timeline")).toBeVisible();
  await expect(page.getByText("Current file state").last()).toBeVisible();
});
