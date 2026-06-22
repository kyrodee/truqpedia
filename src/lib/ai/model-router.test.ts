import { describe, expect, it } from "vitest";
import {
  buildProviderMessages,
  selectGenerationProfile,
} from "@/lib/ai/model-router";
import { GROQ_PRIMARY_MODEL } from "@/lib/constants";
import type { IntentClassification } from "@/lib/types";

const marketplaceIntent: IntentClassification = {
  id: "marketplace_copy",
  label: "texto de venda",
  confidence: 0.9,
  responseShape: ["titulo pronto"],
  missingCriticalData: [],
  shouldAskClarifyingQuestion: false,
  riskLevel: "normal",
  activities: [],
};

describe("model router single-model runtime", () => {
  it("always selects the Groq gpt-oss 120b model", () => {
    expect(selectGenerationProfile({ intent: marketplaceIntent }).model).toBe(
      GROQ_PRIMARY_MODEL,
    );
    expect(selectGenerationProfile({ sourceCount: 3 }).model).toBe(
      GROQ_PRIMARY_MODEL,
    );
  });

  it("uses lower temperature for grounded technical answers", () => {
    const profile = selectGenerationProfile({
      sourceCount: 2,
      intent: {
        ...marketplaceIntent,
        id: "cross_reference",
        label: "cruzamento de codigo",
        riskLevel: "needs_confirmation",
      },
    });

    expect(profile.strategy).toBe("grounded_technical");
    expect(profile.temperature).toBeLessThan(0.25);
  });

  it("adds intent templates and source metadata to provider messages", () => {
    const messages = buildProviderMessages({
      history: [],
      userMessage: "Cria anuncio para FH900",
      sources: [
        {
          title: "catalogo.xlsx - Pecas, linha 2",
          url: "file:///projects/p/files/d",
          snippet: "Catalogo: Pecas | Linha 2: [Codigo: FH900]",
          provider: "project_rag",
          score: 0.92,
          metadata: {
            referenceHit: true,
            rowNumber: 2,
          },
        },
      ],
      intent: marketplaceIntent,
    });

    expect(messages[0].content).toContain("Template de anuncio tecnico");
    expect(messages[0].content).toContain("Score: 0.92");
    expect(messages[0].content).toContain("referenceHit=true");
  });
});
