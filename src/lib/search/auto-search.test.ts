import { describe, expect, it } from "vitest";
import { decideWebSearch } from "@/lib/search/auto-search";

describe("decideWebSearch", () => {
  it("searches numeric-only references", () => {
    const decision = decideWebSearch({
      message: "0002501666",
      attachments: [],
      requested: "auto",
    });

    expect(decision.enabled).toBe(true);
    expect(decision.query).toContain("0002501666");
  });

  it("uses the last reference from history when the user asks to search", () => {
    const decision = decideWebSearch({
      message: "faz a busca ai",
      attachments: [],
      requested: "auto",
      history: [
        {
          role: "user",
          content: "eu so tenho a ref 0002501666",
        },
      ],
    });

    expect(decision.enabled).toBe(true);
    expect(decision.query.startsWith("0002501666")).toBe(true);
    expect(decision.reason).toContain("ultima referencia");
  });
});
