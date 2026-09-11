import { expect, gotoAuthenticated, test } from "./fixtures";

test("render the sponsor pipeline and operator task queues with seeded workflow data", async ({
  page,
}) => {
  test.slow();
  test.setTimeout(180_000);
  await gotoAuthenticated(page, "/pipeline");
  await expect(page.getByRole("heading", { name: "Sponsor pipeline" })).toBeVisible();
  await expect(page.getByText("Total items")).toBeVisible();
  await expect(page.getByText("Sponsor-path overlap")).toBeVisible();
  await expect(page.getByRole("link", { name: "Maya Rios" }).first()).toBeVisible();
  await expect(page.getByText("Live fit").first()).toBeVisible();
  await expect(page.getByText(/Stored \d+/).first()).toBeVisible();
  await expect(page.getByText("Stale recs")).toBeVisible();
  await expect(page.getByText(/Fresh recommendation|Watch recommendation drift|Stale recommendation/).first()).toBeVisible();

  await gotoAuthenticated(page, "/tasks");
  await expect(page.getByRole("heading", { name: "Operator tasks" })).toBeVisible();
  await expect(page.getByText("Complete sponsor packet follow-up")).toBeVisible();
  await expect(page.getByText("Created from", { exact: false }).first()).toBeVisible();
});
