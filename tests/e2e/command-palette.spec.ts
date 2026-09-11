import { expect, gotoAuthenticated, resetDemoData, test } from "./fixtures";

test("open the workspace command palette and navigate to a shortcut", async ({ page }) => {
  await resetDemoData(page);
  await gotoAuthenticated(page, "/dashboard");

  const searchButton = page.getByRole("button", { name: /Search workspace/i });
  await expect(searchButton).toBeVisible();
  await page.waitForTimeout(500);
  await searchButton.click();
  const searchInput = page.locator("input[placeholder*='Shortcuts']").first();
  if (!(await searchInput.isVisible().catch(() => false))) {
    await page.keyboard.press("Meta+K");
  }
  await expect(searchInput).toBeVisible();
  await expect(page.getByText(/^Shortcut$/).first()).toBeVisible();

  await searchInput.fill("new candidate");
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/\/candidates\/new$/);
  await expect(page.getByRole("heading", { name: "New candidate", exact: true })).toBeVisible();
});
