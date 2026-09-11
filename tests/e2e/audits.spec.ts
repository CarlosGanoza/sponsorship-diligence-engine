import { expect, gotoAuthenticated, resetDemoData, test } from "./fixtures";

test("open the audits page and export the decision audit report", async ({ page }) => {
  await resetDemoData(page);
  await gotoAuthenticated(page, "/audits");

  await expect(page.getByText("Reviewer disagreement")).toBeVisible();
  await expect(page.getByRole("link", { name: "Export JSON" })).toBeVisible();

  const response = await page.context().request.get("/api/audits/export?format=json");
  expect(response.ok()).toBe(true);

  const payload = (await response.json()) as {
    summary: {
      totalCandidates: number;
    };
    candidateRows: Array<{
      candidateId: string;
    }>;
  };

  expect(payload.summary.totalCandidates).toBeGreaterThan(0);
  expect(payload.candidateRows.length).toBeGreaterThan(0);
});

test("resolve a seeded disagreement review from the candidate detail page", async ({ page }) => {
  test.slow();
  await resetDemoData(page);
  await gotoAuthenticated(page, "/audits");

  const candidateLink = page.getByRole("link", { name: "Jonah Park" }).first();
  const candidateHref = await candidateLink.getAttribute("href");
  expect(candidateHref).toBeTruthy();
  await gotoAuthenticated(page, `${candidateHref}?tab=workflow`);
  await expect(page.getByText("Operator vs guardrail")).toBeVisible({ timeout: 45000 });
  const disagreementReview = page.getByTestId("disagreement-review-controls");

  const openReviewButton = disagreementReview.getByRole("button", { name: "Open review" });
  if (await openReviewButton.count()) {
    await openReviewButton.click();
    await expect(disagreementReview.getByRole("button", { name: "Update review" })).toBeVisible();
  }

  const rationaleField = disagreementReview.getByPlaceholder(
    "What changed? Why should the file follow the system, the human reviewer, or a proof-request path?",
  );
  const rationaleText =
    "The file should follow the current proof threshold until a stronger ownership example is added.";
  await rationaleField.fill(rationaleText);
  await expect(rationaleField).toHaveValue(rationaleText);
  await disagreementReview.getByRole("combobox", { name: "Resolution type" }).selectOption({ label: "Follow system guardrail" });
  await disagreementReview.getByRole("button", { name: "Resolve review" }).click();
  await expect
    .poll(
      async () => {
        const currentCandidateHref = page.url();
        const candidateId = currentCandidateHref.split("/candidates/")[1]?.split("?")[0];
        const response = await page.context().request.get(`/api/test/candidates/${candidateId}/workflow-state`);
        const payload = (await response.json()) as {
          disagreementReviews?: Array<{
            status: string;
            resolutionType: string | null;
            rationale: string | null;
          }>;
        };
        const review = payload.disagreementReviews?.[0];
        return review ? `${review.status}:${review.resolutionType ?? "NONE"}` : "NONE";
      },
      { timeout: 30000 },
    )
    .toBe("RESOLVED:FOLLOW_SYSTEM");
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByText("Operator vs guardrail")).toBeVisible({ timeout: 45000 });
  await expect(page.getByText("Disagreement review history")).toBeVisible({ timeout: 45000 });
  await expect(page.getByText(rationaleText).first()).toBeVisible({ timeout: 45000 });
});

test("show auto-triggered high-risk disagreement reviews in the audits queue", async ({ page }) => {
  await resetDemoData(page);
  await gotoAuthenticated(page, "/audits");

  await expect(page.getByText("Auto-triggered").first()).toBeVisible();
  await expect(page.getByText(/Risk /).first()).toBeVisible();
});
