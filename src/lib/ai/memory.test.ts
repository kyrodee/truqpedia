import { describe, expect, it } from "vitest";
import { buildConversationMemory, memoryToPrompt } from "@/lib/ai/memory";
import type { IntentClassification } from "@/lib/types";

const baseIntent: IntentClassification = {
  id: "cross_reference",
  label: "cruzamento de codigo",
  confidence: 0.82,
  responseShape: ["equivalencias provaveis", "nivel de confianca"],
  missingCriticalData: ["codigo original, OEM ou referencia da marca"],
  shouldAskClarifyingQuestion: true,
  riskLevel: "needs_confirmation",
  activities: ["Classificando a intencao da pergunta"],
};

describe("conversation memory", () => {
  it("summarizes the latest exchange and extracts entities", () => {
    const memory = buildConversationMemory({
      history: [{ role: "user", content: "Quero cruzar a referencia antiga" }],
      userMessage: "A peca ABC1234 pode substituir a DEF5678?",
      assistantContent: "Provavel equivalencia, mas precisa conferir medidas.",
      intent: baseIntent,
      now: new Date("2026-06-15T12:00:00.000Z"),
    });

    expect(memory.lastIntent).toBe("cross_reference");
    expect(memory.entities).toEqual(expect.arrayContaining(["ABC1234", "DEF5678"]));
    expect(memory.partCodes).toEqual(expect.arrayContaining(["ABC1234", "DEF5678"]));
    expect(memory.openQuestions).toContain(
      "codigo original, OEM ou referencia da marca",
    );
  });

  it("renders memory as prompt context", () => {
    const prompt = memoryToPrompt({
      summary: "Usuario esta comparando codigos de uma peca pesada.",
      entities: ["ABC1234"],
      partCodes: ["ABC1234"],
      vehicles: ["Volvo"],
      decisions: ["compatibilidade precisa de catalogo"],
      businessPreferences: ["usa respostas para anuncio de marketplace"],
      openQuestions: ["confirmar chassi"],
      lastIntent: "cross_reference",
      updatedAt: "2026-06-15T12:00:00.000Z",
    });

    expect(prompt).toContain("Memoria resumida desta conversa");
    expect(prompt).toContain("ABC1234");
    expect(prompt).toContain("Veiculos citados");
    expect(prompt).toContain("Decisoes anteriores");
    expect(prompt).toContain("confirmar chassi");
  });
});
