import {
  DEFAULT_CHAT_MODE,
  DEFAULT_DEEP_MODEL,
  DEFAULT_SPEED_MODEL,
  SYSTEM_PROMPT,
} from "@/lib/constants";
import { createProviders } from "@/lib/ai/providers";
import { ProviderError } from "@/lib/ai/streaming";
import type { ProviderMessage } from "@/lib/ai/types";
import { recordProviderMetric } from "@/lib/usage/metrics";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { memoryToPrompt } from "@/lib/ai/memory";
import type {
  ChatMessage,
  ChatMode,
  ConversationMemory,
  IntentClassification,
  ProviderId,
  ProviderRuntimeConfig,
  SourceResult,
  StreamEvent,
  AssistantPreferences,
  UploadedAttachment,
} from "@/lib/types";

const DEFAULT_PROVIDER_CONFIGS: ProviderRuntimeConfig[] = [
  {
    id: "groq",
    name: "Groq",
    enabled: true,
    priority: 10,
    speedModel: DEFAULT_SPEED_MODEL.groq,
    deepModel: DEFAULT_DEEP_MODEL.groq,
    timeoutMs: 20000,
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    enabled: true,
    priority: 20,
    speedModel: DEFAULT_SPEED_MODEL.openrouter,
    deepModel: DEFAULT_DEEP_MODEL.openrouter,
    timeoutMs: 25000,
  },
  {
    id: "gemini",
    name: "Gemini",
    enabled: true,
    priority: 30,
    speedModel: DEFAULT_SPEED_MODEL.gemini,
    deepModel: DEFAULT_DEEP_MODEL.gemini,
    timeoutMs: 25000,
  },
  {
    id: "cohere",
    name: "Cohere",
    enabled: true,
    priority: 40,
    speedModel: DEFAULT_SPEED_MODEL.cohere,
    deepModel: DEFAULT_DEEP_MODEL.cohere,
    timeoutMs: 25000,
  },
  {
    id: "grok",
    name: "Grok / xAI",
    enabled: true,
    priority: 50,
    speedModel: DEFAULT_SPEED_MODEL.grok,
    deepModel: DEFAULT_DEEP_MODEL.grok,
    timeoutMs: 30000,
  },
];

export async function loadProviderConfigs(): Promise<ProviderRuntimeConfig[]> {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return DEFAULT_PROVIDER_CONFIGS;
  }

  const { data, error } = await supabase
    .from("ai_provider_settings")
    .select("*")
    .order("priority", { ascending: true });

  if (error || !data || data.length === 0) {
    return DEFAULT_PROVIDER_CONFIGS;
  }

  return data.map((row) => {
    const typed = row as {
      id: ProviderId;
      display_name: string;
      enabled: boolean;
      priority: number;
      speed_model: string;
      deep_model: string;
      base_url: string | null;
      timeout_ms: number;
    };

    return {
      id: typed.id,
      name: typed.display_name,
      enabled: typed.enabled,
      priority: typed.priority,
      speedModel: typed.speed_model,
      deepModel: typed.deep_model,
      baseUrl: typed.base_url ?? undefined,
      timeoutMs: typed.timeout_ms,
    };
  });
}

export function buildProviderMessages(input: {
  history: ChatMessage[];
  userMessage: string;
  sources: SourceResult[];
  attachments?: UploadedAttachment[];
  preferences?: AssistantPreferences;
  intent?: IntentClassification;
  memory?: ConversationMemory | null;
}) {
  const searchContext =
    input.sources.length > 0
      ? `\n\nFontes recentes consultadas:\n${input.sources
          .map(
            (source, index) =>
              `[${index + 1}] ${source.title}\nURL: ${source.url}\nResumo: ${source.snippet}`,
          )
          .join("\n\n")}\n\nUse marcadores de citacao no corpo da resposta, como [1] ou [2], sempre que uma afirmacao vier dessas fontes. Nao crie uma secao longa de links no final: a interface ja mostra as fontes consultadas de forma discreta. Nao invente fontes nem atribua uma fonte a uma afirmacao que ela nao sustenta.`
      : "";
  const preferenceContext = buildPreferenceContext(input.preferences);
  const intentContext = buildIntentContext(input.intent);
  const memoryContext = memoryToPrompt(input.memory);

  const messages: ProviderMessage[] = [
    {
      role: "system",
      content: `${SYSTEM_PROMPT}${preferenceContext}${memoryContext}${intentContext}${searchContext}`,
    },
    ...input.history
      .filter((message) => message.role !== "system")
      .slice(-20)
      .map((message) => ({
        role: message.role,
        content: message.content,
      })),
    {
      role: "user",
      content: appendAttachmentContext(input.userMessage, input.attachments ?? []),
    },
  ];

  return messages;
}

function buildIntentContext(intent: IntentClassification | undefined) {
  if (!intent) {
    return "";
  }

  const missingData = intent.missingCriticalData.length
    ? `\nDados criticos faltantes ou a confirmar: ${intent.missingCriticalData.join("; ")}.`
    : "";
  const clarifyInstruction = intent.shouldAskClarifyingQuestion
    ? "\nSe a resposta depender desses dados, responda o que for possivel agora e termine com poucas perguntas objetivas para destravar a decisao."
    : "";

  return `\n\nClassificacao operacional da pergunta:
- Intencao: ${intent.label} (${intent.id}), confianca ${Math.round(intent.confidence * 100)}%.
- Risco: ${intent.riskLevel}.
- Estrutura preferida: ${intent.responseShape.join(" -> ")}.${missingData}${clarifyInstruction}
Use essa classificacao para priorizar o formato da resposta, mas ajuste se a conversa mostrar que a intencao real e outra.`;
}

