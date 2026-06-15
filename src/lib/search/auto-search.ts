import type { UploadedAttachment } from "@/lib/types";

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
}): SearchDecision {
  const message = input.message.trim();

  if (input.requested === true) {
    return buildDecision(true, message, "Pesquisa solicitada pelo usuário.");
  }

  if (input.requested === false) {
    return buildDecision(false, message, "Resposta com base no contexto informado.");
  }

  const hasAttachmentText = input.attachments.some((attachment) => attachment.text);
  const shouldSearch =
    codeLikePattern.test(message) ||
    searchIntentPatterns.some((pattern) => pattern.test(message));

  if (shouldSearch) {
    return buildDecision(
      true,
      message,
      hasAttachmentText
        ? "Há anexos, mas a pergunta pede validação externa."
        : "A pergunta pode depender de catálogo, código ou informação atual.",
    );
  }

  return buildDecision(
    false,
    message,
    hasAttachmentText
      ? "Usando os anexos e a conversa antes de buscar fora."
      : "A pergunta parece conceitual ou operacional.",
  );
}

function buildDecision(enabled: boolean, message: string, reason: string) {
  return {
    enabled,
    reason,
    query: enrichQuery(message),
    activities: enabled
      ? [
          "Analisando a pergunta",
          "Identificando códigos, aplicação e dados críticos",
          "Pesquisando referências públicas",
          "Conferindo fontes antes de responder",
        ]
      : [
          "Analisando a pergunta",
          "Organizando a resposta técnica",
          "Separando riscos, dados faltantes e próximo passo",
        ],
  };
}

function enrichQuery(message: string) {
  return `${message} autopeças caminhão ônibus peça pesada catálogo aplicação equivalência`;
}

