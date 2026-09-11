import { expect, gotoAuthenticated, resetDemoData, test } from "./fixtures";

test("open a shared internal memo link without a workspace session", async ({ page }) => {
  test.slow();
  await resetDemoData(page);
  await gotoAuthenticated(page, "/candidates?q=Maya");

  const candidateHref = await page.getByRole("link", { name: "Maya Rios" }).first().getAttribute("href");
  expect(candidateHref).toBeTruthy();
  await gotoAuthenticated(page, candidateHref!);

  const memoHref = await page.getByRole("link", { name: "Printable memo" }).getAttribute("href");
  expect(memoHref).toBeTruthy();
  await gotoAuthenticated(page, memoHref!);

  await expect(page.getByText("Share-safe review link")).toBeVisible();
  const createLinkButton = page.getByRole("button", { name: "Create link" });
  await expect(createLinkButton).toBeEnabled({ timeout: 15000 });
  await createLinkButton.click();

  const linkInput = page.locator("input[readonly]").last();
  await expect(linkInput).toHaveValue(/\/review\//);
  const shareUrl = await linkInput.inputValue();

  await page.context().clearCookies();
  await page.goto(shareUrl, { waitUntil: "domcontentloaded" });

  await expect(page.getByText("Shared internal review")).toBeVisible();
  await expect(page.getByText("Why this person is worth backing")).toBeVisible();
});
