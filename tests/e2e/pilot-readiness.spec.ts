import { expect, gotoAuthenticated, resetDemoData, test } from "./fixtures";

test("pilot template changes are reflected in the pilot workspace", async ({ page }) => {
  test.slow();

  await resetDemoData(page);
  await gotoAuthenticated(page, "/settings");

  await expect(page.getByRole("heading", { name: "Settings and demo mode" })).toBeVisible();
  const response = await page.context().request.post("/settings/pilot-template", {
    form: {
      template: "ALUMNI_NETWORK",
    },
  });
  expect(response.ok()).toBe(true);

  await gotoAuthenticated(page, "/pilot");

  await expect(page.getByRole("heading", { name: "Pilot readiness" })).toBeVisible();
  await expect(page.getByText(/currently positioned for alumni network/i)).toBeVisible();
});

test("executive ROI page shows explicit modeling and governance context", async ({ page }) => {
  test.slow();

  await resetDemoData(page);
  await gotoAuthenticated(page, "/roi");

  await expect(page.getByRole("heading", { name: "Executive ROI" })).toBeVisible();
  await expect(page.getByText(/explicit modeling note/i)).toBeVisible();
  await expect(page.getByText(/modeled pilot economics/i)).toBeVisible();
  await expect(page.getByText(/governance proof/i)).toBeVisible();
});
