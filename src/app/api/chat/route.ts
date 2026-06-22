import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { DEFAULT_CHAT_MODE, FREE_MESSAGE_LIMIT } from "@/lib/constants";
import { buildProviderMessages, streamWithFallback } from "@/lib/ai/model-router";
import { classifyChatIntentWithAi } from "@/lib/ai/intent";
import {
  buildConversationMemory,
  persistConversationMemory,
  readConversationMemory,
} from "@/lib/ai/memory";
import { searchProjectKnowledge } from "@/lib/ai/rag-search";
import { logError, logInfo } from "@/lib/logger";
import { searchWeb } from "@/lib/search/web-search";
import { decideWebSearch } from "@/lib/search/auto-search";
import {
  CHAT_RATE_LIMIT_REQUESTS,
  CHAT_RATE_LIMIT_WINDOW_MS,
  MAX_CHAT_PAYLOAD_BYTES,
} from "@/lib/server-config";
import {
  isProjectCollection,
  projectMetadataWithConversation,
} from "@/lib/projects";
import { getClientIp, checkRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { readJsonBody } from "@/lib/request";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import type {
  ChatMessage,
  IntentClassification,
  SourceResult,
  StreamEvent,
} from "@/lib/types";
import { recordUsageLog, recordWebSearchLog } from "@/lib/usage/metrics";
import { toSse, truncate } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const chatSchema = z.object({
  conversationId: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  message: z.string().min(1).max(8000),
  mode: z.enum(["speed", "deep"]).default(DEFAULT_CHAT_MODE),
  webSearch: z.union([z.boolean(), z.literal("auto")]).optional().default("auto"),
  clientMessages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string(),
      }),
    )
    .optional()
    .default([]),
  attachments: z
    .array(
      z.object({
        name: z.string().min(1).max(240),
        type: z.string().max(160).default(""),
        size: z.number().int().nonnegative().max(15 * 1024 * 1024),
        text: z.string().max(60000).optional(),
        truncated: z.boolean().optional(),
      }),
    )
    .max(8)
    .optional()
    .default([]),
  preferences: z
    .object({
      displayName: z.string().max(80).optional(),
      referenceStyle: z.string().max(120).optional(),
      behavior: z.string().max(700).optional(),
      responseStyle: z.string().max(240).optional(),
      businessContext: z.string().max(500).optional(),
      customInstructions: z.string().max(700).optional(),
    })
    .optional(),
});

const guestCookieName = "truqpedia_guest_count";

