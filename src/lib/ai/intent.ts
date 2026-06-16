import type {
  AssistantPreferences,
  ChatIntentId,
  IntentClassification,
  IntentRiskLevel,
  UploadedAttachment,
} from "@/lib/types";

type IntentInput = {
  message: string;
  attachments?: UploadedAttachment[];
  preferences?: AssistantPreferences;
};

type IntentProfile = {
  label: string;
  responseShape: string[];
  searchHint?: string;
};

const intentProfiles: Record<ChatIntentId, IntentProfile> = {
  casual_conversation: {
    label: "conversa casual",
    responseShape: [
      "resposta curta e natural",
      "tom humano",
      "convite leve para continuar",
    ],
  },
  application_check: {
    label: "validacao de aplicacao",
    responseShape: [
      "conclusao possivel agora",
      "dados que confirmam ou faltam",
      "risco de compra errada",
      "proximo passo de confirmacao",
    ],
    searchHint: "catalogo aplicacao compatibilidade autopecas pesadas",
  },
  cross_reference: {
    label: "cruzamento de codigo",
    responseShape: [
      "equivalencias provaveis",
      "o que precisa bater",
      "marcas ou codigos a conferir",
      "nivel de confianca",
    ],
    searchHint: "codigo equivalente OEM referencia catalogo autopecas",
  },
  marketplace_copy: {
    label: "texto de venda",
    responseShape: [
      "titulo pronto",
      "descricao objetiva",
      "aplicacoes provaveis",
      "itens para confirmar antes da compra",
      "palavras-chave",
    ],
  },
  purchase_checklist: {
    label: "apoio de compra",
    responseShape: [
      "criterio de decisao",
      "checklist de conferencia",
      "perguntas para fornecedor",
      "risco comercial",
    ],
    searchHint: "preco mercado fornecedor autopecas caminhonete caminhao",
  },
  diagnosis: {
    label: "diagnostico tecnico",
    responseShape: [
      "hipoteses mais provaveis",
      "perguntas de triagem",
      "testes simples",
      "quando encaminhar para mecanico",
    ],
  },
  technical_explanation: {
    label: "explicacao tecnica",
    responseShape: [
      "explicacao direta",
      "como conferir na pratica",
      "erros comuns",
      "exemplo aplicado",
    ],
  },
  document_analysis: {
    label: "analise de arquivo",
    responseShape: [
      "o que o arquivo mostra",
      "pontos importantes",
      "lacunas do arquivo",
      "acao recomendada",
    ],
  },
  general_support: {
    label: "suporte geral",
    responseShape: [
      "resposta direta",
      "contexto necessario",
      "proximo passo",
    ],
  },
};

const codeLikePattern = /\b[A-Z]{1,5}[-\s]?\d{3,}[A-Z0-9-]*\b/i;
const numericReferencePattern = /\b\d{6,14}\b/;
const vinPattern = /\b[A-HJ-NPR-Z0-9]{17}\b/i;

const keywordMap: Record<ChatIntentId, string[]> = {
  application_check: [
    "aplica",
    "aplicacao",
    "serve",
    "compat",
    "encaixa",
    "modelo",
    "ano",
    "motor",
    "chassi",
    "vin",
    "placa",
  ],
  cross_reference: [
    "equival",
    "referencia",
    "codigo",
    "cod",
    "part number",
    "oem",
    "sku",
    "substitui",
    "similar",
    "cruza",
  ],
  marketplace_copy: [
    "anuncio",
    "marketplace",
    "mercado livre",
    "olx",
    "descricao",
    "titulo",
    "copy",
    "anunci",
    "vender",
    "venda",
    "palavra chave",
    "palavras chave",
  ],
  purchase_checklist: [
    "comprar",
    "compra",
    "cotacao",
    "orcamento",
    "fornecedor",
    "estoque",
    "preco",
    "custo",
    "margem",
    "pedido",
  ],
  diagnosis: [
    "defeito",
    "problema",
    "falha",
    "barulho",
    "trepida",
    "vibra",
    "vibracao",
    "vazamento",
    "fuma",
    "freia",
    "freando",
    "frenagem",
    "queimado",
    "aquecendo",
    "superaque",
    "descida",
    "luz acesa",
    "codigo de erro",
    "nao pega",
    "perde forca",
  ],
  technical_explanation: [
    "explica",
    "como funciona",
    "o que e",
    "o que eh",
    "instalar",
    "medir",
    "regular",
    "calibrar",
  ],
  document_analysis: [
    "arquivo",
    "anexo",
    "pdf",
    "planilha",
    "foto",
    "imagem",
    "etiqueta",
    "analisa",
    "analisar",
    "ler",
    "nota",
    "manual",
  ],
  general_support: [],
  casual_conversation: [],
};

