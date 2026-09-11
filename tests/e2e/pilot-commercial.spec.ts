import { expect, gotoAuthenticated, resetDemoData, test } from "./fixtures";

test("open the pilot launch guide with template-specific onboarding context", async ({ page }) => {
  await resetDemoData(page);
  await gotoAuthenticated(page, "/onboarding");

  await expect(page.getByRole("heading", { name: "Pilot launch" })).toBeVisible();
  await expect(page.getByText("Current design-partner template")).toBeVisible();
  await expect(page.getByText("Small foundation", { exact: true }).first()).toBeVisible();
  await expect(page.getByTestId("pilot-launch-checklist")).toBeVisible();
  await expect(page.getByTestId("pilot-launch-checklist").getByText(/Choose one operator owner/i)).toBeVisible();
  await expect(page.getByText(/Reviewer calibration playbook/i)).toBeVisible();
});

test("open the buyer-facing pilot brief", async ({ page }) => {
  await resetDemoData(page);
  await gotoAuthenticated(page, "/pilot/pack");

  await expect(page.getByRole("heading", { name: "Pilot brief" })).toBeVisible();
  await expect(page.getByTestId("pilot-buyer-pack")).toBeVisible();
  await expect(page.getByText(/Design-Partner Buyer Pack/i)).toBeVisible();
  await expect(page.getByText("What is already proven", { exact: true })).toBeVisible();
  await expect(page.getByText("Measured movement", { exact: true })).toBeVisible();

  const response = await page.context().request.get("/api/pilot/pack");
  expect(response.ok()).toBe(true);

  const payload = (await response.json()) as {
    buyerPack: {
      title: string;
      recommendationLabel: string;
    };
  };

  expect(payload.buyerPack.title).toMatch(/buyer pack/i);
  expect(payload.buyerPack.recommendationLabel.length).toBeGreaterThan(10);

  const markdownResponse = await page.context().request.get("/api/pilot/pack?format=md");
  expect(markdownResponse.ok()).toBe(true);
  expect((await markdownResponse.text()).startsWith("# ")).toBe(true);
});

test("open the commercial proof scorecard", async ({ page }) => {
  await resetDemoData(page);
  await gotoAuthenticated(page, "/commercial");

  await expect(page.getByRole("heading", { name: "Commercial proof", exact: true })).toBeVisible();
  await expect(page.getByText("Commercial readiness", { exact: true })).toBeVisible();
  await expect(page.getByTestId("commercial-readiness-breakdown")).toBeVisible();
  await expect(page.getByText("Likely buyer objections", { exact: true })).toBeVisible();
  await expect(page.getByText("Commercial milestones", { exact: true })).toBeVisible();
});
