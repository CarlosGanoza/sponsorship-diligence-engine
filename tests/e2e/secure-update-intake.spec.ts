import { expect, gotoAuthenticated, gotoPublic, resetDemoData, test } from "./fixtures";

test("open a secure candidate update link and submit evidence through the public intake route", async ({ page }) => {
  test.slow();
  await resetDemoData(page);
  await gotoAuthenticated(page, "/candidates?q=Jonah");

  const candidateHref = await page.getByRole("link", { name: /jonah park/i }).first().getAttribute("href");
  expect(candidateHref).toBeTruthy();
  const workflowHref = `${candidateHref!}?tab=workflow`;

  await gotoAuthenticated(page, workflowHref);

  const proofRequestCard = page
    .locator("[data-testid^='proof-request-card-']")
    .filter({
      has: page.locator("button", {
        hasText: /Create secure link|Rotate link/,
      }),
    })
    .first();
  await expect(proofRequestCard).toBeVisible();

  const createLinkButton = proofRequestCard.getByRole("button", { name: "Create secure link" });
  if (await createLinkButton.count()) {
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes("/api/proof-requests/") &&
          response.url().includes("/access-link") &&
          response.request().method() === "POST" &&
          response.ok(),
        { timeout: 30000 },
      ),
      createLinkButton.click(),
    ]);
  }

  const secureLinkInput = proofRequestCard.locator("input[readonly]").first();
  await expect(secureLinkInput).toBeVisible();
  await expect(secureLinkInput).toHaveValue(/\/updates\/.+/, { timeout: 30000 });

  const updatedLink = await proofRequestCard.locator("input[readonly]").first().inputValue();
  expect(updatedLink).toContain("/updates/");
  const browser = page.context().browser();
  expect(browser).toBeTruthy();
  const publicContext = await browser!.newContext();
  const publicPage = await publicContext.newPage();
  await gotoPublic(publicPage, new URL(updatedLink, "http://127.0.0.1:3001").toString());

  await expect(publicPage).toHaveURL(/\/updates\/.+/);
  await expect(publicPage.getByText("Secure evidence update")).toBeVisible();
  await expect(publicPage.getByText("Submission guidance")).toBeVisible();
  await expect(publicPage.getByText("Privacy and review note")).toBeVisible();
  await expect(publicPage.getByText("What happens next")).toBeVisible();
  await expect(publicPage.getByText("Request history")).toBeVisible();
  await expect(publicPage.getByText("Evidence already on file")).toBeVisible();
  await expect(publicPage.getByText(/Suggested evidence:/i)).toBeVisible();
  const replaceSelect = publicPage.locator("#public-update-replaces-artifact");
  if ((await replaceSelect.locator("option").count()) > 1) {
    await replaceSelect.selectOption({ index: 1 });
  }
  await publicPage.getByLabel("Update title").fill("Clarified ownership scope");
  await publicPage.getByLabel("What changed").fill(
    "I added a clearer explanation of the parts of the pilot that I owned directly, including team coordination and delivery follow-through.",
  );
  await publicPage.getByLabel("Submitted by").fill("Jonah Park");
  await publicPage.getByLabel("Evidence text").fill(
    "In the revised delivery summary, I clarified that I coordinated the implementation plan across two partner teams, handled weekly check-ins, and directly owned the final rollout checklist that moved the work from planning into execution.",
  );
  await publicPage.getByLabel("Ownership scope").fill("I directly owned the rollout checklist and weekly partner coordination.");
  await publicPage.getByLabel("Quantified outcome").fill("The revised process moved the pilot into execution across two partner teams.");
  await publicPage
    .getByLabel(/I confirm this submission is accurate/i)
    .check();
  const submitResponse = await publicContext.request.post(`/api/updates/${updatedLink.split("/updates/")[1]}/submit`, {
    data: {
      title: "Clarified ownership scope",
      summary:
        "I added a clearer explanation of the parts of the pilot that I owned directly, including team coordination and delivery follow-through.",
      submittedByLabel: "Jonah Park",
      artifactType: "PROJECT_SUMMARY",
      fileName: "",
      storedFileId: "",
      replacesArtifactId: replaceSelect ? await replaceSelect.inputValue() : "",
      rawText:
        "In the revised delivery summary, I clarified that I coordinated the implementation plan across two partner teams, handled weekly check-ins, and directly owned the final rollout checklist that moved the work from planning into execution.",
      ownershipScope: "I directly owned the rollout checklist and weekly partner coordination.",
      quantifiedOutcome: "The revised process moved the pilot into execution across two partner teams.",
      thirdPartyContext: "",
      consentAcknowledged: true,
    },
  });
  expect(submitResponse.ok()).toBe(true);
  await publicPage.reload({ waitUntil: "domcontentloaded" });
  await publicContext.close();

  await expect
    .poll(
      async () => {
        await gotoAuthenticated(page, workflowHref);
        return page.getByText("Clarified ownership scope", { exact: true }).count();
      },
      { timeout: 60000 },
    )
    .toBeGreaterThan(0);
  await gotoAuthenticated(page, workflowHref);
  await expect(page.getByText("Clarified ownership scope", { exact: true }).first()).toBeVisible();
});
