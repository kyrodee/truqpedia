import { TruqpediaShell } from "@/components/chat/truqpedia-shell";
import { getCurrentUser } from "@/lib/supabase/server";
import type { ChatMode, SourceResult } from "@/lib/types";

type PageProps = {
  searchParams?: Promise<{ c?: string }>;
};

export default async function Home({ searchParams }: PageProps) {
  const params = await searchParams;
  const { supabase, user } = await getCurrentUser();
  const selectedConversationId = params?.c ?? null;

  if (!supabase || !user) {
    return (
      <TruqpediaShell
        user={null}
        initialConversations={[]}
        initialMessages={[]}
        initialConversationId={null}
      />
    );
  }

  const [{ data: profile }, { data: conversations }] = await Promise.all([
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
  ]);

  const activeConversationId =
    selectedConversationId &&
    conversations?.some((conversation) => conversation.id === selectedConversationId)
      ? selectedConversationId
      : null;

  const { data: messages } = activeConversationId
    ? await supabase
        .from("messages")
        .select("id,role,content,provider_id,model,metadata,created_at")
        .eq("conversation_id", activeConversationId)
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
    : { data: [] };

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
      initialMessages={
        messages?.map((message) => {
          const metadata = message.metadata as
            | { sources?: SourceResult[] }
            | null
            | undefined;

          return {
            id: message.id,
            role: message.role,
            content: message.content,
            provider: message.provider_id ?? undefined,
            model: message.model ?? undefined,
            sources: metadata?.sources,
            createdAt: message.created_at,
            status: "done" as const,
          };
        }) ?? []
      }
      initialConversationId={activeConversationId}
    />
  );
}

