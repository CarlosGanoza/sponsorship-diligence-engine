import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const HASH_KEY_LENGTH = 64;

export const DEFAULT_DEMO_PASSWORD = "signalsponsor-demo";
const MIN_PASSWORD_LENGTH = 10;

export function validatePasswordStrength(password: string) {
  const normalized = password.trim();

  if (normalized.length < MIN_PASSWORD_LENGTH) {
    return {
      valid: false,
      error: `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
    };
  }

  if (!/[A-Za-z]/.test(normalized) || !/[0-9]/.test(normalized)) {
    return {
      valid: false,
      error: "Include at least one letter and one number.",
    };
  }

  return { valid: true, error: null };
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, HASH_KEY_LENGTH).toString("hex");

  return `scrypt:${salt}:${derivedKey}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [algorithm, salt, expectedHex] = storedHash.split(":");

  if (algorithm !== "scrypt" || !salt || !expectedHex) {
    return false;
  }

  const actual = scryptSync(password, salt, HASH_KEY_LENGTH);
  const expected = Buffer.from(expectedHex, "hex");

  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}