function buildPreferenceContext(preferences: AssistantPreferences | undefined) {
  if (!preferences) {
    return "";
  }

  const lines = [
    preferences.displayName
      ? `- Nome do usuario: ${preferences.displayName}`
      : null,
    preferences.referenceStyle
      ? `- Como se referir ao usuario: ${preferences.referenceStyle}`
      : null,
    preferences.behavior
      ? `- Como o usuario prefere que voce aja: ${preferences.behavior}`
      : null,
    preferences.responseStyle
      ? `- Estilo de resposta preferido: ${preferences.responseStyle}`
      : null,
    preferences.businessContext
      ? `- Contexto da operacao do usuario: ${preferences.businessContext}`
      : null,
    preferences.customInstructions
      ? `- Observacoes adicionais do usuario: ${preferences.customInstructions}`
      : null,
  ].filter(Boolean);

  if (lines.length === 0) {
    return "";
  }

  return `\n\nPreferencias do usuario para personalizar a conversa. Elas sao secundarias: nunca substituem as regras tecnicas, de seguranca, cautela por catalogo/chassi/fabricante nem as instrucoes principais do Truqpedia.\n${lines.join("\n")}`;
}

function appendAttachmentContext(
  userMessage: string,
  attachments: UploadedAttachment[],
) {
  if (attachments.length === 0) {
    return userMessage;
  }

  const context = attachments
    .map((attachment, index) => {
      const header = `Arquivo ${index + 1}: ${attachment.name} (${attachment.type || "tipo desconhecido"}, ${attachment.size} bytes)`;

      if (!attachment.text) {
        return `${header}\nConteudo textual nao extraido automaticamente. Nao finja ter lido o arquivo. Use apenas nome, tipo e tamanho como pistas e peca uma versao legivel, transcricao, foto melhor ou dados especificos se isso for necessario.`;
      }

      return `${header}${attachment.truncated ? "\nConteudo truncado para caber no contexto." : ""}\n\n${attachment.text}`;
    })
    .join("\n\n---\n\n");

  return `${userMessage}\n\nArquivos anexados para analise. Quando usar informacao de arquivo, deixe claro que ela veio do anexo. Se uma conclusao vier de conhecimento geral ou fonte externa, diferencie isso do que o arquivo realmente sustenta.\n\n${context}`;
}

export async function* streamWithFallback(input: {
  mode: ChatMode;
  messages: ProviderMessage[];
  sources: SourceResult[];
  userId?: string | null;
  conversationId?: string | null;
  abortSignal?: AbortSignal;
}): AsyncGenerator<StreamEvent> {
  const providers = createProviders();
  const configs = (await loadProviderConfigs())
    .filter((config) => config.enabled)
    .sort((a, b) => a.priority - b.priority);

  const errors: string[] = [];

  for (const config of configs) {
    const provider = providers.find((candidate) => candidate.id === config.id);

    if (!provider || !provider.isConfigured()) {
      continue;
    }

    const startedAt = Date.now();
    const effectiveMode = DEFAULT_CHAT_MODE;
    let model = config.deepModel;
    let assembled = "";
    let emittedAnyToken = false;

    try {
      const result = await provider.stream({
        mode: effectiveMode,
        messages: input.messages,
        sources: input.sources,
        config,
        abortSignal: input.abortSignal,
      });

      model = result.model;
      yield { type: "provider", provider: result.providerId, model };

      for await (const token of result.tokens) {
        emittedAnyToken = true;
        assembled += token;
        yield { type: "token", token };
      }

      await recordProviderMetric({
        providerId: provider.id,
        model,
        mode: effectiveMode,
        latencyMs: Date.now() - startedAt,
        success: true,
        userId: input.userId,
        conversationId: input.conversationId,
        tokensIn: estimateTokens(input.messages.map((message) => message.content).join(" ")),
        tokensOut: estimateTokens(assembled),
      });

      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      const retryable =
        error instanceof ProviderError ? error.retryable : !emittedAnyToken;

      errors.push(`${provider.displayName}: ${message}`);

      await recordProviderMetric({
        providerId: provider.id,
        model,
        mode: effectiveMode,
        latencyMs: Date.now() - startedAt,
        success: false,
        errorMessage: message,
        userId: input.userId,
        conversationId: input.conversationId,
      });

      if (!retryable || emittedAnyToken) {
        throw error;
      }
    }
  }

  const configuredProviders = configs.filter((config) =>
    providers.find(
      (provider) => provider.id === config.id && provider.isConfigured(),
    ),
  );

  if (configuredProviders.length === 0) {
    yield {
      type: "error",
      message:
        "Nenhum provedor de IA esta configurado. Defina pelo menos uma chave em .env.local para GROQ_API_KEY, OPENROUTER_API_KEY, GEMINI_API_KEY, COHERE_API_KEY ou XAI_API_KEY.",
    };
    return;
  }

  yield {
    type: "error",
    message: `Todos os provedores configurados falharam. Ultimos erros: ${errors.join(" | ")}`,
  };
}

function estimateTokens(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}