const highRiskTerms = [
  "freio",
  "freios",
  "freia",
  "freando",
  "frenagem",
  "direcao",
  "suspensao",
  "motor",
  "airbag",
  "pneu",
  "eixo",
  "terminal",
  "barra",
  "manga",
  "cubo",
  "embreagem",
  "combustivel",
];

export function classifyChatIntent(input: IntentInput): IntentClassification {
  const attachments = input.attachments ?? [];
  const normalizedMessage = normalizeForIntent(input.message);
  const scores = buildInitialScores();
  const hasAttachment = attachments.length > 0;
  const hasAttachmentText = attachments.some((attachment) => attachment.text);
  const hasCode =
    codeLikePattern.test(input.message) ||
    numericReferencePattern.test(input.message);
  const asksCompatibilityDecision = hasAny(normalizedMessage, [
    "da para anunciar como",
    "posso anunciar como",
    "serve",
    "compativel",
    "e de qual",
    "eh de qual",
    "qual mercedes",
  ]);
  const asksReadySaleCopy = hasAny(normalizedMessage, [
    "faz um anuncio",
    "cria um anuncio",
    "gera um anuncio",
    "escreve um anuncio",
    "texto de venda",
    "descricao",
    "titulo",
    "palavra chave",
    "palavras chave",
    "como eu anunciaria",
    "como anunciaria",
  ]);
  let salesCopyBoost = 1;

  if (asksReadySaleCopy) {
    salesCopyBoost = hasCode || hasAttachment ? 6 : 3;
  }

  if (
    isCasualConversation({
      message: input.message,
      normalizedMessage,
      hasAttachment,
      hasCode,
    })
  ) {
    return buildClassification("casual_conversation", 0.92);
  }

  for (const [intent, keywords] of Object.entries(keywordMap) as Array<
    [ChatIntentId, string[]]
  >) {
    for (const keyword of keywords) {
      if (normalizedMessage.includes(normalizeForIntent(keyword))) {
        scores[intent] += 2;
      }
    }
  }

  if (hasCode) {
    scores.cross_reference += 3;
    scores.application_check += 1;
  }

  if (asksCompatibilityDecision) {
    scores.application_check += 4;
    scores.cross_reference += hasCode ? 3 : 1;
  }

  if (
    hasAny(normalizedMessage, [
      "serve",
      "aplica",
      "aplicacao",
      "compativel",
      "encaixa",
    ])
  ) {
    scores.application_check += hasCode ? 4 : 2;
  }

  if (
    hasAny(normalizedMessage, [
      "anuncio",
      "anunci",
      "marketplace",
      "descricao",
      "titulo",
      "vender",
      "venda",
      "palavra chave",
      "palavras chave",
    ])
  ) {
    scores.marketplace_copy += salesCopyBoost;
  }

  if (vinPattern.test(input.message)) {
    scores.application_check += 3;
  }

  if (hasAttachment) {
    scores.document_analysis += hasAttachmentText ? 4 : 2;
  }

  if (input.preferences?.businessContext) {
    scores.purchase_checklist += normalizedMessage.includes("estoque") ? 1 : 0;
  }

  const winner = pickWinner(scores);
  const riskLevel = getRiskLevel(normalizedMessage, winner.intent);
  const missingCriticalData = getMissingCriticalData({
    intent: winner.intent,
    message: input.message,
    normalizedMessage,
    hasAttachment,
    hasAttachmentText,
    hasCode,
    riskLevel,
  });

  return buildClassification(winner.intent, winner.confidence, {
    missingCriticalData,
    riskLevel,
    shouldAskClarifyingQuestion:
      missingCriticalData.length > 0 &&
      (winner.confidence < 0.72 || riskLevel !== "normal"),
  });
}

