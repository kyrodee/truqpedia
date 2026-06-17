import { NextResponse } from "next/server";
import { z } from "zod";
import { DEFAULT_CHAT_MODE } from "@/lib/constants";
import { readJsonBody } from "@/lib/request";
import { requireUser } from "@/lib/supabase/authz";
import type { Json } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

const simulateSchema = z.object({
  planId: z.enum(["balcao", "loja", "operacao"]),
});

export async function POST(request: Request) {
  const { supabase, user, response } = await requireUser();

  if (response || !supabase || !user) {
    return response;
  }

  const jsonBody = await readJsonBody(request, 16 * 1024);

  if (!jsonBody.ok) {
    return jsonBody.response;
  }

  const parsed = simulateSchema.safeParse(jsonBody.data);

  if (!parsed.success) {
    return NextResponse.json({ error: "Plano inválido." }, { status: 400 });
  }

  const { planId } = parsed.data;

  // Retrieve current settings metadata
  const { data: current } = await supabase
    .from("user_settings")
    .select("metadata")
    .eq("user_id", user.id)
    .maybeSingle();

  // Merge the subscription into current metadata JSON
  const metadata = {
    ...(isJsonObject(current?.metadata) ? current.metadata : {}),
    subscription: {
      planId,
      status: "active",
      createdAt: new Date().toISOString(),
      simulated: true,
    },
  };

  // Upsert the updated metadata back into user_settings
  const { error } = await supabase.from("user_settings").upsert({
    user_id: user.id,
    default_mode: DEFAULT_CHAT_MODE,
    web_search_enabled: true,
    locale: "pt-BR",
    metadata,
  });

  if (error) {
    console.error("Failed to update simulated subscription status in DB:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, planId });
}

function isJsonObject(value: Json | undefined): value is Record<string, Json | undefined> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
