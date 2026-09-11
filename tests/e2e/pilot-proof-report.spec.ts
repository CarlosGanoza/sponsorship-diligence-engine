import { expect, gotoAuthenticated, resetDemoData, test } from "./fixtures";

test("open the measured pilot proof report and export JSON", async ({ page }) => {
  await resetDemoData(page);
  await gotoAuthenticated(page, "/pilot/report");

  await expect(page.getByRole("heading", { name: "Pilot proof report", exact: true })).toBeVisible();
  await expect(page.getByTestId("pilot-proof-report")).toBeVisible();
  await expect(page.getByText("Measured Pilot Proof Report", { exact: true })).toBeVisible();
  await expect(page.getByText("What is observed now", { exact: true })).toBeVisible();
  await expect(page.getByText("What is still modeled", { exact: true })).toBeVisible();
  await expect(page.getByText("Go / hold criteria", { exact: true })).toBeVisible();
  await expect(page.getByText("Calibration and decision discipline", { exact: true })).toBeVisible();

  const response = await page.context().request.get("/api/pilot/report");
  expect(response.ok()).toBe(true);

  const payload = (await response.json()) as {
    report: {
      title: string;
      recommendationLabel: string;
      buyerPressureTest: Array<{ objection: string }>;
    };
  };

  expect(payload.report.title).toMatch(/proof report/i);
  expect(payload.report.recommendationLabel.length).toBeGreaterThan(10);
  expect(payload.report.buyerPressureTest.length).toBeGreaterThan(0);

  const markdownResponse = await page.context().request.get("/api/pilot/report?format=md");
  expect(markdownResponse.ok()).toBe(true);
  expect((await markdownResponse.text()).startsWith("# ")).toBe(true);
});
