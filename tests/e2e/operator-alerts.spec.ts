import { expect, gotoAuthenticated, resetDemoData, test } from "./fixtures";

test("view and resolve an operator alert from the dashboard", async ({ page }) => {
  test.slow();
  await resetDemoData(page);
  await gotoAuthenticated(page, "/dashboard");

  await expect(page.getByText("Operator alerts")).toBeVisible();

  const firstAlert = page.locator("[data-testid^='dashboard-alert-']").first();
  await expect(firstAlert).toBeVisible();
  const alertIdentifier = await firstAlert.getAttribute("data-testid");
  expect(alertIdentifier).toBeTruthy();
  const alertId = alertIdentifier?.replace("dashboard-alert-", "");
  expect(alertId).toBeTruthy();
  const resolveButton = firstAlert.getByRole("button", { name: "Resolve alert" });
  await expect(resolveButton).toBeEnabled({ timeout: 15000 });
  const response = await page.context().request.post(`/api/alerts/${alertId}/resolve`);
  expect(response.ok()).toBe(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByText("Operator alerts").waitFor();
  await expect(page.locator(`[data-testid="${alertIdentifier}"]`)).toHaveCount(0);
});
