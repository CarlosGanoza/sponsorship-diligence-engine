import { expect, gotoAuthenticated, test } from "./fixtures";

test("send an operator alert digest from the alerts center", async ({ page }) => {
  test.slow();
  await gotoAuthenticated(page, "/alerts");

  await expect(page.getByText("Digest routing")).toBeVisible();

  const deliveryRows = page.getByText(/alerts included$/);
  const initialCount = await deliveryRows.count();

  const sendButton = page.getByRole("button", { name: "Send to ops queue only" });
  await expect(sendButton).toBeEnabled({ timeout: 15000 });
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/api/alerts/digest") &&
        response.request().method() === "POST" &&
        response.ok(),
      { timeout: 30000 },
    ),
    sendButton.click(),
  ]);
  await expect
    .poll(
      async () => {
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.getByText("Recent digest deliveries").waitFor();
        return page.getByText(/alerts included$/).count();
      },
      { timeout: 15000 },
    )
    .toBe(initialCount + 1);
});
