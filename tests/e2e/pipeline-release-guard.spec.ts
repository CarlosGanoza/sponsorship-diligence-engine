import { expect, gotoAuthenticated, resetDemoData, test } from "./fixtures";

test("block manual pipeline movement into sponsor-facing stages until release is clear", async ({ page }) => {
  test.slow();

  await resetDemoData(page);
  await gotoAuthenticated(page, "/pipeline?q=Maya");

  const itemCard = page
    .locator("[data-testid^='pipeline-item-']")
    .filter({
      has: page.getByRole("link", { name: /maya rios/i }),
    })
    .first();

  await expect(itemCard).toBeVisible();
  await expect(itemCard.getByText(/Sponsor-facing stages are preflight-blocked/i)).toBeVisible();
  await expect
    .poll(
      async () =>
        itemCard
          .locator("select option[value='CONTACTED']")
          .evaluate((element) => (element as HTMLOptionElement).disabled),
      { timeout: 30000 },
    )
    .toBe(true);

  const testId = await itemCard.getAttribute("data-testid");
  expect(testId).toBeTruthy();
  const itemId = testId!.replace("pipeline-item-", "");

  const response = await page.context().request.post(`/api/pipeline/${itemId}`, {
    data: {
      stage: "CONTACTED",
      ownerUserId: "",
      nextDueAt: "",
      nextStep: "",
      outcomeNote: "",
    },
  });

  expect(response.status()).toBe(400);
  const payload = (await response.json()) as { error?: string };
  expect(payload.error).toMatch(/Sponsor-facing stage movement is still blocked\./i);
});
