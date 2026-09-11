import { expect, gotoAuthenticated, test } from "./fixtures";

test("cast a committee vote from the candidate workflow tab", async ({ page }) => {
  await gotoAuthenticated(page, "/candidates?q=Jonah");
  const candidateHref = await page.getByRole("link", { name: "Jonah Park" }).first().getAttribute("href");
  expect(candidateHref).toBeTruthy();
  await page.goto(candidateHref!);
  await page.getByRole("tab", { name: "Workflow" }).click();

  await expect(page.locator("p").filter({ hasText: /^Committee review$/ }).first()).toBeVisible();
  await expect(page.getByText("Committee escalation on leadership scope")).toBeVisible();
  const rationale = "Committee vote from browser test. Still need one stronger ownership example.";
  await page.getByLabel("Rationale").first().fill(rationale);
  await page.getByRole("button", { name: "Record vote" }).first().click();

  await expect(page.getByText(rationale)).toBeVisible();
});
