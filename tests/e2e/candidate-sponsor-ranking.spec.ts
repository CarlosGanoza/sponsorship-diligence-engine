import { expect, gotoAuthenticated, test } from "./fixtures";

test("show live sponsor ranking context on the candidate sponsor tab", async ({ page }) => {
  await gotoAuthenticated(page, "/candidates?q=Maya");
  const candidateHref = await page.getByRole("link", { name: "Maya Rios" }).first().getAttribute("href");
  expect(candidateHref).toBeTruthy();
  await page.goto(candidateHref!);
  await page.getByRole("tab", { name: "Sponsor fit" }).click();

  await expect(page.getByText("Base fit").first()).toBeVisible();
  await expect(page.getByText(/Ops [+-]?\d+/).first()).toBeVisible();
  await expect(page.getByText(/Ready now|Promising now|Limited window|Capacity constrained|Paused right now/).first()).toBeVisible();
  await expect(page.getByText(/Fresh recommendation|Watch recommendation drift|Stale recommendation/).first()).toBeVisible();
});
