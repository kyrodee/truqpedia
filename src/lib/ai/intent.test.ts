import { describe, expect, it } from "vitest";
import { classifyChatIntent } from "@/lib/ai/intent";

describe("classifyChatIntent", () => {
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
});
