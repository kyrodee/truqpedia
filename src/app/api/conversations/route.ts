import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/authz";

export const dynamic = "force-dynamic";

const createConversationSchema = z.object({
  title: z.string().min(1).max(120).default("Nova conversa"),
  mode: z.enum(["speed", "deep"]).default("speed"),
});

export async function GET() {
  const { supabase, user, response } = await requireUser();

  if (response || !supabase || !user) {
    return response;
  }

  const { data, error } = await supabase
    .from("conversations")
    .select("id,title,mode,created_at,updated_at")
    .eq("user_id", user.id)
    .is("archived_at", null)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ conversations: data ?? [] });
}

export async function POST(request: Request) {
  const { supabase, user, response } = await requireUser();

  if (response || !supabase || !user) {
    return response;
  }

  const parsed = createConversationSchema.safeParse(
    await request.json().catch(() => ({})),
  );

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados invalidos." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("conversations")
    .insert({
      user_id: user.id,
      title: parsed.data.title,
      mode: parsed.data.mode,
    })
    .select("id,title,mode,created_at,updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ conversation: data }, { status: 201 });
}

