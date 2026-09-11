import { expect, gotoAuthenticated, resetDemoData, test } from "./fixtures";

test("open a shared pilot proof report without a workspace session", async ({ page }) => {
  test.slow();
  await resetDemoData(page);
  await gotoAuthenticated(page, "/pilot/report");

  await expect(page.getByText("Share-safe pilot review", { exact: true })).toBeVisible();
  const createLinkButton = page.getByRole("button", { name: "Create link" }).first();
  await expect(createLinkButton).toBeEnabled({ timeout: 15000 });
  await createLinkButton.click();

  const linkInput = page.locator("input[readonly]").last();
  await expect(linkInput).toHaveValue(/\/pilot\/review\//);
  const shareUrl = await linkInput.inputValue();

  await page.context().clearCookies();
  await page.goto(shareUrl, { waitUntil: "domcontentloaded" });

  await expect(page.getByText("Shared pilot review")).toBeVisible();
  await expect(page.getByText("Measured Pilot Proof Report", { exact: true })).toBeVisible();
});

test("open a shared pilot buyer pack without a workspace session", async ({ page }) => {
  test.slow();
  await resetDemoData(page);
  await gotoAuthenticated(page, "/pilot/pack");

  await expect(page.getByText("Share-safe pilot review", { exact: true })).toBeVisible();
  const createLinkButton = page.getByRole("button", { name: "Create link" }).first();
  await expect(createLinkButton).toBeEnabled({ timeout: 15000 });
  await createLinkButton.click();

  const linkInput = page.locator("input[readonly]").last();
  await expect(linkInput).toHaveValue(/\/pilot\/review\//);
  const shareUrl = await linkInput.inputValue();

  await page.context().clearCookies();
  await page.goto(shareUrl, { waitUntil: "domcontentloaded" });

  await expect(page.getByText("Shared pilot review")).toBeVisible();
  await expect(page.getByText("Design-Partner Buyer Pack", { exact: true })).toBeVisible();
});

test("open a shared commercial proof brief without a workspace session", async ({ page }) => {
  test.slow();
  await resetDemoData(page);
  await gotoAuthenticated(page, "/commercial");

  await expect(page.getByText("Share-safe buyer review", { exact: true })).toBeVisible();
  const createLinkButton = page.getByRole("button", { name: "Create link" }).first();
  await expect(createLinkButton).toBeEnabled({ timeout: 15000 });
  await createLinkButton.click();

  const linkInput = page.locator("input[readonly]").last();
  await expect(linkInput).toHaveValue(/\/pilot\/review\//);
  const shareUrl = await linkInput.inputValue();

  await page.context().clearCookies();
  await page.goto(shareUrl, { waitUntil: "domcontentloaded" });

  await expect(page.getByText("Shared pilot review")).toBeVisible();
  await expect(page.getByText("Commercial Proof", { exact: true })).toBeVisible();
});

test("open a shared pilot launch brief without a workspace session", async ({ page }) => {
  test.slow();
  await resetDemoData(page);
  await gotoAuthenticated(page, "/onboarding");

  await expect(page.getByText("Share-safe buyer review", { exact: true })).toBeVisible();
  const createLinkButton = page.getByRole("button", { name: "Create link" }).first();
  await expect(createLinkButton).toBeEnabled({ timeout: 15000 });
  await createLinkButton.click();

  const linkInput = page.locator("input[readonly]").last();
  await expect(linkInput).toHaveValue(/\/pilot\/review\//);
  const shareUrl = await linkInput.inputValue();

  await page.context().clearCookies();
  await page.goto(shareUrl, { waitUntil: "domcontentloaded" });

  await expect(page.getByText("Shared pilot review")).toBeVisible();
  await expect(page.getByText("Pilot Launch", { exact: true })).toBeVisible();
});

test("open a shared executive ROI brief without a workspace session", async ({ page }) => {
  test.slow();
  await resetDemoData(page);
  await gotoAuthenticated(page, "/roi");

  await expect(page.getByText("Share-safe buyer review", { exact: true })).toBeVisible();
  const createLinkButton = page.getByRole("button", { name: "Create link" }).first();
  await expect(createLinkButton).toBeEnabled({ timeout: 15000 });
  await createLinkButton.click();

  const linkInput = page.locator("input[readonly]").last();
  await expect(linkInput).toHaveValue(/\/pilot\/review\//);
  const shareUrl = await linkInput.inputValue();

  await page.context().clearCookies();
  await page.goto(shareUrl, { waitUntil: "domcontentloaded" });

  await expect(page.getByText("Shared pilot review")).toBeVisible();
  await expect(page.getByText("Executive ROI", { exact: true })).toBeVisible();
});
