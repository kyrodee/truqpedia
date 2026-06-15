import { NextResponse } from "next/server";
import { z } from "zod";
import { isConversationMemoryMetadata } from "@/lib/ai/memory";
import { readJsonBody } from "@/lib/request";
import { requireUser } from "@/lib/supabase/authz";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  mode: z.enum(["speed", "deep"]).optional(),
});

const idSchema = z.string().uuid();

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const parsedId = idSchema.safeParse(id);

  if (!parsedId.success) {
    return NextResponse.json({ error: "Conversa invalida." }, { status: 400 });
  }

  const { supabase, user, response } = await requireUser();

  if (response || !supabase || !user) {
    return response;
  }

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("id,title,mode,created_at,updated_at")
    .eq("id", parsedId.data)
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
    .select("id,role,content,metadata,created_at")
    .eq("conversation_id", parsedId.data)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (messagesError) {
    return NextResponse.json({ error: messagesError.message }, { status: 500 });
  }

  return NextResponse.json({
    conversation,
    messages:
      messages?.filter(
        (message) =>
          message.role !== "system" &&
          !isConversationMemoryMetadata(message.metadata),
      ) ?? [],
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const parsedId = idSchema.safeParse(id);

  if (!parsedId.success) {
    return NextResponse.json({ error: "Conversa invalida." }, { status: 400 });
  }

  const { supabase, user, response } = await requireUser();

  if (response || !supabase || !user) {
    return response;
  }

  const jsonBody = await readJsonBody(request, 16 * 1024);

  if (!jsonBody.ok) {
    return jsonBody.response;
  }

  const parsed = updateSchema.safeParse(jsonBody.data);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados invalidos." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("conversations")
    .update({
      ...parsed.data,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsedId.data)
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
  const parsedId = idSchema.safeParse(id);

  if (!parsedId.success) {
    return NextResponse.json({ error: "Conversa invalida." }, { status: 400 });
  }

  const { supabase, user, response } = await requireUser();

  if (response || !supabase || !user) {
    return response;
  }

  const { error } = await supabase
    .from("conversations")
    .delete()
    .eq("id", parsedId.data)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

