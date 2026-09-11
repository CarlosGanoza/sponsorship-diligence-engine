import { expect, gotoAuthenticated, test } from "./fixtures";

test("open sponsor-specific memo variant from a sponsor fit card", async ({ page }) => {
  test.slow();

  await gotoAuthenticated(page, "/candidates");
  const candidateHref = await page.getByRole("link", { name: "Maya Rios" }).first().getAttribute("href");
  await gotoAuthenticated(page, `${candidateHref ?? "/candidates"}?tab=sponsors`);

  const memoVariantLink = page.getByRole("link", { name: "Preview memo variant" }).first();
  await expect(memoVariantLink).toBeVisible();

  const memoVariantHref = await memoVariantLink.getAttribute("href");
  expect(memoVariantHref).toBeTruthy();
  await gotoAuthenticated(page, memoVariantHref ?? "/memos");

  await expect(page.getByText("Memo variant selector", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Maya Rios · for/i })).toBeVisible();
});
