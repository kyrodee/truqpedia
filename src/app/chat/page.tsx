import { redirect } from "next/navigation";
import { TruqpediaShell } from "@/components/chat/truqpedia-shell";
import { isConversationMemoryMetadata } from "@/lib/ai/memory";
import { isProjectCollection, toProjectSummary } from "@/lib/projects";
import { getCurrentUser } from "@/lib/supabase/server";
import type {
  AssistantPreferences,
  ChatMode,
  SourceResult,
  UploadedAttachment,
} from "@/lib/types";
import type { Json } from "@/lib/supabase/database.types";

type PageProps = {
  searchParams?: Promise<{ c?: string; p?: string }>;
};

export const dynamic = "force-dynamic";

export default async function ChatPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { supabase, user } = await getCurrentUser();
  const selectedConversationId = params?.c ?? null;
  const selectedProjectId = params?.p ?? null;

  if (!supabase || !user) {
    redirect("/login?next=/chat");
  }

  const [
    { data: profile },
    { data: conversations },
    { data: collections },
    { data: userSettings },
  ] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("conversations")
      .select("id,title,mode,created_at,updated_at")
      .eq("user_id", user.id)
      .is("archived_at", null)
      .order("updated_at", { ascending: false }),
    supabase
      .from("knowledge_collections")
      .select("*")
      .eq("owner_user_id", user.id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("user_settings")
      .select("metadata")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const projects =
    collections?.filter(isProjectCollection).map((project) =>
      toProjectSummary(project),
    ) ?? [];

  const activeConversationId =
    selectedConversationId &&
    conversations?.some((conversation) => conversation.id === selectedConversationId)
      ? selectedConversationId
      : null;

  const activeProjectId =
    selectedProjectId && projects.some((project) => project.id === selectedProjectId)
      ? selectedProjectId
      : null;

  const { data: messages } = activeConversationId
    ? await supabase
        .from("messages")
        .select("id,role,content,metadata,created_at")
        .eq("conversation_id", activeConversationId)
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
    : { data: [] };

  let subscription: { planId: string; status: string; createdAt: string } | null = null;
  if (userSettings?.metadata && typeof userSettings.metadata === "object" && !Array.isArray(userSettings.metadata)) {
    const meta = userSettings.metadata as Record<string, unknown>;
    if (meta.subscription && typeof meta.subscription === "object") {
      subscription = meta.subscription as { planId: string; status: string; createdAt: string };
    }
  }

  return (
    <TruqpediaShell
      user={{
        id: user.id,
        email: user.email,
        role: profile?.role ?? "user",
      }}
      initialConversations={
        conversations?.map((conversation) => ({
          id: conversation.id,
          title: conversation.title,
          mode: conversation.mode as ChatMode,
          createdAt: conversation.created_at,
          updatedAt: conversation.updated_at,
        })) ?? []
      }
      initialProjects={projects}
      initialMessages={
        messages
          ?.filter(
            (message) =>
              message.role !== "system" &&
              !isConversationMemoryMetadata(message.metadata),
          )
          .map((message) => {
            const metadata = message.metadata as
              | { sources?: SourceResult[]; attachments?: UploadedAttachment[] }
              | null
              | undefined;

            return {
              id: message.id,
              role: message.role,
              content: message.content,
              sources: metadata?.sources,
              attachments: metadata?.attachments,
              createdAt: message.created_at,
              status: "done" as const,
            };
          }) ?? []
      }
      initialConversationId={activeConversationId}
      initialProjectId={activeProjectId}
      initialAssistantPreferences={readAssistantPreferences(
        userSettings?.metadata,
      )}
      initialSubscription={subscription}
    />
  );
}

function readAssistantPreferences(metadata: Json | undefined): AssistantPreferences {
  if (!isJsonObject(metadata)) {
    return {};
  }

  const preferences = metadata.assistant_preferences;

  if (!isJsonObject(preferences)) {
    return {};
  }

  return {
    displayName: readString(preferences.displayName),
    referenceStyle: readString(preferences.referenceStyle),
    behavior: readString(preferences.behavior),
    responseStyle: readString(preferences.responseStyle),
    businessContext: readString(preferences.businessContext),
    customInstructions: readString(preferences.customInstructions),
  };
}

// Helpers
function readString(value: Json | undefined) {
  return typeof value === "string" ? value : undefined;
}

function isJsonObject(value: Json | undefined): value is Record<string, Json | undefined> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
