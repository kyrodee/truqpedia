import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/supabase/authz";
import { loadProviderConfigs } from "@/lib/ai/model-router";

export const dynamic = "force-dynamic";

const providerSchema = z.object({
  id: z.enum(["groq", "openrouter", "gemini", "cohere", "grok"]),
  enabled: z.boolean(),
  priority: z.number().int().min(1).max(1000),
  speedModel: z.string().min(1).max(160),
  deepModel: z.string().min(1).max(160),
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

  const parsed = providerSchema.safeParse(await request.json().catch(() => null));

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
    priority: provider.priority,
    speed_model: provider.speedModel,
    deep_model: provider.deepModel,
    base_url: provider.baseUrl ?? null,
    timeout_ms: provider.timeoutMs,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

