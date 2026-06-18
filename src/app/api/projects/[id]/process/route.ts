import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { processDocumentAsset } from "@/lib/ai/rag-worker";
import { logError } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function POST(
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
    const { storagePath, fileName, mimeType, size } = await request.json();

    if (!storagePath || !fileName) {
      return NextResponse.json(
        { error: "Caminho do arquivo e nome são obrigatórios." },
        { status: 400 }
      );
    }

    // 1. Check if the project/collection belongs to the user
    const { data: collection, error: colError } = await supabase
      .from("knowledge_collections")
      .select("id")
      .eq("id", collectionId)
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (colError || !collection) {
      return NextResponse.json(
        { error: "Projeto não encontrado ou acesso não autorizado." },
        { status: 404 }
      );
    }

    // 2. Insert or update the document asset in database
    const { data: existingAssets, error: existingAssetError } = await supabase
      .from("document_assets")
      .select("id")
      .eq("owner_user_id", user.id)
      .eq("collection_id", collectionId)
      .eq("storage_path", storagePath)
      .limit(1);

    if (existingAssetError) {
      return NextResponse.json(
        { error: `Erro ao procurar documento no banco: ${existingAssetError.message}` },
        { status: 500 }
      );
    }

    const existingAssetId = existingAssets?.[0]?.id;
    const documentPayload = {
      collection_id: collectionId,
      file_name: fileName,
      mime_type: mimeType || "application/octet-stream",
      storage_path: storagePath,
      status: "uploaded" as const,
      metadata: {
        stage: "pending",
        size: size || 0,
      },
    };

    const documentQuery = existingAssetId
      ? supabase
          .from("document_assets")
          .update({
            ...documentPayload,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingAssetId)
          .eq("owner_user_id", user.id)
      : supabase
          .from("document_assets")
          .insert({
            ...documentPayload,
            owner_user_id: user.id,
          });

    const { data: docAsset, error: docError } = await documentQuery
      .select("id")
      .single();

    if (docError || !docAsset) {
      return NextResponse.json(
        { error: `Erro ao registrar documento no banco: ${docError?.message}` },
        { status: 500 }
      );
    }

    // 3. Process the document and await its completion
    await processDocumentAsset({
      supabase,
      documentId: docAsset.id,
      collectionId,
      userId: user.id,
      storagePath,
      fileName,
      mimeType: mimeType || "application/octet-stream",
    });

    return NextResponse.json({
      success: true,
      documentId: docAsset.id,
      status: "ready",
    });
  } catch (error) {
    logError("projects.process.failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro desconhecido ao processar RAG." },
      { status: 500 }
    );
  }
}
