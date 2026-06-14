import type { Json, KnowledgeCollectionRow } from "@/lib/supabase/database.types";
import type { ProjectSummary } from "@/lib/types";

type ProjectMetadata = {
  type?: string;
  conversation_ids?: unknown;
};

export function isProjectCollection(row: Pick<KnowledgeCollectionRow, "metadata">) {
  const metadata = toProjectMetadata(row.metadata);
  return metadata.type === "project";
}

export function projectConversationIds(metadata: Json) {
  const ids = toProjectMetadata(metadata).conversation_ids;

  if (!Array.isArray(ids)) {
    return [];
  }

  return ids.filter((id): id is string => typeof id === "string");
}

export function projectMetadataWithConversation(
  metadata: Json,
  conversationId: string,
): Json {
  const existing = projectConversationIds(metadata);

  return {
    ...(isJsonObject(metadata) ? metadata : {}),
    type: "project",
    conversation_ids: Array.from(new Set([...existing, conversationId])),
  };
}

export function toProjectSummary(row: KnowledgeCollectionRow): ProjectSummary {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    conversationIds: projectConversationIds(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toProjectMetadata(metadata: Json): ProjectMetadata {
  return isJsonObject(metadata) ? (metadata as ProjectMetadata) : {};
}

function isJsonObject(value: Json): value is { [key: string]: Json | undefined } {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
