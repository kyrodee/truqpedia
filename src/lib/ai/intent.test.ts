import { describe, expect, it } from "vitest";
import {
  buildIntentClassifierPrompt,
  classifyChatIntent,
  parseIntentClassifierJson,
} from "@/lib/ai/intent";

describe("classifyChatIntent", () => {
  it("detects short greetings as casual conversation", () => {
    expect(classifyChatIntent({ message: "oi" }).id).toBe(
      "casual_conversation",
    );
    expect(classifyChatIntent({ message: "opa, tudo bem?" }).id).toBe(
      "casual_conversation",
    );
    expect(classifyChatIntent({ message: "obrigado, era isso" }).id).toBe(
      "casual_conversation",
    );
  });

  it("does not treat greetings with technical requests as casual only", () => {
    const intent = classifyChatIntent({
      message: "Opa, esse codigo ABC1234 serve no Volvo FH?",
    });

    expect(intent.id).toBe("application_check");
  });

  it("detects application checks with missing confirmation data", () => {
    const intent = classifyChatIntent({
      message: "Esse codigo ABC1234 serve no Volvo FH 2018?",
    });

    expect(intent.id).toBe("application_check");
    expect(intent.riskLevel).toBe("needs_confirmation");
    expect(intent.missingCriticalData).toContain(
      "motor/versao ou chassi/VIN para confirmar aplicacao",
    );
  });

  it("detects marketplace copy requests", () => {
    const intent = classifyChatIntent({
      message: "Faz um anuncio de marketplace para vender esse farol codigo FH900",
    });

    expect(intent.id).toBe("marketplace_copy");
    expect(intent.responseShape).toContain("titulo pronto");
  });

  it("detects numeric-only references as code cross-reference", () => {
    const intent = classifyChatIntent({
      message: "0002501666",
    });

    expect(intent.id).toBe("cross_reference");
  });

  it("detects high-risk diagnosis requests", () => {
    const intent = classifyChatIntent({
      message: "Meu caminhao esta com barulho no freio e vazamento",
    });

    expect(intent.id).toBe("diagnosis");
    expect(intent.riskLevel).toBe("high_risk");
    expect(intent.missingCriticalData).toContain(
      "confirmacao por catalogo oficial, chassi/VIN ou fabricante",
    );
  });

  it("detects real brake symptom wording as diagnosis", () => {
    const intent = classifyChatIntent({
      message:
        "Meu caminhao vibra quando freia e fica com cheiro de queimado depois da descida",
    });

    expect(intent.id).toBe("diagnosis");
    expect(intent.riskLevel).toBe("high_risk");
  });

  it("detects document analysis when files are attached", () => {
    const intent = classifyChatIntent({
      message: "Analisa esse arquivo para mim",
      attachments: [{ name: "manual.pdf", type: "application/pdf", size: 1200 }],
    });

    expect(intent.id).toBe("document_analysis");
    expect(intent.missingCriticalData).toContain(
      "texto legivel do arquivo ou foto com etiqueta/codigo em boa resolucao",
    );
  });

  it("prioritizes sales copy when an attachment is used to create an ad", () => {
    const intent = classifyChatIntent({
      message:
        "Analisa essa etiqueta e me diz como eu anunciaria sem prometer aplicacao errada",
      attachments: [
        {
          name: "etiqueta.txt",
          type: "text/plain",
          size: 100,
          text: "TECFIL ARL4150 Mercedes-Benz Atego 2426",
        },
      ],
    });

    expect(intent.id).toBe("marketplace_copy");
  });

  it("treats can I announce as a compatibility decision, not ready copy", () => {
    const intent = classifyChatIntent({
      message:
        "Codigo A9588200261 e farol de qual Mercedes? Da para anunciar como Atego 2015?",
    });

    expect(["application_check", "cross_reference"]).toContain(intent.id);
    expect(intent.id).not.toBe("marketplace_copy");
  });

  it("parses AI classifier JSON into the shared intent shape", () => {
    const fallback = classifyChatIntent({
      message: "Codigo A9604600105 serve no Atego?",
    });

    const parsed = parseIntentClassifierJson(
      JSON.stringify({
        intent: "application_check",
        confidence: 0.88,
        riskLevel: "high_risk",
        missingCriticalData: ["chassi/VIN"],
        shouldAskClarifyingQuestion: true,
      }),
      fallback,
    );

    expect(parsed.id).toBe("application_check");
    expect(parsed.confidence).toBe(0.88);
    expect(parsed.riskLevel).toBe("high_risk");
    expect(parsed.missingCriticalData).toEqual(["chassi/VIN"]);
  });

  it("keeps heuristic fallback when AI classifier JSON is invalid", () => {
    const fallback = classifyChatIntent({ message: "0002501666" });

    expect(parseIntentClassifierJson("nao e json", fallback)).toBe(fallback);
  });

  it("builds a bounded classifier prompt with allowed intent ids", () => {
    const prompt = buildIntentClassifierPrompt({
      message: "Faz um anuncio para o codigo ABC1234",
      attachments: [
        {
          name: "etiqueta.txt",
          type: "text/plain",
          size: 10,
          text: "ABC1234 Mercedes Atego".repeat(80),
        },
      ],
    });

    expect(prompt).toContain("marketplace_copy");
    expect(prompt).toContain("textPreview");
    expect(prompt.length).toBeLessThan(5000);
  });
});
