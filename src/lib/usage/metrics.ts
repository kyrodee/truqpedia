import type { ProviderId, SourceResult } from "@/lib/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";

export async function recordProviderMetric(input: {
  providerId: ProviderId;
  model: string;
  mode: string;
  latencyMs: number;
  success: boolean;
  errorMessage?: string;
  userId?: string | null;
  conversationId?: string | null;
  tokensIn?: number;
  tokensOut?: number;
}) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return;
  }

  await supabase.from("provider_metrics").insert({
    provider_id: input.providerId,
    model: input.model,
    mode: input.mode,
    latency_ms: input.latencyMs,
    success: input.success,
    error_message: input.errorMessage ?? null,
    user_id: input.userId ?? null,
    conversation_id: input.conversationId ?? null,
    tokens_in: input.tokensIn ?? 0,
    tokens_out: input.tokensOut ?? 0,
  });
}

export async function recordUsageLog(input: {
  userId?: string | null;
  conversationId?: string | null;
  eventType: string;
  metadata?: Json;
}) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return;
  }

  await supabase.from("usage_logs").insert({
    user_id: input.userId ?? null,
    conversation_id: input.conversationId ?? null,
    event_type: input.eventType,
    metadata: input.metadata ?? {},
  });
}

export async function recordWebSearchLog(input: {
  userId?: string | null;
  conversationId?: string | null;
  query: string;
  provider?: string | null;
  sources: SourceResult[];
}) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return;
  }

  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  await (supabase as any).from("web_search_logs").insert({
    user_id: input.userId ?? null,
    conversation_id: input.conversationId ?? null,
    query: input.query,
    provider: input.provider ?? input.sources[0]?.provider ?? null,
    result_count: input.sources.length,
    sources: input.sources as unknown as Json,
  });
}
