import { expect, gotoAuthenticated, resetDemoData, test } from "./fixtures";

test("open the guided demo with buyer-facing pilot context", async ({ page }) => {
  await resetDemoData(page);
  await gotoAuthenticated(page, "/demo");

  await expect(page.getByRole("heading", { name: "Guided demo" })).toBeVisible();
  await expect(page.getByTestId("pilot-profile-card")).toContainText("North Star Foundation sponsorship pilot");
  await expect(page.getByTestId("guided-demo-steps")).toBeVisible();
  await expect(page.getByText(/Start with the underwriting file/i)).toBeVisible();
  await expect(page.getByText(/Hand over the proof report/i)).toBeVisible();
  await expect(page.getByText("What to emphasize in the room", { exact: true })).toBeVisible();
});
