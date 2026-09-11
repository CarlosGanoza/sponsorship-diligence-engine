import { expect, gotoAuthenticated, test } from "./fixtures";

test("apply and resume a manual stage override with traceable history", async ({ page }) => {
  const rationale =
    "Operator override for demo testing. Hold outreach until the file includes a clearer multi-team ownership example.";

  await gotoAuthenticated(page, "/candidates");
  const candidateHref = await page.getByRole("link", { name: "Nia Okafor" }).first().getAttribute("href");
  expect(candidateHref).toBeTruthy();
  const candidateId = candidateHref!.split("/").pop();
  expect(candidateId).toBeTruthy();
  await gotoAuthenticated(page, candidateHref!);

  await expect(page.getByText("Automation and alerts")).toBeVisible();
  const overrideResponse = await page.context().request.post(`/api/candidates/${candidateId}/automation`, {
    data: {
      action: "override",
      stage: "HOLD",
      rationale,
      actorLabel: "Operator QA",
    },
  });
  expect(overrideResponse.ok()).toBe(true);

  await gotoAuthenticated(page, `${candidateHref!}?tab=trajectory`);
  await expect(page.getByText("Stage history", { exact: true })).toBeVisible();
  await expect(page.getByText("MANUAL OVERRIDE", { exact: true })).toBeVisible();
  await expect(page.getByText(rationale).last()).toBeVisible();

  const resumeResponse = await page.context().request.post(`/api/candidates/${candidateId}/automation`, {
    data: {
      action: "resume",
      rationale,
      actorLabel: "Operator QA",
    },
  });
  expect(resumeResponse.ok()).toBe(true);
  await gotoAuthenticated(page, `${candidateHref!}?tab=trajectory`);
  await expect(page.getByText("Automation on")).toBeVisible();
  await expect(page.getByText("AUTOMATION RESUMED", { exact: true })).toBeVisible();
});
