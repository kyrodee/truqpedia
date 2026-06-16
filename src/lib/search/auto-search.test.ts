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

  it("does not search when an attachment already provides text for marketplace copy", () => {
    const decision = decideWebSearch({
      message: "Analisa essa etiqueta e monta um anuncio",
      attachments: [
        {
          name: "etiqueta.txt",
          type: "text/plain",
          size: 100,
          text: "TECFIL ARL4150 Mercedes Atego 2426",
        },
      ],
      requested: "auto",
      intent: {
        id: "marketplace_copy",
        label: "texto de venda",
        confidence: 0.9,
        responseShape: [],
        missingCriticalData: [],
        shouldAskClarifyingQuestion: false,
        riskLevel: "normal",
        activities: [],
      },
    });

    expect(decision.enabled).toBe(false);
  });

  it("does not search vague image-only attachment requests without a code", () => {
    const decision = decideWebSearch({
      message: "Veja esse arquivo e me diga se serve no Atego 2426",
      attachments: [
        {
          name: "foto.jpg",
          type: "image/jpeg",
          size: 100,
        },
      ],
      requested: "auto",
      intent: {
        id: "application_check",
        label: "validacao de aplicacao",
        confidence: 0.85,
        responseShape: [],
        missingCriticalData: [],
        shouldAskClarifyingQuestion: true,
        riskLevel: "needs_confirmation",
        activities: [],
      },
    });

    expect(decision.enabled).toBe(false);
  });
});
