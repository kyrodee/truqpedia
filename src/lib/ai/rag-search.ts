import type { SupabaseClient } from "@supabase/supabase-js";
import { generateGeminiEmbeddings } from "@/lib/ai/rag-worker";
import type { Database, Json } from "@/lib/supabase/database.types";
import type { SourceResult } from "@/lib/types";

export type ProjectKnowledgeChunkRow = {
  id: string;
  collection_id: string;
  document_id: string;
  owner_user_id?: string;
  content: string;
  metadata?: Json;
  similarity?: number;
};

export type RankedKnowledgeChunk = ProjectKnowledgeChunkRow & {
  score: number;
  referenceHit: boolean;
};

export async function searchProjectKnowledge(input: {
  supabase: SupabaseClient<Database>;
  projectId: string;
  query: string;
  matchThreshold?: number;
  matchCount?: number;
  sourceCount?: number;
}): Promise<SourceResult[]> {
  const embeddings = await generateGeminiEmbeddings([input.query]);
  const queryEmbedding = embeddings[0];

  if (!queryEmbedding) {
    return [];
  }

  const queryReference = extractQueryReferences(input.query)[0] ?? input.query;

  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const { data, error } = await (input.supabase as any).rpc(
    "match_knowledge_chunks",
    {
      query_embedding: queryEmbedding,
      match_threshold: input.matchThreshold ?? 0.24,
      match_count: input.matchCount ?? 18,
      filter_collection_id: input.projectId,
      query_text: queryReference,
    },
  );

  if (error || !data) {
    throw error ?? new Error("RAG search returned no data.");
  }

  return rankKnowledgeChunks(data as ProjectKnowledgeChunkRow[], input.query)
    .slice(0, input.sourceCount ?? 8)
    .map((chunk) => knowledgeChunkToSource(chunk, input.projectId));
}

export function rankKnowledgeChunks(
  chunks: ProjectKnowledgeChunkRow[],
  query: string,
): RankedKnowledgeChunk[] {
  const queryReferences = extractQueryReferences(query);
  const queryTerms = normalizeText(query)
    .split(" ")
    .filter((term) => term.length >= 3)
    .slice(0, 12);

  return chunks
    .map((chunk) => {
      const content = normalizeText(chunk.content);
      const metadataText = normalizeText(JSON.stringify(chunk.metadata ?? {}));
      const referenceHit =
        queryReferences.length > 0 &&
        queryReferences.some((reference) =>
          normalizeReference(`${chunk.content} ${metadataText}`).includes(
            normalizeReference(reference),
          ),
        );
      const termHits = queryTerms.filter((term) => content.includes(term)).length;
      const similarity = clampScore(chunk.similarity ?? 0);
      const score =
        similarity * 0.72 +
        (referenceHit ? 0.22 : 0) +
        Math.min(0.06, termHits * 0.015);

      return {
        ...chunk,
        score,
        referenceHit,
      };
    })
    .sort((a, b) => b.score - a.score);
}

export function knowledgeChunkToSource(
  chunk: RankedKnowledgeChunk,
  projectId: string,
): SourceResult {
  const metadata = readChunkMetadata(chunk.metadata);
  const chunkIndex =
    typeof metadata.chunk_index === "number" ? metadata.chunk_index : 0;
  const fileName =
    typeof metadata.file_name === "string" ? metadata.file_name : "Documento";
  const location = describeChunkLocation(metadata);

  return {
    title: `${fileName}${location} (Ref #${chunkIndex + 1})`,
    url: `file:///projects/${projectId}/files/${chunk.document_id}`,
    snippet: chunk.content,
    provider: "project_rag",
    score: Number(chunk.score.toFixed(4)),
    metadata: {
      documentId: chunk.document_id,
      chunkIndex,
      similarity: Number((chunk.similarity ?? 0).toFixed(4)),
      referenceHit: chunk.referenceHit,
      sheetName:
        typeof metadata.sheet_name === "string" ? metadata.sheet_name : null,
      rowNumber:
        typeof metadata.row_number === "number" ? metadata.row_number : null,
    },
  };
}

export function extractQueryReferences(text: string) {
  const matches =
    text.match(/\b(?:[A-Z]{1,5}[-\s]?\d{3,}[A-Z0-9-]*|\d{6,14})\b/gi) ?? [];
  const seen = new Set<string>();
  const references: string[] = [];

  for (const match of matches) {
    const clean = normalizeReferenceMatch(match);

    if (!clean || seen.has(clean)) {
      continue;
    }

    seen.add(clean);
    references.push(clean);
  }

  return references;
}

function normalizeReferenceMatch(match: string) {
  if (/^e\s+\d/i.test(match)) {
    return match.replace(/^e\s+/i, "").trim().toUpperCase();
  }

  return match.replace(/\s+/g, "").trim().toUpperCase();
}

function readChunkMetadata(metadata: Json | undefined) {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? metadata
    : {};
}

function describeChunkLocation(metadata: Record<string, Json | undefined>) {
  const sheetName =
    typeof metadata.sheet_name === "string" ? metadata.sheet_name : null;
  const rowNumber =
    typeof metadata.row_number === "number" ? metadata.row_number : null;

  if (sheetName && rowNumber) {
    return ` - ${sheetName}, linha ${rowNumber}`;
  }

  return "";
}

function normalizeReference(value: string) {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function clampScore(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
}