export async function POST(request: NextRequest) {
  const jsonBody = await readJsonBody(request, MAX_CHAT_PAYLOAD_BYTES);

  if (!jsonBody.ok) {
    return jsonBody.response;
  }

  const parsed = chatSchema.safeParse(jsonBody.data);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Mensagem invalida.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const body = { ...parsed.data, mode: DEFAULT_CHAT_MODE };
  const intent = await classifyChatIntentWithAi({
    message: body.message,
    attachments: body.attachments,
    preferences: body.preferences,
  }, { abortSignal: request.signal });
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = supabase
    ? await supabase.auth.getUser()
    : { data: { user: null } };

  const rateLimit = checkRateLimit({
    key: `chat:${user?.id ?? getClientIp(request)}`,
    limit: CHAT_RATE_LIMIT_REQUESTS,
    windowMs: CHAT_RATE_LIMIT_WINDOW_MS,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Muitas solicitações. Tente novamente em instantes." },
      { status: 429, headers: rateLimitHeaders(rateLimit) },
    );
  }

  const cookieStore = await cookies();
  const guestCount = parseGuestCount(cookieStore.get(guestCookieName)?.value);

  if (!user && guestCount >= FREE_MESSAGE_LIMIT) {
    return NextResponse.json(
      {
        code: "FREE_LIMIT_REACHED",
        error: "Limite gratuito atingido. Crie uma conta para continuar.",
        limit: FREE_MESSAGE_LIMIT,
      },
      { status: 402 },
    );
  }

  const encoder = new TextEncoder();
  const headers = new Headers({
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  if (!user) {
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    headers.append(
      "Set-Cookie",
      `${guestCookieName}=${guestCount + 1}; Path=/; Max-Age=2592000; SameSite=Lax${secure}`,
    );
  }

  let conversationId = body.conversationId ?? null;
  let conversationTitle: string | undefined;
  let persistedUserMessage = false;
  let history: ChatMessage[] = body.clientMessages.slice(-20);
  let project: { id: string; metadata: Json } | null = null;
  let conversationMemory: Awaited<
    ReturnType<typeof readConversationMemory>
  > = null;

  if (user && supabase) {
    if (body.projectId) {
      const { data: projectData, error: projectError } = await supabase
        .from("knowledge_collections")
        .select("id,metadata")
        .eq("id", body.projectId)
        .eq("owner_user_id", user.id)
        .maybeSingle();

      if (projectError || !projectData || !isProjectCollection(projectData)) {
        return NextResponse.json(
          { error: "Projeto nao encontrado." },
          { status: 404 },
        );
      }

      project = projectData;
    }

    if (conversationId) {
      const { data: existing, error } = await supabase
        .from("conversations")
        .select("id,title")
        .eq("id", conversationId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (error || !existing) {
        return NextResponse.json(
          { error: "Conversa nao encontrada." },
          { status: 404 },
        );
      }
    } else {
      conversationTitle = generateConversationTitle(body.message);
      const { data: created, error } = await supabase
        .from("conversations")
        .insert({
          user_id: user.id,
          title: conversationTitle,
          mode: body.mode,
        })
        .select("id,title")
        .single();

      if (error || !created) {
        return NextResponse.json(
          { error: "Nao foi possivel criar a conversa." },
          { status: 500 },
        );
      }

      conversationId = created.id;
      conversationTitle = created.title;

      if (project) {
        await supabase
          .from("knowledge_collections")
          .update({
            metadata: projectMetadataWithConversation(
              project.metadata,
              created.id,
            ),
            updated_at: new Date().toISOString(),
          })
          .eq("id", project.id)
          .eq("owner_user_id", user.id);
      }
    }

    const ownedConversationId = conversationId;

    if (!ownedConversationId) {
      return NextResponse.json(
        { error: "Conversa invalida." },
        { status: 500 },
      );
    }

    const { data: previousMessages } = await supabase
      .from("messages")
      .select("role,content,created_at")
      .eq("conversation_id", ownedConversationId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(30);

    conversationMemory = await readConversationMemory({
      supabase,
      conversationId: ownedConversationId,
      userId: user.id,
    });

    history =
      previousMessages
        ?.filter((message) => message.role !== "system")
        .map((message) => ({
          role: message.role,
          content: message.content,
          createdAt: message.created_at,
        })) ?? [];

    const { error: messageError } = await supabase.from("messages").insert({
      conversation_id: ownedConversationId,
      user_id: user.id,
      role: "user",
      content: body.message,
      metadata: {
        web_search_requested: body.webSearch,
        attachments: summarizeAttachments(body.attachments),
        assistant_preferences: body.preferences,
        intent: serializeIntent(intent),
      },
    });

    persistedUserMessage = !messageError;

    await supabase
      .from("conversations")
      .update({ mode: body.mode, updated_at: new Date().toISOString() })
      .eq("id", ownedConversationId)
      .eq("user_id", user.id);
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let assistantContent = "";
      let providerId: string | null = null;
      let model: string | null = null;
      let sources: SourceResult[] = [];
      const startedAt = Date.now();
      const searchDecision = decideWebSearch({
        message: body.message,
        attachments: body.attachments,
        requested: body.webSearch,
        intent,
        history,
      });

      const send = (event: StreamEvent) => {
        controller.enqueue(encoder.encode(toSse(event)));
      };

      try {
        if (conversationId) {
          send({
            type: "conversation",
            conversationId,
            title: conversationTitle,
          });
        }

        const intentActivities = searchDecision.reason.includes(
          "ultima referencia",
        )
          ? [
              "Classificando a intencao da pergunta",
              "Preparando busca pela referencia citada",
            ]
          : intent.activities;
        const initialActivities = [
          ...intentActivities,
          ...searchDecision.activities,
        ].filter(uniqueLabels);

        for (const label of initialActivities.slice(0, 4)) {
          send({ type: "activity", label });
        }

        if (searchDecision.enabled) {
          send({
            type: "activity",
            label: "Pesquisando",
            detail: searchDecision.reason,
          });
          sources = await searchWeb(searchDecision.query);
          await recordWebSearchLog({
            userId: user?.id,
            conversationId,
            query: searchDecision.query,
            sources,
          });
          send({
            type: "activity",
            label: sources.length
              ? `Encontrei ${sources.length} fontes para conferir`
              : "Não encontrei fontes confiáveis nesta busca",
          });
        } else {
          const responseActivityLabel =
            intent.id === "casual_conversation"
              ? "Respondendo de forma breve"
              : "Respondendo com base no contexto da conversa";

          if (!initialActivities.slice(0, 4).includes(responseActivityLabel)) {
            send({
              type: "activity",
              label: responseActivityLabel,
              detail: searchDecision.reason,
            });
          }
        }

        // RAG Search over Project Knowledge Collection
        if (user && supabase && body.projectId) {
          try {
            send({
              type: "activity",
              label: "Consultando base de conhecimento do projeto...",
            });

            const ragSources = await searchProjectKnowledge({
              supabase,
              projectId: body.projectId,
              query: body.message,
            });

            if (ragSources.length > 0) {
              sources = [...sources, ...ragSources];

              send({
                type: "activity",
                label: `Encontrei ${ragSources.length} referencias no projeto`,
              });
            } else {
              send({
                type: "activity",
                label: "Nenhuma referencia encontrada no projeto",
              });
            }
          } catch (ragError) {
            logError("chat.rag.failed", ragError);
          }
        }

        if (sources.length > 0) {
          send({ type: "sources", sources: serializeSources(sources) });
        }

        const providerMessages = buildProviderMessages({
          history,
          userMessage: body.message,
          sources,
          attachments: body.attachments,
          preferences: body.preferences,
          intent,
          memory: conversationMemory,
          searchAttempt: {
            enabled: searchDecision.enabled,
            query: searchDecision.query,
            sourceCount: sources.length,
          },
        });

        await recordUsageLog({
          userId: user?.id,
          conversationId,
          eventType: "chat_message_created",
          metadata: {
            mode: body.mode,
            webSearch: searchDecision.enabled,
            searchReason: searchDecision.reason,
            projectId: body.projectId,
            persistedUserMessage,
            sourceCount: sources.length,
            attachmentCount: body.attachments.length,
            intent: serializeIntent(intent),
            memoryPresent: Boolean(conversationMemory),
          },
        });

        logInfo("chat.stream.started", {
          userId: user?.id ?? "guest",
          conversationId,
          searchEnabled: searchDecision.enabled,
          sourceCount: sources.length,
          intent: intent.id,
        });

        send({
          type: "activity",
          label:
            intent.id === "casual_conversation"
              ? "Gerando resposta"
              : "Gerando resposta tecnica",
        });

        for await (const event of streamWithFallback({
          mode: body.mode,
          messages: providerMessages,
          sources,
          intent,
          userId: user?.id,
          conversationId,
          abortSignal: request.signal,
        })) {
          if (event.type === "provider") {
            providerId = event.provider;
            model = event.model;
          }

          if (event.type === "token") {
            assistantContent += event.token;
          }

          send(event);
        }

        if (assistantContent.trim() && user && supabase && conversationId) {
          const { data: assistant } = await supabase
            .from("messages")
            .insert({
              conversation_id: conversationId,
              user_id: user.id,
              role: "assistant",
              content: assistantContent,
              provider_id: providerId,
              model,
              latency_ms: Date.now() - startedAt,
              token_count: Math.ceil(assistantContent.length / 4),
              metadata: {
                sources,
                intent: serializeIntent(intent),
              },
            })
            .select("id")
            .single();

          const nextMemory = buildConversationMemory({
            previousMemory: conversationMemory,
            history,
            userMessage: body.message,
            assistantContent,
            intent,
          });
          const { error: memoryError } = await persistConversationMemory({
            supabase,
            conversationId,
            userId: user.id,
            memory: {
              ...nextMemory,
              messageId: conversationMemory?.messageId,
            },
          });

          if (memoryError) {
            logError("chat.memory.persist_failed", memoryError, {
              userId: user.id,
              conversationId,
            });
          }

          await supabase
            .from("conversations")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", conversationId)
            .eq("user_id", user.id);

          send({ type: "done", messageId: assistant?.id });
        } else {
          send({ type: "done" });
        }
      } catch (error) {
        logError("chat.stream.failed", error, {
          userId: user?.id ?? "guest",
          conversationId,
        });
        send({
          type: "error",
          message:
            error instanceof Error
              ? error.message
              : "Erro inesperado ao gerar resposta.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers });
}

function generateConversationTitle(message: string) {
  return truncate(message, 54) || "Nova conversa";
}

function parseGuestCount(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "0", 10);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, parsed);
}

function serializeSources(sources: SourceResult[]) {
  return sources.map((source) => ({
    title: source.title,
    url: source.url,
    snippet: source.snippet,
    provider: source.provider,
    score: source.score,
    metadata: source.metadata,
  }));
}

function summarizeAttachments(
  attachments: Array<{
    name: string;
    type: string;
    size: number;
    truncated?: boolean;
  }>,
) {
  return attachments.map((attachment) => ({
    name: attachment.name,
    type: attachment.type,
    size: attachment.size,
    truncated: attachment.truncated ?? false,
  }));
}

function serializeIntent(intent: IntentClassification) {
  return {
    id: intent.id,
    label: intent.label,
    confidence: intent.confidence,
    riskLevel: intent.riskLevel,
    missingCriticalData: intent.missingCriticalData,
    shouldAskClarifyingQuestion: intent.shouldAskClarifyingQuestion,
  };
}

function uniqueLabels(label: string, index: number, labels: string[]) {
  return labels.indexOf(label) === index;
}
