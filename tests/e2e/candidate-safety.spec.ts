import { expect, gotoAuthenticated, test } from "./fixtures";

test("show evidence-discipline guardrails on the candidate detail page", async ({ page }) => {
  await gotoAuthenticated(page, "/candidates");
  const candidateHref = await page.getByRole("link", { name: "Maya Rios" }).first().getAttribute("href");
  expect(candidateHref).toBeTruthy();

  await page.goto(candidateHref!);

  await expect(page.getByText("Evidence discipline")).toBeVisible();
  await expect(page.getByText(/% memo support coverage/i).first()).toBeVisible();
  await expect(page.getByText(/% citation coverage/i).first()).toBeVisible();
  await expect(page.getByText(/source quality/i)).toBeVisible();
  await expect(page.getByText(/\/10 freshness/i).first()).toBeVisible();
  await expect(page.getByText(/contact details/i).first()).toBeVisible();
  await expect(page.getByText("Missing proof")).toBeVisible();
});