function buildClassification(
  intent: ChatIntentId,
  confidence: number,
  overrides?: Partial<
    Pick<
      IntentClassification,
      "missingCriticalData" | "riskLevel" | "shouldAskClarifyingQuestion"
    >
  >,
): IntentClassification {
  const profile = intentProfiles[intent];
  const riskLevel = overrides?.riskLevel ?? "normal";

  return {
    id: intent,
    label: profile.label,
    confidence,
    responseShape: profile.responseShape,
    missingCriticalData: overrides?.missingCriticalData ?? [],
    shouldAskClarifyingQuestion:
      overrides?.shouldAskClarifyingQuestion ?? false,
    riskLevel,
    searchHint: profile.searchHint,
    activities: [
      "Classificando a intencao da pergunta",
      `Preparando resposta para ${profile.label}`,
    ],
  };
}

function isCasualConversation(input: {
  message: string;
  normalizedMessage: string;
  hasAttachment: boolean;
  hasCode: boolean;
}) {
  if (input.hasAttachment || input.hasCode) {
    return false;
  }

  const normalized = input.normalizedMessage
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = normalized ? normalized.split(" ") : [];

  if (words.length > 8) {
    return false;
  }

  const exactCasualMessages = new Set([
    "oi",
    "ola",
    "opa",
    "e ai",
    "salve",
    "fala",
    "bom dia",
    "boa tarde",
    "boa noite",
    "hello",
    "hey",
    "valeu",
    "obrigado",
    "obrigada",
    "brigado",
    "brigada",
    "show",
    "fechou",
    "perfeito",
    "top",
    "beleza",
    "blz",
    "suave",
  ]);

  if (exactCasualMessages.has(normalized)) {
    return true;
  }

  const startsWithGreeting = [
    "oi",
    "ola",
    "opa",
    "e ai",
    "salve",
    "fala",
    "bom dia",
    "boa tarde",
    "boa noite",
  ].some((phrase) => normalized.startsWith(phrase));
  const hasSocialFollowUp = [
    "tudo bem",
    "td bem",
    "tudo certo",
    "como vai",
    "como voce ta",
    "como voce esta",
    "ta por ai",
    "voce ta ai",
  ].some((phrase) => normalized.includes(phrase));

  if (startsWithGreeting && (words.length <= 4 || hasSocialFollowUp)) {
    return true;
  }

  const startsWithThanks = [
    "valeu",
    "obrigado",
    "obrigada",
    "brigado",
    "brigada",
    "show",
    "fechou",
    "perfeito",
  ].some((phrase) => normalized.startsWith(phrase));
  const hasClosingTone = [
    "era isso",
    "so isso",
    "por enquanto",
    "ate mais",
    "falou",
  ].some((phrase) => normalized.includes(phrase));

  if (startsWithThanks && (words.length <= 6 || hasClosingTone)) {
    return true;
  }

  return [
    "quem e voce",
    "quem eh voce",
    "o que voce faz",
    "voce ta ai",
    "ta online",
  ].some((phrase) => normalized === phrase || normalized.startsWith(`${phrase} `));
}

function buildInitialScores() {
  return Object.keys(intentProfiles).reduce(
    (acc, intent) => ({
      ...acc,
      [intent]: intent === "general_support" ? 1 : 0,
    }),
    {} as Record<ChatIntentId, number>,
  );
}

