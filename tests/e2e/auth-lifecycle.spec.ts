import { expect, gotoAuthenticated, resetDemoData, test } from "./fixtures";

test("create a workspace invite and accept it through the secure link", async ({ page }) => {
  test.slow();
  test.setTimeout(180_000);
  await resetDemoData(page);
  await gotoAuthenticated(page, "/settings");

  const inviteResponse = await page.context().request.post("/api/auth/workspace-invites", {
    data: {
      inviteeName: "Adrian Cole",
      email: "adrian.cole@signalsponsor.demo",
      membershipRole: "MEMBER",
      title: "Review Fellow",
    },
  });
  expect(inviteResponse.ok()).toBe(true);
  const invitePayload = (await inviteResponse.json()) as {
    invitePath?: string | null;
  };
  const invitePath = invitePayload.invitePath?.trim();
  expect(invitePath).toContain("/accept-invite/");

  await page.context().clearCookies();
  await page.goto(invitePath!, { waitUntil: "domcontentloaded" });

  await expect(page.getByText("Join the sponsorship review workspace")).toBeVisible();
  await page.getByLabel("Full name").fill("Adrian Cole");
  await page.getByLabel("Password").fill("Signal12345");
  await page.getByRole("button", { name: "Accept invite" }).click();

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 45000 });
  await expect(page.locator("aside").getByText("adrian.cole@signalsponsor.demo", { exact: true })).toBeVisible({
    timeout: 45000,
  });
  await expect(page.locator("aside").getByText("Adrian Cole", { exact: true })).toBeVisible({ timeout: 45000 });
});

test("issue a password reset link and sign in with the new credential", async ({ page }) => {
  test.slow();
  test.setTimeout(180_000);
  await resetDemoData(page);
  await page.context().clearCookies();
  await page.goto("/reset-password", { waitUntil: "domcontentloaded" });

  await page.getByLabel("Workspace email").fill("rina@signalsponsor.demo");
  const resetResponse = await page.context().request.post("/api/auth/password-reset", {
    data: {
      email: "rina@signalsponsor.demo",
    },
  });
  expect(resetResponse.ok()).toBe(true);
  const resetPayload = (await resetResponse.json()) as {
    resetPath?: string | null;
  };
  const resetPath = resetPayload.resetPath?.trim();
  expect(resetPath).toContain("/reset-password/");

  await page.goto(resetPath!, { waitUntil: "domcontentloaded" });
  await page.getByLabel("New password").fill("Signal98765");
  await page.getByRole("button", { name: "Update password" }).click();

  await expect(page.getByText("Password updated. Sign in with the new credential.")).toBeVisible();
  await page.getByLabel("Workspace account").selectOption("rina@signalsponsor.demo");
  await page.getByLabel("Password").fill("Signal98765");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 45000 });
  await expect(page.locator("aside").getByText("rina@signalsponsor.demo", { exact: true })).toBeVisible({
    timeout: 45000,
  });
  await expect(page.locator("aside").getByText("Rina Patel", { exact: true })).toBeVisible({ timeout: 45000 });
});
