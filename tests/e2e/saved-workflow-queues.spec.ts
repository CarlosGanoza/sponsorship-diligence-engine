import { expect, gotoAuthenticated, resetDemoData, test } from "./fixtures";

test("open a saved task queue from the tasks page", async ({ page }) => {
  await resetDemoData(page);
  await gotoAuthenticated(page, "/tasks?status=OPEN&priority=HIGH");

  const queuesRegion = page.getByRole("region", { name: "Named queues" });
  await expect(queuesRegion).toBeVisible();

  const savedQueueLink = queuesRegion.getByRole("link", { name: "Urgent owner queue" });
  await expect(savedQueueLink).toBeVisible();
  await savedQueueLink.click();

  await expect(page).toHaveURL(/status=OPEN/);
  await expect(page).toHaveURL(/priority=HIGH/);
});

test("open a saved sponsor pipeline queue from the pipeline page", async ({ page }) => {
  await resetDemoData(page);
  await gotoAuthenticated(page, "/pipeline?stage=UNDER_REVIEW&score=high");

  const queuesRegion = page.getByRole("region", { name: "Named queues" });
  await expect(queuesRegion).toBeVisible();

  const savedQueueLink = queuesRegion.getByRole("link", { name: "High-fit sponsor paths" });
  await expect(savedQueueLink).toBeVisible();
  await savedQueueLink.click();

  await expect(page).toHaveURL(/stage=UNDER_REVIEW/);
  await expect(page).toHaveURL(/score=high/);
});
