import { expect, gotoAuthenticated, resetDemoData, test } from "./fixtures";

test("open a generated opportunity brief from the candidate detail page", async ({ page }) => {
  test.slow();
  await resetDemoData(page);
  await gotoAuthenticated(page, "/candidates");
  await page.getByRole("link", { name: "Maya Rios" }).click();
  await page.getByRole("tab", { name: "Briefs" }).click();
  const briefHref = await page.getByRole("link", { name: "Open brief" }).first().getAttribute("href");
  await gotoAuthenticated(page, briefHref ?? "/briefs");

  await expect(page.getByText("Brief target sponsor")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Opportunity brief · Maya Rios/i })).toBeVisible();
  await expect(page.getByText("Recommended sponsor ask")).toBeVisible();
});
