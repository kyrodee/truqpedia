import {
  DEFAULT_DEEP_MODEL,
  DEFAULT_SPEED_MODEL,
  GROQ_PRIMARY_MODEL,
} from "@/lib/constants";
import { createProviders } from "@/lib/ai/providers";
import { ProviderError } from "@/lib/ai/streaming";
import type { ProviderMessage } from "@/lib/ai/types";
import { recordProviderMetric } from "@/lib/usage/metrics";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { memoryToPrompt } from "@/lib/ai/memory";
import { buildSystemPrompt } from "@/lib/ai/prompts";
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

  const rows = data.filter((row) => row.id === "groq");

  if (rows.length === 0) {
    return DEFAULT_PROVIDER_CONFIGS;
  }

  return rows.slice(0, 1).map((row) => {
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
      id: "groq" as const,
      name: typed.display_name || "Groq",
      enabled: typed.enabled,
      priority: 10,
      speedModel: GROQ_PRIMARY_MODEL,
      deepModel: GROQ_PRIMARY_MODEL,
      speedModelFallbacks: [],
      deepModelFallbacks: [],
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
  searchAttempt?: {
    enabled: boolean;
    query: string;
    sourceCount: number;
  };
}) {
  const searchContext =
    input.sources.length > 0
      ? `\n\nFontes recentes consultadas:\n${input.sources
          .map(
            (source, index) =>
              `[${index + 1}] ${source.title}\nURL: ${source.url}\nScore: ${source.score ?? "n/a"}\nMetadados: ${formatSourceMetadata(source.metadata)}\nResumo: ${source.snippet}`,
          )
          .join("\n\n")}\n\nUse marcadores de citacao no corpo da resposta, como [1] ou [2], sempre que uma afirmacao vier dessas fontes. Nao crie uma secao longa de links no final: a interface ja mostra as fontes consultadas de forma discreta. Nao invente fontes nem atribua uma fonte a uma afirmacao que ela nao sustenta. Para codigo/referencia: se a fonte nao mencionar explicitamente o codigo pesquisado, nao trate como confirmacao da peca; no maximo cite como catalogo/local onde consultar.`
      : "";
  const preferenceContext = buildPreferenceContext(input.preferences);
  const intentContext = buildIntentContext(input.intent);
  const memoryContext = memoryToPrompt(input.memory);
  const searchAttemptContext = buildSearchAttemptContext(input.searchAttempt);

  const messages: ProviderMessage[] = [
    {
      role: "system",
      content: `${buildSystemPrompt(input.intent)}${preferenceContext}${memoryContext}${intentContext}${searchContext}${searchAttemptContext}`,
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
      content: appendTaskContext(
        appendAttachmentContext(input.userMessage, input.attachments ?? []),
        input.intent,
      ),
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
  const guardrails = buildIntentGuardrails(intent);

  return `\n\nClassificacao operacional da pergunta:
- Intencao: ${intent.label} (${intent.id}), confianca ${Math.round(intent.confidence * 100)}%.
- Risco: ${intent.riskLevel}.
- Estrutura preferida: ${intent.responseShape.join(" -> ")}.${missingData}${clarifyInstruction}
${guardrails}
Use essa classificacao para priorizar o formato da resposta, mas ajuste se a conversa mostrar que a intencao real e outra.`;
}

function formatSourceMetadata(
  metadata: SourceResult["metadata"] | undefined,
) {
  if (!metadata || Object.keys(metadata).length === 0) {
    return "n/a";
  }

  return Object.entries(metadata)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([key, value]) => `${key}=${value}`)
    .join(", ");
}

function buildIntentGuardrails(intent: IntentClassification) {
  if (intent.id === "casual_conversation") {
    return `\nRegra especifica para conversa casual:
- Responda como uma pessoa atenciosa e presente, em 1 a 3 linhas.
- Nao use cabecalhos, listas, tabela, formato tecnico ou "Resposta curta e direta".
- Pode ter personalidade leve, mas sem emoji e sem exagero.
- Se for apenas um cumprimento, cumprimente de volta e convide o usuario a mandar o que precisa.
- Se for apenas agradecimento ou encerramento ("valeu", "obrigado", "show", "fechou"), reconheca de forma natural e curta. Nao pergunte "como posso ajudar" nesses casos.`;
  }

  if (intent.id === "marketplace_copy") {
    return `\nRegras especificas para texto de venda:
- Use somente fatos informados pelo usuario, anexos ou fontes. Nao invente origem da peca, retirada de veiculo, fotos, garantia, nota fiscal, entrega, prazo, estoque, teste feito, condicao visual ou compatibilidade confirmada.
- Se algo foi informado mas nao comprovado, escreva de forma prudente: "codigo informado", "original informado" ou "aplicacao anotada/possivel".
- Troque promessas por cautela objetiva: "compatibilidade a confirmar pelo codigo, catalogo ou chassi/VIN".
- No bloco "Confirmar antes da compra", liste apenas itens que precisam ser confirmados. Nunca escreva "compatibilidade confirmada".
- Entregue o anuncio compacto e pronto para colar. Evite observacoes longas depois do texto pronto.`;
  }

  if (intent.id === "cross_reference") {
    return `\nRegra especifica para referencia/codigo isolado:
- Se o usuario so tiver uma referencia, nao fique repetindo perguntas genericas. Use a referencia como ponto de partida e seja pratico.
- Priorize: o que a referencia parece ser, fontes/indicios encontrados, nivel de confianca, e proximo passo direto.
- Se nao houver fonte confiavel, diga isso claramente e sugira acoes concretas: pesquisar em catalogo do fabricante, fornecedor, etiqueta/foto, ou cruzamento por marca.`;
  }

  if (intent.id === "diagnosis" && intent.riskLevel === "high_risk") {
    return `\nRegra especifica para diagnostico de alto risco: deixe claro quando nao e seguro seguir rodando, especialmente em freio, direcao, suspensao, pneu, eixo ou motor.`;
  }

  return "";
}

function buildSearchAttemptContext(
  searchAttempt:
    | {
        enabled: boolean;
        query: string;
        sourceCount: number;
      }
    | undefined,
) {
  if (!searchAttempt?.enabled) {
    return "";
  }

  if (searchAttempt.sourceCount > 0) {
    return `\n\nBusca externa executada para: "${searchAttempt.query}". Foram encontradas ${searchAttempt.sourceCount} fontes. Use apenas o que as fontes sustentam. Se a busca era por referencia/codigo, responda de forma objetiva: o que a referencia parece ser, nivel de confianca, por que ainda precisa confirmar, e um proximo passo direto. Evite terminar com pergunta aberta generica.`;
  }

  return `\n\nBusca externa executada para: "${searchAttempt.query}", mas nenhuma fonte confiavel foi encontrada. Nao diga que encontrou resultados. Seja pratico e curto: diga que nao achou fonte publica confiavel para a referencia, entregue 3 proximos passos concretos e, se fizer sentido, uma mensagem pronta para enviar ao fornecedor. Nao termine com perguntas abertas nem repita uma lista longa de dados faltantes.`;
}

function appendTaskContext(
  userMessage: string,
  intent: IntentClassification | undefined,
) {
  if (intent?.id === "casual_conversation") {
    return `${userMessage}

Restricao obrigatoria para esta resposta casual:
- Responda em no maximo 3 linhas.
- Nao use formato tecnico, lista, tabela, markdown pesado ou secoes.
- Se for cumprimento, cumprimente de volta e se coloque disponivel.
- Se for agradecimento/encerramento como "valeu", "obrigado", "show" ou "fechou", responda naturalmente em 1 frase e nao pergunte "como posso ajudar".
- So puxe o assunto tecnico se o usuario pedir; por enquanto converse normal.`;
  }

  if (intent?.id !== "marketplace_copy") {
    return userMessage;
  }

  return `${userMessage}

Restricao obrigatoria para esta resposta de venda:
- Entregue somente o texto pronto em formato compacto: Titulo, Descricao, Aplicacao/compatibilidade, Confirmar antes da compra e Palavras-chave.
- O anuncio sera considerado errado se afirmar qualquer dado nao informado pelo usuario, anexo ou fonte.
- Nao use estas ideias/frases a menos que estejam explicitamente no pedido ou anexo: "boas condicoes", "sem danos visiveis", "retirado de veiculo", "testado", "garantia", "nota fiscal", "entrega", "ver fotos", "pronta entrega", "compativel confirmado".
- No bloco "Confirmar antes da compra", escreva so os itens pendentes, como "compatibilidade", "estado visual" ou "origem". Nao escreva "compatibilidade confirmada".
- Para estado visual, garantia, origem, entrega e compatibilidade, use "a confirmar" quando faltar dado.`;
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
        return `${header}\nConteudo textual nao extraido automaticamente. Nao finja ter lido o arquivo. Use apenas nome, tipo e tamanho como pistas. Se precisar do conteudo, peca de forma curta uma transcricao do codigo/etiqueta ou uma foto mais legivel, sem fazer uma lista longa de perguntas.`;
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
  intent?: IntentClassification;
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

    const effectiveMode = "deep" as const;
    const generationProfile = selectGenerationProfile({
      intent: input.intent,
      sourceCount: input.sources.length,
    });
    const modelCandidates = [generationProfile.model];

    for (const modelCandidate of modelCandidates) {
      const startedAt = Date.now();
      const attemptConfig = {
        ...config,
        speedModel: modelCandidate,
        deepModel: modelCandidate,
      };
      let assembled = "";
      let emittedAnyToken = false;

      try {
        const result = await provider.stream({
          mode: effectiveMode,
          messages: input.messages,
          sources: input.sources,
          config: attemptConfig,
          model: modelCandidate,
          temperature: generationProfile.temperature,
          abortSignal: input.abortSignal,
        });

        yield { type: "provider", provider: result.providerId, model: result.model };

        for await (const token of result.tokens) {
          emittedAnyToken = true;
          assembled += token;
          yield { type: "token", token };
        }

        await recordProviderMetric({
          providerId: provider.id,
          model: result.model,
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

        errors.push(`${provider.displayName} (${modelCandidate}): ${message}`);

        await recordProviderMetric({
          providerId: provider.id,
          model: modelCandidate,
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
        "Nenhum provedor de IA esta configurado. Defina GROQ_API_KEY em .env.local para usar o modelo openai/gpt-oss-120b no Groq.",
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

export function selectGenerationProfile(input: {
  intent?: IntentClassification;
  sourceCount?: number;
}) {
  const id = input.intent?.id;
  const hasSources = (input.sourceCount ?? 0) > 0;

  if (id === "casual_conversation") {
    return {
      model: GROQ_PRIMARY_MODEL,
      temperature: 0.35,
      strategy: "short_conversation",
    } as const;
  }

  if (
    id === "application_check" ||
    id === "cross_reference" ||
    id === "diagnosis" ||
    hasSources
  ) {
    return {
      model: GROQ_PRIMARY_MODEL,
      temperature: 0.18,
      strategy: "grounded_technical",
    } as const;
  }

  if (id === "marketplace_copy") {
    return {
      model: GROQ_PRIMARY_MODEL,
      temperature: 0.28,
      strategy: "controlled_copywriting",
    } as const;
  }

  return {
    model: GROQ_PRIMARY_MODEL,
    temperature: 0.24,
    strategy: "balanced_support",
  } as const;
}
