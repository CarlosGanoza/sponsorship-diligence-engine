import { expect, gotoAuthenticated, resetDemoData, test } from "./fixtures";

test("save the pilot profile and reuse it across buyer-facing routes", async ({ page }) => {
  test.slow();
  await resetDemoData(page);
  await gotoAuthenticated(page, "/onboarding");

  const response = await page.context().request.post("/api/pilot/profile", {
    data: {
      pilotName: "North Star board advocacy pilot",
      designPartnerName: "North Star Foundation",
      programName: "Small foundation",
      primaryContactName: "Pilot owner",
      primaryContactEmail: "pilot@signalsponsor.demo",
      targetLaunchDate: "",
      packSummary:
        "A contained small foundation deployment focused on evidence-backed sponsorship decisions, explicit review governance, and measured sponsor-path outcomes.",
    },
  });

  expect(response.ok()).toBe(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByPlaceholder("Pilot name")).toHaveValue("North Star board advocacy pilot");

  await gotoAuthenticated(page, "/demo");
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("pilot-profile-card")).toContainText("North Star board advocacy pilot");
});

test("persist launch workstream updates across reloads", async ({ page }) => {
  await resetDemoData(page);
  await gotoAuthenticated(page, "/onboarding");

  const response = await page.context().request.post("/api/pilot/launch-items/seed-a-contained-slate", {
    data: {
      status: "READY",
      owner: "Ops analyst",
      dueAt: "",
      note: "",
    },
  });

  expect(response.ok()).toBe(true);

  await page.reload();

  await expect(page.getByTestId("launch-item-seed-a-contained-slate").locator("select").first()).toHaveValue("READY");
});
