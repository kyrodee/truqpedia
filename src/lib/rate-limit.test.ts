import { describe, expect, it } from "vitest";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

describe("checkRateLimit", () => {
  it("allows requests until the configured limit", () => {
    const key = `test:${crypto.randomUUID()}`;

    expect(
      checkRateLimit({ key, limit: 2, windowMs: 1_000, now: 1 }).allowed,
    ).toBe(true);
    expect(
      checkRateLimit({ key, limit: 2, windowMs: 1_000, now: 2 }).allowed,
    ).toBe(true);
    expect(
      checkRateLimit({ key, limit: 2, windowMs: 1_000, now: 3 }).allowed,
    ).toBe(false);
  });

  it("resets after the window expires", () => {
    const key = `test:${crypto.randomUUID()}`;

    checkRateLimit({ key, limit: 1, windowMs: 1_000, now: 1 });

    expect(
      checkRateLimit({ key, limit: 1, windowMs: 1_000, now: 500 }).allowed,
    ).toBe(false);
    expect(
      checkRateLimit({ key, limit: 1, windowMs: 1_000, now: 1_002 }).allowed,
    ).toBe(true);
  });
});

describe("getClientIp", () => {
  it("uses the first forwarded IP", () => {
    const request = new Request("https://app.example.com", {
      headers: {
        "x-forwarded-for": "203.0.113.1, 203.0.113.2",
      },
    });

    expect(getClientIp(request)).toBe("203.0.113.1");
  });

  it("falls back when proxy headers are missing", () => {
    expect(getClientIp(new Request("https://app.example.com"))).toBe("unknown");
  });
});
