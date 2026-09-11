import { expect, gotoAuthenticated, test } from "./fixtures";

test("generate recommendation in mock mode", async ({ page }) => {
  await gotoAuthenticated(page, "/candidates");
  const candidateHref = await page.getByRole("link", { name: "Diego Alvarez" }).first().getAttribute("href");
  expect(candidateHref).toBeTruthy();
  const candidateId = candidateHref!.split("/").pop();
  expect(candidateId).toBeTruthy();

  await gotoAuthenticated(page, candidateHref!);
  const response = await page.context().request.post(`/api/candidates/${candidateId}/actions`, {
    data: {
      action: "match",
    },
  });
  expect(response.ok()).toBe(true);
  await expect
    .poll(
      async () => {
        const response = await page.context().request.get(`/api/test/candidates/${candidateId}/recommendations`);
        const payload = (await response.json()) as {
          nextActionCount: number;
        };

        return payload.nextActionCount;
      },
      { timeout: 30000 },
    )
    .toBeGreaterThan(0);

  await gotoAuthenticated(page, `${candidateHref!}?tab=actions`);

  await expect(page.getByText("Recommended next action")).toBeVisible();
  await expect(page.getByText("No action recommendation yet")).toHaveCount(0);
});
