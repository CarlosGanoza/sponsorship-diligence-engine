import { expect, gotoAuthenticated, test } from "./fixtures";

test("open an outreach plan from the opportunity brief page", async ({ page }) => {
  await gotoAuthenticated(page, "/briefs?q=Maya");
  const outreachHref = await page.getByRole("link", { name: "Outreach plan" }).first().getAttribute("href");
  expect(outreachHref).toBeTruthy();
  await page.goto(outreachHref!);
  await expect(page).toHaveURL(/\/outreach\/.+\?sponsor=/);

  await expect(page.getByText("Outreach target sponsor")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Outreach plan · /i })).toBeVisible();
  await expect(page.getByText("Sponsor outreach plan")).toBeVisible();
  const outreachRelease = page.getByRole("region", { name: "Sponsor-facing outreach release" });
  const crmRelease = page.getByRole("region", { name: "CRM handoff release" });
  await outreachRelease.getByRole("button", { name: /request approval|refresh request/i }).click();
  await expect(outreachRelease.getByRole("button", { name: "Approve" })).toBeVisible();
  await outreachRelease.getByRole("button", { name: "Approve" }).click();
  await crmRelease.getByRole("button", { name: /request approval|refresh request/i }).click();
  await expect(crmRelease.getByRole("button", { name: "Approve" })).toBeVisible();
  await crmRelease.getByRole("button", { name: "Approve" }).click();
  await page.getByRole("tab", { name: "Email drafts" }).click();
  await expect(page.getByText("Outreach release state")).toBeVisible();
  await expect(page.getByText("Drafting guardrails")).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy draft" })).toBeVisible();
  await page.getByRole("tab", { name: "CRM handoff" }).click();
  await expect(page.getByText("CRM handoff release state")).toBeVisible();
  await expect(page.getByText("CRM handoff preview")).toBeVisible();
  await expect(page.getByRole("link", { name: "Download JSON" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sync to CRM" })).toBeDisabled();
  await expect(page.getByText("The guardrail reads do not advance, so the file is not safe for sponsor-facing use.").first()).toBeVisible();
});
