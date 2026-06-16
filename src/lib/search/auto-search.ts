import type {
  ChatMessage,
  IntentClassification,
  UploadedAttachment,
} from "@/lib/types";

export type SearchDecision = {
  enabled: boolean;
  reason: string;
  query: string;
  activities: string[];
};

const searchIntentPatterns = [
  /\b(aplicacao|serve|compativel|equivalencia|equivalente)\b/i,
  /\b(codigo|referencia|part number|oem|sku)\b/i,
  /\b(catalogo|fabricante|manual|datasheet|ficha tecnica)\b/i,
  /\b(preco|mercado|lancamento|atual|202[0-9]|novo)\b/i,
  /\b(anuncio|marketplace|palavra-chave|descricao)\b/i,
];

const codeLikePattern = /\b[A-Z]{1,5}[-\s]?\d{3,}[A-Z0-9-]*\b/i;
const numericReferencePattern = /\b\d{6,14}\b/;
const explicitSearchPattern =
  /\b(busca|buscar|pesquisa|pesquisar|procura|procurar|consulta|consultar|acha|achar|encontra|encontrar|internet|google)\b/i;

export function decideWebSearch(input: {
  message: string;
  attachments: UploadedAttachment[];
  requested?: boolean | "auto";
  intent?: IntentClassification;
  history?: ChatMessage[];
}): SearchDecision {
  const message = input.message.trim();
  const contextReference = extractLastReference(input.history ?? []);
  const userExplicitlyAskedSearch = explicitSearchPattern.test(message);
  const useContextReferenceAsPrimaryQuery =
    userExplicitlyAskedSearch && contextReference && !hasReference(message);
  const queryBase = useContextReferenceAsPrimaryQuery
    ? contextReference
    : hasReference(message) || !contextReference
      ? message
      : `${contextReference} ${message}`;

  if (input.intent?.id === "casual_conversation") {
    return {
      enabled: false,
      reason: "Conversa casual; sem necessidade de pesquisa externa.",
      query: message,
      activities: ["Lendo o tom da conversa", "Respondendo de forma breve"],
    };
  }

  if (input.requested === true) {
    return buildDecision(
      true,
      queryBase,
      "Pesquisa solicitada pelo usuario.",
      input.intent,
    );
  }

  if (input.requested === false) {
    return buildDecision(
      false,
      queryBase,
      "Resposta com base no contexto informado.",
      input.intent,
    );
  }

  const hasAttachmentText = input.attachments.some((attachment) => attachment.text);
  const intentSuggestsSearch =
    input.intent &&
    input.intent.confidence >= 0.58 &&
    ["application_check", "cross_reference", "purchase_checklist"].includes(
      input.intent.id,
    );
  const shouldSearch =
    hasReference(message) ||
    (userExplicitlyAskedSearch && Boolean(contextReference)) ||
    intentSuggestsSearch ||
    userExplicitlyAskedSearch ||
    searchIntentPatterns.some((pattern) => pattern.test(normalize(message)));

  if (shouldSearch) {
    return buildDecision(
      true,
      queryBase,
      userExplicitlyAskedSearch && contextReference && !hasReference(message)
        ? `Pesquisa solicitada usando a ultima referencia citada: ${contextReference}.`
        : hasAttachmentText
          ? "Ha anexos, mas a pergunta pede validacao externa."
          : "A pergunta pode depender de catalogo, codigo ou informacao atual.",
      input.intent,
    );
  }

  return buildDecision(
    false,
    queryBase,
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
  if (isReferenceOnlyQuery(message)) {
    return message.trim();
  }

  return [
    message,
    intent?.searchHint,
    "autopecas caminhao onibus peca pesada catalogo aplicacao equivalencia codigo referencia",
  ]
    .filter(Boolean)
    .join(" ");
}

function hasReference(message: string) {
  return codeLikePattern.test(message) || numericReferencePattern.test(message);
}

function isReferenceOnlyQuery(message: string) {
  const trimmed = message.trim();

  return (
    trimmed.length > 0 &&
    hasReference(trimmed) &&
    trimmed.replace(/\b(?:[A-Z]{1,5}[-\s]?\d{3,}[A-Z0-9-]*|\d{6,14})\b/gi, "").trim()
      .length === 0
  );
}

function extractLastReference(history: ChatMessage[]) {
  for (const message of history.slice(-10).reverse()) {
    const numericReferences = message.content.match(/\b\d{6,14}\b/g);

    if (numericReferences?.length) {
      return numericReferences.at(-1)?.trim() ?? null;
    }

    const codeReferences = message.content.match(
      /\b[A-Z]{1,4}[-\s]?\d{3,}[A-Z0-9-]*\b/gi,
    );

    if (codeReferences?.length) {
      return codeReferences.at(-1)?.replace(/\s+/g, "").trim() ?? null;
    }
  }

  return null;
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
