import { expect, gotoAuthenticated, resetDemoData, test } from "./fixtures";

test("record a structured sponsor outcome from the pipeline and surface decision-quality analytics", async ({ page }) => {
  test.slow();

  await resetDemoData(page);
  await gotoAuthenticated(page, "/pipeline?q=Jonah");

  const itemCard = page.locator("[data-testid^='pipeline-item-']").filter({
    has: page.getByRole("link", { name: /jonah park/i }),
  }).first();
  await expect(itemCard).toBeVisible();

  const outcomePanel = itemCard.locator("[data-testid^='pipeline-outcome-']").first();
  await expect(outcomePanel).toBeVisible();
  const outcomePanelTestId = await outcomePanel.getAttribute("data-testid");
  expect(outcomePanelTestId).toBeTruthy();
  const itemTestId = outcomePanelTestId!.replace("pipeline-outcome-", "pipeline-item-");
  const itemId = itemTestId.replace("pipeline-item-", "");

  const response = await page.context().request.post(`/api/test/pipeline/${itemId}/outcome`, {
    data: {
      outcomeType: "DECLINED",
      verdict: "NEGATIVE",
      title: "Sponsor declined",
      detail: "The sponsor reviewed the packet, liked the direction, but declined to advocate because the ownership proof was still too narrow.",
      occurredAt: "2026-03-20",
    },
  });
  expect(response.ok()).toBe(true);
  await page.reload({ waitUntil: "domcontentloaded" });

  const refreshedItemCard = page.locator(`[data-testid='${itemTestId}']`);
  await expect(refreshedItemCard).toBeVisible();
  await expect(refreshedItemCard.getByText("Sponsor declined")).toBeVisible({ timeout: 30000 });

  await gotoAuthenticated(page, "/analytics");
  await expect(page.getByRole("region", { name: "Decision quality" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Score recalibration" })).toBeVisible();
  await expect(page.getByText("System false positives")).toBeVisible();
});
