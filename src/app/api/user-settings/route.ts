import { NextResponse } from "next/server";
import { z } from "zod";
import { DEFAULT_CHAT_MODE } from "@/lib/constants";
import { readJsonBody } from "@/lib/request";
import { requireUser } from "@/lib/supabase/authz";
import type { Json } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

const assistantPreferencesSchema = z.object({
  displayName: z.string().max(80).optional(),
  referenceStyle: z.string().max(120).optional(),
  behavior: z.string().max(700).optional(),
  responseStyle: z.string().max(240).optional(),
  businessContext: z.string().max(500).optional(),
  customInstructions: z.string().max(700).optional(),
});

const updateSettingsSchema = z.object({
  assistantPreferences: assistantPreferencesSchema.optional(),
});

export async function GET() {
  const { supabase, user, response } = await requireUser();

  if (response || !supabase || !user) {
    return response;
  }

  const { data, error } = await supabase
    .from("user_settings")
    .select("metadata")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    assistantPreferences: readAssistantPreferences(data?.metadata),
  });
}

export async function PATCH(request: Request) {
  const { supabase, user, response } = await requireUser();

  if (response || !supabase || !user) {
    return response;
  }

  const jsonBody = await readJsonBody(request, 16 * 1024);

  if (!jsonBody.ok) {
    return jsonBody.response;
  }

  const parsed = updateSettingsSchema.safeParse(jsonBody.data ?? {});

  if (!parsed.success) {
    return NextResponse.json({ error: "Preferencias invalidas." }, { status: 400 });
  }

  const { data: current } = await supabase
    .from("user_settings")
    .select("metadata")
    .eq("user_id", user.id)
    .maybeSingle();

  const metadata = {
    ...(isJsonObject(current?.metadata) ? current?.metadata : {}),
    assistant_preferences: parsed.data.assistantPreferences ?? {},
  };

  const { error } = await supabase.from("user_settings").upsert({
    user_id: user.id,
    default_mode: DEFAULT_CHAT_MODE,
    web_search_enabled: true,
    locale: "pt-BR",
    metadata,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    assistantPreferences: parsed.data.assistantPreferences ?? {},
  });
}

function readAssistantPreferences(metadata: Json | undefined) {
  if (!isJsonObject(metadata)) {
    return {};
  }

  const preferences = metadata.assistant_preferences;

  return isJsonObject(preferences) ? preferences : {};
}

function isJsonObject(value: Json | undefined): value is Record<string, Json | undefined> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
