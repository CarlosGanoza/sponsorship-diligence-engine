import { expect, gotoAuthenticated, test } from "./fixtures";

test("open internal sponsor packet from a candidate record", async ({ page }) => {
  test.slow();
  test.setTimeout(180_000);
  await gotoAuthenticated(page, "/candidates");
  await page.getByRole("link", { name: "Maya Rios" }).click();
  const packetHref = await page.getByRole("link", { name: "Internal packet" }).getAttribute("href");
  await gotoAuthenticated(page, packetHref ?? "/packets");

  await expect(page.getByText("Packet target sponsor")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Evidence packet" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Warm path and match logic" })).toBeVisible();
});
