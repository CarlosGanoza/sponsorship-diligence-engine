import { expect, gotoAuthenticated, test } from "./fixtures";

test("show live sponsor priority context on the dashboard sponsor-ready queue", async ({ page }) => {
  await gotoAuthenticated(page, "/dashboard");

  await expect(page.getByText("Sponsor-ready queue")).toBeVisible();
  await expect(page.getByText("Best sponsor now:").first()).toBeVisible();
  await expect(page.getByText("Advocacy priority").first()).toBeVisible();
});
