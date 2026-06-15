import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import type {
  ChatMessage,
  ConversationMemory,
  IntentClassification,
} from "@/lib/types";

export const CONVERSATION_MEMORY_METADATA_TYPE = "conversation_memory";

type ConversationMemoryRecord = ConversationMemory & {
  messageId?: string;
};

type MemoryMessageRow = {
  id: string;
  content: string;
  metadata: Json;
};

export async function readConversationMemory(input: {
  supabase: SupabaseClient<Database>;
  conversationId: string;
  userId: string;
}): Promise<ConversationMemoryRecord | null> {
  const { data, error } = await input.supabase
    .from("messages")
    .select("id,content,metadata")
    .eq("conversation_id", input.conversationId)
    .eq("user_id", input.userId)
    .eq("role", "system")
    .order("created_at", { ascending: false })
    .limit(8);

  if (error || !data) {
    return null;
  }

  const memoryRow = data.find((row) =>
    isConversationMemoryMetadata(row.metadata),
  ) as MemoryMessageRow | undefined;

  if (!memoryRow) {
    return null;
  }

  const memory = parseConversationMemory(memoryRow.content);

  return memory ? { ...memory, messageId: memoryRow.id } : null;
}

export async function persistConversationMemory(input: {
  supabase: SupabaseClient<Database>;
  conversationId: string;
  userId: string;
  memory: ConversationMemoryRecord;
}) {
  const metadata = {
    type: CONVERSATION_MEMORY_METADATA_TYPE,
    version: 1,
    updated_at: input.memory.updatedAt,
  } satisfies Json;
  const content = JSON.stringify(toStoredMemory(input.memory));

  if (input.memory.messageId) {
    return input.supabase
      .from("messages")
      .update({ content, metadata })
      .eq("id", input.memory.messageId)
      .eq("conversation_id", input.conversationId)
      .eq("user_id", input.userId);
  }

  return input.supabase.from("messages").insert({
    conversation_id: input.conversationId,
    user_id: input.userId,
    role: "system",
    content,
    metadata,
  });
}

export function buildConversationMemory(input: {
  previousMemory?: ConversationMemory | null;
  history: ChatMessage[];
  userMessage: string;
  assistantContent: string;
  intent: IntentClassification;
  now?: Date;
}): ConversationMemory {
  const now = input.now ?? new Date();
  const previous = input.previousMemory;
  const latestExchange = [
    `Ultima intencao: ${input.intent.label}.`,
    `Usuario: ${compactForMemory(input.userMessage, 280)}`,
    `Resposta: ${compactForMemory(input.assistantContent, 360)}`,
  ].join(" ");
  const historyContext = input.history
    .slice(-4)
    .map((message) => `${message.role}: ${compactForMemory(message.content, 120)}`)
    .join(" ");
  const summary = compactForMemory(
    [previous?.summary, historyContext, latestExchange].filter(Boolean).join(" "),
    1200,
  );
  const entities = mergeUnique(
    previous?.entities ?? [],
    extractEntities([input.userMessage, input.assistantContent].join(" ")),
  ).slice(0, 24);
  const openQuestions = mergeUnique(
    input.intent.missingCriticalData,
    previous?.openQuestions ?? [],
  ).slice(0, 8);

  return {
    summary,
    entities,
    openQuestions,
    lastIntent: input.intent.id,
    updatedAt: now.toISOString(),
  };
}

export function memoryToPrompt(memory: ConversationMemory | null | undefined) {
  if (!memory) {
    return "";
  }

  const lines = [
    memory.summary ? `Resumo: ${memory.summary}` : null,
    memory.entities.length ? `Entidades e codigos citados: ${memory.entities.join(", ")}` : null,
    memory.openQuestions.length
      ? `Pendencias recorrentes: ${memory.openQuestions.join("; ")}`
      : null,
  ].filter(Boolean);

  if (lines.length === 0) {
    return "";
  }

  return `\n\nMemoria resumida desta conversa. Use como contexto leve, nao como prova tecnica. Se o usuario corrigir algum dado, a correcao mais recente vence.\n${lines.join("\n")}`;
}

export function isConversationMemoryMetadata(
  metadata: Json | null | undefined,
) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return false;
  }

  return metadata.type === CONVERSATION_MEMORY_METADATA_TYPE;
}

function parseConversationMemory(content: string): ConversationMemory | null {
  try {
    const parsed: unknown = JSON.parse(content);

    if (!isMemoryLike(parsed)) {
      return null;
    }

    return {
      summary: parsed.summary,
      openQuestions: parsed.openQuestions,
      entities: parsed.entities,
      lastIntent: parsed.lastIntent,
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return null;
  }
}

function isMemoryLike(value: unknown): value is ConversationMemory {
  if (!value || typeof value !== "object") {
    return false;
  }

  const memory = value as Partial<ConversationMemory>;

  return (
    typeof memory.summary === "string" &&
    Array.isArray(memory.openQuestions) &&
    memory.openQuestions.every((item) => typeof item === "string") &&
    Array.isArray(memory.entities) &&
    memory.entities.every((item) => typeof item === "string") &&
    typeof memory.updatedAt === "string"
  );
}

function toStoredMemory(memory: ConversationMemoryRecord): ConversationMemory {
  return {
    summary: memory.summary,
    openQuestions: memory.openQuestions,
    entities: memory.entities,
    lastIntent: memory.lastIntent,
    updatedAt: memory.updatedAt,
  };
}

function extractEntities(text: string) {
  const codeMatches = text.match(/\b[A-Z]{1,5}[-\s]?\d{3,}[A-Z0-9-]*\b/gi) ?? [];
  const vehicleMatches =
    text.match(/\b(?:volvo|scania|mercedes|mb|iveco|daf|vw|ford|man|sprinter|daily|cargo|constellation|atego|axor|accelo)\b/gi) ??
    [];

  return mergeUnique(codeMatches, vehicleMatches).map((item) =>
    item.replace(/\s+/g, " ").trim(),
  );
}

function compactForMemory(text: string, maxLength: number) {
  const compact = text.replace(/\s+/g, " ").trim();

  if (compact.length <= maxLength) {
    return compact;
  }

  return `${compact.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function mergeUnique(first: string[], second: string[]) {
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const item of [...first, ...second]) {
    const clean = item.replace(/\s+/g, " ").trim();
    const key = clean.toLowerCase();

    if (!clean || seen.has(key)) {
      continue;
    }

    seen.add(key);
    merged.push(clean);
  }

  return merged;
}
