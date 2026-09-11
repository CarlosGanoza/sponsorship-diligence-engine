import { expect, gotoAuthenticated, test } from "./fixtures";

test("block sponsor-facing packet export when the file is not release-safe", async ({ page }) => {
  await gotoAuthenticated(page, "/candidates?q=Jonah");
  const candidateHref = await page.getByRole("link", { name: "Jonah Park" }).first().getAttribute("href");
  expect(candidateHref).toBeTruthy();
  const candidateId = candidateHref!.split("/").pop();
  expect(candidateId).toBeTruthy();

  const response = await page.context().request.get(`/api/exports/${candidateId}?type=packet&format=json`);
  expect(response.status()).toBe(409);

  const payload = (await response.json()) as { error: string };
  expect(payload.error).toMatch(/blocked|hold|proof request|stale|do not advance/i);
});