function pickWinner(scores: Record<ChatIntentId, number>) {
  const entries = Object.entries(scores) as Array<[ChatIntentId, number]>;
  const sorted = entries.sort((a, b) => b[1] - a[1]);
  const [intent, score] = sorted[0] ?? ["general_support", 1];
  const secondScore = sorted[1]?.[1] ?? 0;
  const confidence = Math.min(
    0.95,
    Math.max(0.42, 0.5 + (score - secondScore) * 0.08),
  );

  return { intent, confidence };
}

function getRiskLevel(
  normalizedMessage: string,
  intent: ChatIntentId,
): IntentRiskLevel {
  const hasHighRiskTerm = highRiskTerms.some((term) =>
    normalizedMessage.includes(normalizeForIntent(term)),
  );

  if (
    hasHighRiskTerm &&
    ["application_check", "cross_reference", "diagnosis"].includes(intent)
  ) {
    return "high_risk";
  }

  if (
    ["application_check", "cross_reference", "purchase_checklist"].includes(
      intent,
    )
  ) {
    return "needs_confirmation";
  }

  return "normal";
}

function getMissingCriticalData(input: {
  intent: ChatIntentId;
  message: string;
  normalizedMessage: string;
  hasAttachment: boolean;
  hasAttachmentText: boolean;
  hasCode: boolean;
  riskLevel: IntentRiskLevel;
}) {
  const hasVehicleData =
    hasAny(input.normalizedMessage, [
      "modelo",
      "ano",
      "motor",
      "chassi",
      "vin",
      "placa",
    ]) ||
    /\b(19|20)\d{2}\b/.test(input.message) ||
    /\b(volvo|scania|mercedes|mb|iveco|daf|vw|ford|man|sprinter|daily|cargo|constellation|atego|axor|accelo)\b/i.test(
      input.message,
    );
  const hasVehicleConfirmation =
    vinPattern.test(input.message) ||
    hasAny(input.normalizedMessage, ["motor", "chassi", "vin", "placa"]);
  const missing = new Set<string>();

  if (input.intent === "application_check") {
    if (!input.hasCode) {
      missing.add("codigo gravado na peca ou referencia do catalogo");
    }

    if (!hasVehicleData) {
      missing.add("ano/modelo/motor ou chassi/VIN do veiculo");
    } else if (!hasVehicleConfirmation) {
      missing.add("motor/versao ou chassi/VIN para confirmar aplicacao");
    }
  }

  if (input.intent === "cross_reference" && !input.hasCode) {
    missing.add("codigo original, OEM ou referencia da marca");
  }

  if (input.intent === "marketplace_copy") {
    if (!input.hasCode) {
      missing.add("codigo da peca");
    }

    if (
      !hasAny(input.normalizedMessage, [
        "nova",
        "usada",
        "recondicionada",
        "remanufaturada",
      ])
    ) {
      missing.add("estado da peca, marca e aplicacoes confirmadas");
    }
  }

  if (input.intent === "purchase_checklist") {
    if (!input.hasCode) {
      missing.add("codigo ou especificacao da peca que sera comprada");
    }

    missing.add("quantidade, prazo, marca aceita e criterio de garantia");
  }

  if (input.intent === "diagnosis") {
    if (!hasVehicleData) {
      missing.add("veiculo, ano, motor e condicao em que o sintoma aparece");
    }

    missing.add("historico do defeito, codigos de falha e testes ja feitos");
  }

  if (
    input.intent === "document_analysis" &&
    input.hasAttachment &&
    !input.hasAttachmentText
  ) {
    missing.add("texto legivel do arquivo ou foto com etiqueta/codigo em boa resolucao");
  }

  if (input.riskLevel === "high_risk") {
    missing.add("confirmacao por catalogo oficial, chassi/VIN ou fabricante");
  }

  return Array.from(missing).slice(0, 6);
}

function hasAny(normalizedMessage: string, terms: string[]) {
  return terms.some((term) =>
    normalizedMessage.includes(normalizeForIntent(term)),
  );
}

function normalizeForIntent(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
