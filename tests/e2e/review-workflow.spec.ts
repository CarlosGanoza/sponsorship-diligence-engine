import { expect, gotoAuthenticated, test } from "./fixtures";

test("approve an evidence claim with an operator note", async ({ page }) => {
  const note = `Approved for sponsor memo on ${Date.now()}`;

  await gotoAuthenticated(page, "/candidates");
  const candidateHref = await page.getByRole("link", { name: /jonah park/i }).first().getAttribute("href");
  expect(candidateHref).toBeTruthy();
  const candidateId = candidateHref!.split("/").pop();
  expect(candidateId).toBeTruthy();
  await gotoAuthenticated(page, candidateHref!);

  const claimTextarea = page.locator('textarea[id^="claim-"]').first();
  await claimTextarea.fill(note);
  const approveButton = page.getByRole("button", { name: "Approve" }).first();
  await expect(approveButton).toBeEnabled({ timeout: 15000 });
  const claimTextareaId = await claimTextarea.getAttribute("id");
  const claimId = claimTextareaId?.replace(/^claim-/, "").replace(/-note$/, "");
  expect(claimId).toBeTruthy();
  const reviewResponse = await page.context().request.post(`/api/claims/${claimId}/review`, {
    data: {
      status: "APPROVED",
      note,
    },
  });
  expect(reviewResponse.ok()).toBe(true);

  await expect
    .poll(
      async () => {
        const response = await page.context().request.get(`/api/test/candidates/${candidateId}/workflow-state`);
        const payload = (await response.json()) as {
          claimReviews: Array<{ reviewNote: string | null }>;
        };
        return payload.claimReviews.some((claimReview) => claimReview.reviewNote === note) ? 1 : 0;
      },
      { timeout: 30000 },
    )
    .toBeGreaterThan(0);
});
