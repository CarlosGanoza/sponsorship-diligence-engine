import type { Page } from "@playwright/test";

import { expect, gotoAuthenticated, resetDemoData, test } from "./fixtures";

async function openWorkflowUntilRequestVisible(page: Page, href: string, title: string) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await gotoAuthenticated(page, `${href}?tab=workflow`);
    const matchingCard = page.locator("[data-testid^='proof-request-card-']").filter({ hasText: title }).first();

    if ((await matchingCard.count()) > 0) {
      return matchingCard;
    }

    await page.waitForTimeout(750);
  }

  return page.locator("[data-testid^='proof-request-card-']").filter({ hasText: title }).first();
}

test("open and resolve a proof request from the candidate workflow", async ({ page }) => {
  await resetDemoData(page);
  await gotoAuthenticated(page, "/candidates");

  const candidateHref = await page.getByRole("link", { name: /jonah park/i }).first().getAttribute("href");
  expect(candidateHref).toBeTruthy();
  await gotoAuthenticated(page, `${candidateHref!}?tab=workflow`);

  const form = page.getByTestId("proof-request-form");
  const title = "Request quantified outcome proof";
  const requestCards = page.locator("[data-testid^='proof-request-card-']").filter({ hasText: title });
  const initialCount = await requestCards.count();
  const openRequestButton = form.getByRole("button", { name: "Open request" });
  await expect(openRequestButton).toBeEnabled({ timeout: 15000 });
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/api/candidates/") &&
        response.url().includes("/proof-requests") &&
        response.request().method() === "POST" &&
        response.ok(),
      { timeout: 30000 },
    ),
    openRequestButton.click(),
  ]);

  const requestCard = await openWorkflowUntilRequestVisible(page, candidateHref!, title);
  await expect(async () => {
    await gotoAuthenticated(page, `${candidateHref!}?tab=workflow`);
    await expect(page.locator("[data-testid^='proof-request-card-']").filter({ hasText: title })).toHaveCount(initialCount + 1);
  }).toPass({ timeout: 30000 });
  await expect(requestCard).toBeVisible();

  const resolveButton = requestCard.getByRole("button", { name: "Resolve request" });
  await expect(resolveButton).toBeEnabled({ timeout: 15000 });
  await requestCard
    .getByPlaceholder("What proof was gathered, what contradiction was resolved, or why this request should be closed.")
    .fill("A new artifact with a quantified delivery result was added and reviewed.");
  const requestId = await requestCard.getAttribute("data-testid");
  expect(requestId).toBeTruthy();
  const proofRequestId = requestId?.replace("proof-request-card-", "");
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes(`/api/proof-requests/${proofRequestId}/resolve`) &&
        response.request().method() === "POST" &&
        response.ok(),
      { timeout: 30000 },
    ),
    resolveButton.click(),
  ]);
  await expect
    .poll(
      async () => {
        await gotoAuthenticated(page, `${candidateHref!}?tab=workflow`);
        return page
          .locator(`[data-testid="proof-request-card-${proofRequestId}"]`)
          .getByText("RESOLVED")
          .count();
      },
      { timeout: 30000 },
    )
    .toBeGreaterThan(0);
});

test("send a proof request reminder from the candidate workflow", async ({ page }) => {
  await resetDemoData(page);
  await gotoAuthenticated(page, "/candidates?q=Jonah");

  const candidateHref = await page.getByRole("link", { name: /jonah park/i }).first().getAttribute("href");
  expect(candidateHref).toBeTruthy();

  await gotoAuthenticated(page, `${candidateHref!}?tab=workflow`);

  const requestCard = page.locator("[data-testid^='proof-request-card-']").first();
  await expect(requestCard).toBeVisible();

  const reminderButton = requestCard.getByRole("button", { name: "Send reminder" });
  await expect(reminderButton).toBeEnabled({ timeout: 15000 });
  const requestId = await requestCard.getAttribute("data-testid");
  expect(requestId).toBeTruthy();
  const proofRequestId = requestId?.replace("proof-request-card-", "");
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes(`/api/proof-requests/${proofRequestId}/remind`) &&
        response.request().method() === "POST" &&
        response.ok(),
      { timeout: 30000 },
    ),
    reminderButton.click(),
  ]);

  await expect(requestCard.getByText(/reminder sent/i)).toBeVisible();
});
