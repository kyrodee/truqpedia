import { NextResponse } from "next/server";
import { z } from "zod";
import { readJsonBody } from "@/lib/request";
import { isProjectCollection, toProjectSummary } from "@/lib/projects";
import { requireUser } from "@/lib/supabase/authz";

export const dynamic = "force-dynamic";

const idSchema = z.string().uuid();
const updateProjectSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(280).nullable().optional(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const parsedId = idSchema.safeParse(id);

  if (!parsedId.success) {
    return NextResponse.json({ error: "Projeto invalido." }, { status: 400 });
  }

  const { supabase, user, response } = await requireUser();

  if (response || !supabase || !user) {
    return response;
  }

  const jsonBody = await readJsonBody(request, 32 * 1024);

  if (!jsonBody.ok) {
    return jsonBody.response;
  }

  const parsed = updateProjectSchema.safeParse(jsonBody.data);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados invalidos." }, { status: 400 });
  }

  const { data: existing, error: existingError } = await supabase
    .from("knowledge_collections")
    .select("*")
    .eq("id", parsedId.data)
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (existingError || !existing || !isProjectCollection(existing)) {
    return NextResponse.json(
      { error: "Projeto nao encontrado." },
      { status: 404 },
    );
  }

  const updatePayload: {
    name?: string;
    description?: string | null;
    updated_at: string;
  } = {
    updated_at: new Date().toISOString(),
  };

  if (parsed.data.name !== undefined) {
    updatePayload.name = parsed.data.name;
  }

  if (parsed.data.description !== undefined) {
    updatePayload.description = parsed.data.description;
  }

  const { data, error } = await supabase
    .from("knowledge_collections")
    .update(updatePayload)
    .eq("id", parsedId.data)
    .eq("owner_user_id", user.id)
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Nao foi possivel salvar o projeto." },
      { status: 500 },
    );
  }

  return NextResponse.json({ project: toProjectSummary(data) });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const parsedId = idSchema.safeParse(id);

  if (!parsedId.success) {
    return NextResponse.json({ error: "Projeto invalido." }, { status: 400 });
  }

  const { supabase, user, response } = await requireUser();

  if (response || !supabase || !user) {
    return response;
  }

  const { error } = await supabase
    .from("knowledge_collections")
    .delete()
    .eq("id", parsedId.data)
    .eq("owner_user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
