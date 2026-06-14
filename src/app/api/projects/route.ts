import { NextResponse } from "next/server";
import { z } from "zod";
import { readJsonBody } from "@/lib/request";
import { isProjectCollection, toProjectSummary } from "@/lib/projects";
import { requireUser } from "@/lib/supabase/authz";

export const dynamic = "force-dynamic";

const projectSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(280).optional().default(""),
});

export async function GET() {
  const { supabase, user, response } = await requireUser();

  if (response || !supabase || !user) {
    return response;
  }

  const { data, error } = await supabase
    .from("knowledge_collections")
    .select("*")
    .eq("owner_user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    projects: (data ?? [])
      .filter(isProjectCollection)
      .map((project) => toProjectSummary(project)),
  });
}

export async function POST(request: Request) {
  const { supabase, user, response } = await requireUser();

  if (response || !supabase || !user) {
    return response;
  }

  const jsonBody = await readJsonBody(request, 32 * 1024);

  if (!jsonBody.ok) {
    return jsonBody.response;
  }

  const parsed = projectSchema.safeParse(jsonBody.data);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Projeto invalido.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("knowledge_collections")
    .insert({
      owner_user_id: user.id,
      name: parsed.data.name,
      description: parsed.data.description || null,
      visibility: "private",
      metadata: {
        type: "project",
        conversation_ids: [],
      },
    })
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Nao foi possivel criar o projeto." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { project: toProjectSummary(data) },
    { status: 201 },
  );
}
