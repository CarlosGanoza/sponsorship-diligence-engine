import { expect, gotoAuthenticated, resetDemoData, test } from "./fixtures";

async function waitForWorkflowState(
  page: Parameters<typeof gotoAuthenticated>[0],
  candidateId: string,
  predicate: (payload: {
    updates: Array<{ title: string; status: string; summary: string }>;
    claimReviews: Array<{ id: string; claim: string; reviewStatus: string; reviewNote: string | null }>;
  }) => boolean,
  timeout = 45000,
) {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    const response = await page.context().request.get(`/api/test/candidates/${candidateId}/workflow-state`);
    expect(response.ok()).toBe(true);

    const payload = (await response.json()) as {
      updates: Array<{ title: string; status: string; summary: string }>;
      claimReviews: Array<{ id: string; claim: string; reviewStatus: string; reviewNote: string | null }>;
    };

    if (predicate(payload)) {
      return payload;
    }

    await page.waitForTimeout(500);
  }

  throw new Error(`Workflow state for ${candidateId} did not converge in time.`);
}

test("save a named candidate queue from the current filters", async ({ page }) => {
  test.slow();
  await resetDemoData(page);
  await gotoAuthenticated(page, "/candidates?readiness=high&memoStatus=READY");

  const queuesRegion = page.getByRole("region", { name: "Named queues" });
  const queueName = "Ready sponsor review test";
  await expect(queuesRegion).toBeVisible();

  const response = await page.context().request.post("/api/saved-views", {
    data: {
      page: "CANDIDATES",
      title: queueName,
      queryString: "readiness=high&memoStatus=READY",
    },
  });
  expect(response.ok()).toBe(true);

  await gotoAuthenticated(page, "/candidates?readiness=high&memoStatus=READY");

  const savedQueueLink = queuesRegion.getByRole("link", { name: queueName });
  await expect(savedQueueLink).toBeVisible({ timeout: 45000 });
  await savedQueueLink.click();

  await expect(page).toHaveURL(/readiness=high/);
  await expect(page).toHaveURL(/memoStatus=READY/);
});

test("submit a candidate update and bulk-approve a pending claim", async ({ page }) => {
  await resetDemoData(page);
  await gotoAuthenticated(page, "/candidates?q=Maya");
  const candidateHref = await page.getByRole("link", { name: /maya rios/i }).first().getAttribute("href");
  expect(candidateHref).toBeTruthy();
  const candidateId = candidateHref!.split("/").pop();
  expect(candidateId).toBeTruthy();
  const updateResponse = await page.context().request.post(`/api/candidates/${candidateId}/updates`, {
    data: {
      title: "Post-pilot outcome refresh",
      summary: "The candidate added a clearer quantified outcome and a more explicit description of who coordinated the work.",
      submittedByLabel: "Candidate follow-up",
      artifactType: "PROJECT_SUMMARY",
      sourceLabel: "Candidate update",
      rawText:
        "The pilot now has a clearer result. The outreach effort reached 430 students, completion improved to 80%, and the candidate coordinated two volunteer leads plus a district operations partner to sustain the work after the initial launch period.",
      resolveLinkedProofRequest: true,
    },
  });
  expect(updateResponse.ok()).toBe(true);

  await gotoAuthenticated(page, `${candidateHref!}?tab=workflow`);
  await expect(page.getByText("Post-pilot outcome refresh", { exact: true }).first()).toBeVisible();

  const claimsRegion = page.getByRole("region", { name: "Evidence claims" });
  await expect(claimsRegion).toBeVisible();

  const workflowState = await waitForWorkflowState(
    page,
    candidateId!,
    (payload) => payload.claimReviews.some((claim) => claim.reviewStatus === "PENDING"),
  );
  const firstPendingClaim = workflowState.claimReviews.find((claim) => claim.reviewStatus === "PENDING");
  expect(firstPendingClaim).toBeTruthy();

  const bulkReviewResponse = await page.context().request.post("/api/reviews/bulk", {
    data: {
      entityType: "claim",
      itemIds: [firstPendingClaim!.id],
      status: "APPROVED",
    },
  });
  expect(bulkReviewResponse.ok()).toBe(true);

  await waitForWorkflowState(
    page,
    candidateId!,
    (payload) =>
      !payload.claimReviews.some(
        (claim) => claim.id === firstPendingClaim!.id && claim.reviewStatus === "PENDING",
      ),
  );

  await gotoAuthenticated(page, `${candidateHref!}?tab=workflow`);
  await expect(claimsRegion).not.toContainText(firstPendingClaim!.claim, { timeout: 45000 });
});
