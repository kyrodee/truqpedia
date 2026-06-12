import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/authz";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  mode: z.enum(["speed", "deep"]).optional(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const { supabase, user, response } = await requireUser();

  if (response || !supabase || !user) {
    return response;
  }

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("id,title,mode,created_at,updated_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (conversationError || !conversation) {
    return NextResponse.json(
      { error: "Conversa nao encontrada." },
      { status: 404 },
    );
  }

  const { data: messages, error: messagesError } = await supabase
    .from("messages")
    .select("id,role,content,provider_id,model,metadata,created_at")
    .eq("conversation_id", id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (messagesError) {
    return NextResponse.json({ error: messagesError.message }, { status: 500 });
  }

  return NextResponse.json({
    conversation,
    messages: messages ?? [],
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const { supabase, user, response } = await requireUser();

  if (response || !supabase || !user) {
    return response;
  }

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados invalidos." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("conversations")
    .update({
      ...parsed.data,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id,title,mode,created_at,updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ conversation: data });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const { supabase, user, response } = await requireUser();

  if (response || !supabase || !user) {
    return response;
  }

  const { error } = await supabase
    .from("conversations")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

