import { expect, test as base } from "@playwright/test";
import type { Page } from "@playwright/test";

const SESSION_COOKIE_NAME = "signal_sponsor_session";
const TEST_BASE_URL = "http://127.0.0.1:3001";

export const test = base.extend({});

function isRetryableNavigationError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("ERR_ABORTED") || message.includes("frame was detached");
}

function isRetryableRequestError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("ECONNRESET") ||
    message.includes("ECONNREFUSED") ||
    message.includes("socket hang up") ||
    message.includes("Target page, context or browser has been closed")
  );
}

async function gotoWithRetry(page: Page, href: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto(href, { waitUntil: "domcontentloaded" });
      const loadingHeading = page.getByRole("heading", { name: "Loading workspace" });
      if (await loadingHeading.isVisible().catch(() => false)) {
        await expect(loadingHeading).toBeHidden({ timeout: 30000 });
      }
      return;
    } catch (error) {
      if (!isRetryableNavigationError(error) || attempt === 2) {
        throw error;
      }

      await page.waitForTimeout(500 * (attempt + 1));
    }
  }
}

export async function gotoPublic(page: Page, href: string) {
  await gotoWithRetry(page, href);
}

async function postWithRetry(page: Page, href: string, data: Record<string, unknown>) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await page.context().request.post(href, {
        data,
      });
    } catch (error) {
      if (!isRetryableRequestError(error) || attempt === 2) {
        throw error;
      }

      await page.waitForTimeout(500 * (attempt + 1));
    }
  }

  throw new Error(`Request retry loop exhausted for ${href}.`);
}

async function installTestSession(page: Page) {
  const response = await postWithRetry(page, "/api/test/session", {});

  expect(response.ok()).toBe(true);

  const payload = (await response.json()) as {
    sessionToken: string;
    expiresAt: string;
  };

  await page.context().addCookies([
    {
      name: SESSION_COOKIE_NAME,
      value: payload.sessionToken,
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      secure: false,
      expires: Math.floor(new Date(payload.expiresAt).getTime() / 1000),
    },
  ]);
}

async function hasTestSession(page: Page) {
  const cookies = await page.context().cookies(TEST_BASE_URL);

  return cookies.some(
    (cookie) =>
      cookie.name === SESSION_COOKIE_NAME &&
      (cookie.expires === -1 || cookie.expires > Math.floor(Date.now() / 1000) + 30),
  );
}

async function ensureTestSession(page: Page) {
  if (await hasTestSession(page)) {
    return;
  }

  await installTestSession(page);
}

test.beforeEach(async ({ page }) => {
  await ensureTestSession(page);
});

export async function gotoAuthenticated(page: Page, href: string) {
  await ensureTestSession(page);
  await gotoWithRetry(page, href);
}

export async function resetDemoData(page: Page) {
  await ensureTestSession(page);
  const response = await postWithRetry(page, "/api/test/reset", {});

  expect(response.ok()).toBe(true);

  await installTestSession(page);
}

export { expect };
