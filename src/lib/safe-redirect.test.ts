import { describe, expect, it } from "vitest";
import { safeSameOriginRedirect } from "@/lib/safe-redirect";

describe("safeSameOriginRedirect", () => {
  it("allows relative paths on the same origin", () => {
    const requestUrl = new URL("https://app.example.com/auth/callback?next=/admin");

    expect(safeSameOriginRedirect(requestUrl).toString()).toBe(
      "https://app.example.com/admin",
    );
  });

  it("preserves same-origin query strings", () => {
    const requestUrl = new URL(
      "https://app.example.com/auth/callback?next=/chat?c=123",
    );

    expect(safeSameOriginRedirect(requestUrl).toString()).toBe(
      "https://app.example.com/chat?c=123",
    );
  });

  it("rejects absolute external URLs", () => {
    const requestUrl = new URL(
      "https://app.example.com/auth/callback?next=https://evil.example/login",
    );

    expect(safeSameOriginRedirect(requestUrl).toString()).toBe(
      "https://app.example.com/",
    );
  });

  it("rejects protocol-relative URLs", () => {
    const requestUrl = new URL(
      "https://app.example.com/auth/callback?next=//evil.example/login",
    );

    expect(safeSameOriginRedirect(requestUrl).toString()).toBe(
      "https://app.example.com/",
    );
  });
});
