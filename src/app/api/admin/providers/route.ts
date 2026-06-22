import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/supabase/authz";
import { loadProviderConfigs } from "@/lib/ai/model-router";
import { GROQ_PRIMARY_MODEL } from "@/lib/constants";
import { readJsonBody } from "@/lib/request";

export const dynamic = "force-dynamic";

const providerSchema = z.object({
  id: z.literal("groq"),
  enabled: z.boolean(),
  priority: z.number().int().min(1).max(1000),
  speedModel: z.string().min(1).max(160).optional(),
  deepModel: z.string().min(1).max(160).optional(),
  baseUrl: z.string().url().nullable().optional(),
  timeoutMs: z.number().int().min(5000).max(120000),
});

export async function GET() {
  const { response } = await requireAdmin();

  if (response) {
    return response;
  }

  return NextResponse.json({ providers: await loadProviderConfigs() });
}

export async function PATCH(request: Request) {
  const { supabase, response } = await requireAdmin();

  if (response || !supabase) {
    return response;
  }

  const jsonBody = await readJsonBody(request, 16 * 1024);

  if (!jsonBody.ok) {
    return jsonBody.response;
  }

  const parsed = providerSchema.safeParse(jsonBody.data);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Configuracao invalida.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const provider = parsed.data;

  const { error } = await supabase.from("ai_provider_settings").upsert({
    id: provider.id,
    display_name: provider.id,
    enabled: provider.enabled,
    priority: 10,
    speed_model: GROQ_PRIMARY_MODEL,
    deep_model: GROQ_PRIMARY_MODEL,
    base_url: provider.baseUrl ?? null,
    timeout_ms: provider.timeoutMs,
    metadata: {
      speed_model_fallbacks: [],
      deep_model_fallbacks: [],
    },
    updated_at: new Date().toISOString(),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

