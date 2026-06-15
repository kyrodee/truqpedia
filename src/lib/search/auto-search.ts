import type { IntentClassification, UploadedAttachment } from "@/lib/types";

export type SearchDecision = {
  enabled: boolean;
  reason: string;
  query: string;
  activities: string[];
};

const searchIntentPatterns = [
  /\b(aplica[cç][aã]o|serve|compat[ií]vel|equival[eê]ncia|equivalente)\b/i,
  /\b(c[oó]digo|refer[eê]ncia|part number|oem|sku)\b/i,
  /\b(cat[aá]logo|fabricante|manual|datasheet|ficha t[eé]cnica)\b/i,
  /\b(pre[cç]o|mercado|lan[cç]amento|atual|202[0-9]|novo)\b/i,
  /\b(an[uú]ncio|marketplace|palavra-chave|descri[cç][aã]o)\b/i,
];

const codeLikePattern = /\b[A-Z]{1,5}[-\s]?\d{3,}[A-Z0-9-]*\b/i;

export function decideWebSearch(input: {
  message: string;
  attachments: UploadedAttachment[];
  requested?: boolean | "auto";
  intent?: IntentClassification;
}): SearchDecision {
  const message = input.message.trim();

  if (input.requested === true) {
    return buildDecision(true, message, "Pesquisa solicitada pelo usuario.", input.intent);
  }

  if (input.requested === false) {
    return buildDecision(false, message, "Resposta com base no contexto informado.", input.intent);
  }

  const hasAttachmentText = input.attachments.some((attachment) => attachment.text);
  const intentSuggestsSearch =
    input.intent &&
    input.intent.confidence >= 0.58 &&
    ["application_check", "cross_reference", "purchase_checklist"].includes(
      input.intent.id,
    );
  const shouldSearch =
    codeLikePattern.test(message) ||
    intentSuggestsSearch ||
    searchIntentPatterns.some((pattern) => pattern.test(message));

  if (shouldSearch) {
    return buildDecision(
      true,
      message,
      hasAttachmentText
        ? "Ha anexos, mas a pergunta pede validacao externa."
        : "A pergunta pode depender de catalogo, codigo ou informacao atual.",
      input.intent,
    );
  }

  return buildDecision(
    false,
    message,
    hasAttachmentText
      ? "Usando os anexos e a conversa antes de buscar fora."
      : "A pergunta parece conceitual ou operacional.",
    input.intent,
  );
}

function buildDecision(
  enabled: boolean,
  message: string,
  reason: string,
  intent?: IntentClassification,
) {
  return {
    enabled,
    reason,
    query: enrichQuery(message, intent),
    activities: enabled
      ? [
          "Analisando a pergunta",
          "Identificando codigos, aplicacao e dados criticos",
          "Pesquisando referencias publicas",
          "Conferindo fontes antes de responder",
        ]
      : [
          "Analisando a pergunta",
          "Organizando a resposta tecnica",
          "Separando riscos, dados faltantes e proximo passo",
        ],
  };
}

function enrichQuery(message: string, intent?: IntentClassification) {
  return [
    message,
    intent?.searchHint,
    "autopecas caminhao onibus peca pesada catalogo aplicacao equivalencia",
  ]
    .filter(Boolean)
    .join(" ");
}
