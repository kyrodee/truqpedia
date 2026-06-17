import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logError } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: collectionId } = await params;
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  }

  try {
    // List document assets for this collection belonging to the user
    const { data: files, error: filesError } = await supabase
      .from("document_assets")
      .select("id, file_name, mime_type, storage_path, status, metadata, created_at")
      .eq("collection_id", collectionId)
      .eq("owner_user_id", user.id)
      .order("created_at", { ascending: false });

    if (filesError) {
      throw filesError;
    }

    return NextResponse.json({ files: files ?? [] });
  } catch (error) {
    logError("projects.files.get.failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao carregar arquivos." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: collectionId } = await params;
  const { searchParams } = new URL(request.url);
  const fileId = searchParams.get("fileId");

  if (!fileId) {
    return NextResponse.json({ error: "O ID do arquivo é obrigatório." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  }

  try {
    // 1. Get file information to retrieve the storage path and confirm ownership
    const { data: file, error: fetchError } = await supabase
      .from("document_assets")
      .select("storage_path")
      .eq("id", fileId)
      .eq("collection_id", collectionId)
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (fetchError || !file) {
      return NextResponse.json(
        { error: "Arquivo não encontrado ou acesso não autorizado." },
        { status: 404 }
      );
    }

    // 2. Delete from Supabase Storage
    const { error: storageError } = await supabase.storage
      .from("document-assets")
      .remove([file.storage_path]);

    if (storageError) {
      logError("projects.files.delete.storage_failed", storageError);
      // We still proceed to delete from DB if the file is missing in storage to keep data clean
    }

    // 3. Delete from database (which cascade deletes knowledge_chunks)
    const { error: deleteError } = await supabase
      .from("document_assets")
      .delete()
      .eq("id", fileId)
      .eq("owner_user_id", user.id);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logError("projects.files.delete.failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao excluir arquivo." },
      { status: 500 }
    );
  }
}
