import type {
  AssistantPreferences,
  ChatMessage,
  ConversationSummary,
  ProjectSummary,
  ArtifactSummary,
  SourceResult,
  UploadedAttachment,
  StreamEvent,
} from "@/lib/types";

export type {
  AssistantPreferences,
  SourceResult,
  UploadedAttachment,
  StreamEvent,
};

export type SessionUser = {
  id: string;
  email?: string;
  role?: "user" | "admin";
};

export type UiConversation = ConversationSummary;
export type UiProject = ProjectSummary;
export type UiArtifact = ArtifactSummary;

export type ProjectFile = {
  id: string;
  file_name: string;
  mime_type: string;
  storage_path: string;
  status: "uploaded" | "processing" | "ready" | "failed";
  metadata?: {
    stage?: string;
    progress?: number;
    total_chunks?: number;
    error?: string;
    size?: number;
  };
  created_at: string;
};

export type UiMessage = ChatMessage & {
  id: string;
  status?: "searching" | "streaming" | "error" | "done";
  sources?: SourceResult[];
  attachments?: UploadedAttachment[];
  activities?: Array<{ label: string; detail?: string }>;
};
