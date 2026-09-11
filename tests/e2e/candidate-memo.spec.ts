import { expect, gotoAuthenticated, test } from "./fixtures";

test("open candidate and view sponsor memo", async ({ page }) => {
  await gotoAuthenticated(page, "/candidates");
  await page.getByRole("link", { name: "Maya Rios" }).click();
  await page.getByRole("tab", { name: "Memo" }).click();

  await expect(page.getByText("Why this person is worth backing")).toBeVisible();
  await expect(page.getByText("Recommended next advocacy action")).toBeVisible();
});
