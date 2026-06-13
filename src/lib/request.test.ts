import { describe, expect, it } from "vitest";
import { readJsonBody } from "@/lib/request";

describe("readJsonBody", () => {
  it("parses valid JSON", async () => {
    const result = await readJsonBody(
      new Request("https://app.example.com", {
        method: "POST",
        body: JSON.stringify({ message: "ok" }),
      }),
      1_024,
    );

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data).toEqual({ message: "ok" });
    }
  });

  it("returns null data for invalid JSON so route schemas can respond", async () => {
    const result = await readJsonBody(
      new Request("https://app.example.com", {
        method: "POST",
        body: "{",
      }),
      1_024,
    );

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data).toBeNull();
    }
  });

  it("rejects bodies over the byte limit", async () => {
    const result = await readJsonBody(
      new Request("https://app.example.com", {
        method: "POST",
        body: JSON.stringify({ message: "x".repeat(200) }),
      }),
      20,
    );

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.response.status).toBe(413);
    }
  });
});
