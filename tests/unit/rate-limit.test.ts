import { buildRateLimitHeaders, consumeRateLimit, getRequestClientLabel } from "@/lib/runtime/rate-limit";

describe("runtime rate limiting", () => {
  it("blocks requests after the limit is reached within the same window", () => {
    const first = consumeRateLimit({
      bucket: "unit-rate-limit-a",
      identifier: "127.0.0.1",
      limit: 2,
      windowMs: 60_000,
      nowMs: 1_000,
    });
    const second = consumeRateLimit({
      bucket: "unit-rate-limit-a",
      identifier: "127.0.0.1",
      limit: 2,
      windowMs: 60_000,
      nowMs: 2_000,
    });
    const third = consumeRateLimit({
      bucket: "unit-rate-limit-a",
      identifier: "127.0.0.1",
      limit: 2,
      windowMs: 60_000,
      nowMs: 3_000,
    });

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
    expect(third.retryAfterSeconds).toBeGreaterThan(0);
    expect(buildRateLimitHeaders(third)["Retry-After"]).toBe(String(third.retryAfterSeconds));
  });

  it("resets the bucket after the window expires", () => {
    consumeRateLimit({
      bucket: "unit-rate-limit-b",
      identifier: "candidate-upload",
      limit: 1,
      windowMs: 5_000,
      nowMs: 10_000,
    });

    const afterReset = consumeRateLimit({
      bucket: "unit-rate-limit-b",
      identifier: "candidate-upload",
      limit: 1,
      windowMs: 5_000,
      nowMs: 16_001,
    });

    expect(afterReset.allowed).toBe(true);
    expect(afterReset.remaining).toBe(0);
  });

  it("prefers forwarded client information when deriving a client label", () => {
    const clientLabel = getRequestClientLabel(
      new Headers({
        "x-forwarded-for": "203.0.113.42, 10.0.0.1",
        "x-real-ip": "10.0.0.1",
      }),
    );

    expect(clientLabel).toBe("203.0.113.42");
  });
});
