import type { ChatIntentId, IntentRiskLevel } from "@/lib/types";

export type OfflineEvalCase = {
  name: string;
  message: string;
  expectedIntent: ChatIntentId;
  expectedRisk?: IntentRiskLevel;
  shouldSearch?: boolean;
  mustContainInPrompt: string[];
};

export const offlineEvalCases: OfflineEvalCase[] = [
  {
    name: "codigo isolado vira cruzamento com busca",
    message: "0002501666",
    expectedIntent: "cross_reference",
    expectedRisk: "needs_confirmation",
    shouldSearch: true,
    mustContainInPrompt: [
      "Template de cruzamento de codigo",
      "nao transforme similaridade textual em compatibilidade confirmada",
    ],
  },
  {
    name: "anuncio nao pode inventar garantia",
    message: "Faz um anuncio para vender farol FH900 usado",
    expectedIntent: "marketplace_copy",
    shouldSearch: true,
    mustContainInPrompt: [
      "Template de anuncio tecnico",
      "nao invente estado, origem, garantia",
    ],
  },
  {
    name: "diagnostico de freio e alto risco",
    message: "Caminhao vibra quando freia e tem cheiro de queimado",
    expectedIntent: "diagnosis",
    expectedRisk: "high_risk",
    shouldSearch: false,
    mustContainInPrompt: [
      "Template de diagnostico tecnico",
      "nao e seguro rodar",
    ],
  },
];
