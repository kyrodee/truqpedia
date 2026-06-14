import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isProjectCollection,
  projectMetadataWithConversation,
} from "@/lib/projects";
import { DEFAULT_CHAT_MODE } from "@/lib/constants";
import { readJsonBody } from "@/lib/request";
import { requireUser } from "@/lib/supabase/authz";
import type { Json } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

const createConversationSchema = z.object({
  title: z.string().min(1).max(120).default("Nova conversa"),
  mode: z.enum(["speed", "deep"]).default(DEFAULT_CHAT_MODE),
  projectId: z.string().uuid().nullable().optional(),
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

  const jsonBody = await readJsonBody(request, 16 * 1024);

  if (!jsonBody.ok) {
    return jsonBody.response;
  }

  const parsed = createConversationSchema.safeParse(jsonBody.data ?? {});

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados invalidos." }, { status: 400 });
  }

  let project: { id: string; metadata: Json } | null = null;

  if (parsed.data.projectId) {
    const { data: projectData, error: projectError } = await supabase
      .from("knowledge_collections")
      .select("id,metadata")
      .eq("id", parsed.data.projectId)
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

  const { data, error } = await supabase
    .from("conversations")
    .insert({
      user_id: user.id,
      title: parsed.data.title,
      mode: DEFAULT_CHAT_MODE,
    })
    .select("id,title,mode,created_at,updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (project && data) {
    await supabase
      .from("knowledge_collections")
      .update({
        metadata: projectMetadataWithConversation(project.metadata, data.id),
        updated_at: new Date().toISOString(),
      })
      .eq("id", project.id)
      .eq("owner_user_id", user.id);
  }

  return NextResponse.json({ conversation: data }, { status: 201 });
}

