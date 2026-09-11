import { expect, gotoAuthenticated, test } from "./fixtures";

test("record operator notes and a decision in the candidate workflow tab", async ({ page }) => {
  test.slow();
  const noteTitle = "Demo workflow note";
  const decisionSummary = "Advance after sponsor-packet review";

  await gotoAuthenticated(page, "/candidates");
  const candidateHref = await page.getByRole("link", { name: /maya rios/i }).first().getAttribute("href");
  expect(candidateHref).toBeTruthy();
  const candidateId = candidateHref!.split("/").pop();
  expect(candidateId).toBeTruthy();
  const workflowHref = `${candidateHref!}?tab=workflow`;
  await gotoAuthenticated(page, workflowHref);

  await page.getByPlaceholder("Optional note title").fill(noteTitle);
  await page
    .getByPlaceholder(
      "What changed, what you trust, what still needs proof, or what to watch next.",
    )
    .fill(
      "The internal packet is ready and the strongest proof now supports a sponsor-facing intro sequence.",
    );
  const noteResponse = await page.context().request.post(`/api/candidates/${candidateId}/notes`, {
    data: {
      noteType: "GENERAL",
      title: noteTitle,
      content:
        "The internal packet is ready and the strongest proof now supports a sponsor-facing intro sequence.",
    },
  });
  expect(noteResponse.ok()).toBe(true);
  await expect
    .poll(
      async () => {
        const response = await page.context().request.get(`/api/test/candidates/${candidateId}/workflow-state`);
        const payload = (await response.json()) as {
          notes: Array<{ title: string | null }>;
        };
        return payload.notes.some((note) => note.title === noteTitle) ? 1 : 0;
      },
      { timeout: 30000 },
    )
    .toBeGreaterThan(0);

  await page.getByPlaceholder("Short decision summary").fill(decisionSummary);
  await page
    .getByPlaceholder("Why did this move? What evidence or risk drove the decision?")
    .fill(
      "The strongest claims, current memo quality, and warm-path clarity justify moving the case into active sponsor preparation.",
    );
  const decisionResponse = await page.context().request.post(`/api/candidates/${candidateId}/decisions`, {
    data: {
      decisionType: "ADVANCE",
      summary: decisionSummary,
      rationale:
        "The strongest claims, current memo quality, and warm-path clarity justify moving the case into active sponsor preparation.",
    },
  });
  expect(decisionResponse.ok()).toBe(true);
  await expect
    .poll(
      async () => {
        const response = await page.context().request.get(`/api/test/candidates/${candidateId}/workflow-state`);
        const payload = (await response.json()) as {
          decisions: Array<{ summary: string }>;
        };
        return payload.decisions.some((decision) => decision.summary === decisionSummary) ? 1 : 0;
      },
      { timeout: 30000 },
    )
    .toBeGreaterThan(0);
});
