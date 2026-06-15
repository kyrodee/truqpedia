export type ChatMode = "speed" | "deep";

export type MessageRole = "system" | "user" | "assistant";

export type ProviderId = "groq" | "openrouter" | "gemini" | "cohere" | "grok";

export type SourceResult = {
  title: string;
  url: string;
  snippet: string;
  provider?: string;
};

export type ChatMessage = {
  id?: string;
  conversationId?: string;
  role: MessageRole;
  content: string;
  createdAt?: string;
  metadata?: Record<string, unknown>;
};

export type UploadedAttachment = {
  name: string;
  type: string;
  size: number;
  text?: string;
  truncated?: boolean;
};

export type AssistantPreferences = {
  displayName?: string;
  referenceStyle?: string;
  behavior?: string;
  responseStyle?: string;
  businessContext?: string;
  customInstructions?: string;
};

export type ConversationSummary = {
  id: string;
  title: string;
  mode: ChatMode;
  updatedAt: string;
  createdAt: string;
};

export type ProjectSummary = {
  id: string;
  name: string;
  description?: string;
  conversationIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type ArtifactSummary = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  sourceMessageId?: string;
};

export type ProviderRuntimeConfig = {
  id: ProviderId;
  name: string;
  enabled: boolean;
  priority: number;
  speedModel: string;
  deepModel: string;
  baseUrl?: string;
  timeoutMs: number;
};

export type ProviderMetric = {
  providerId: ProviderId;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatencyMs: number;
  tokensIn: number;
  tokensOut: number;
};

export type ChatRequestBody = {
  conversationId?: string | null;
  message: string;
  mode: ChatMode;
  webSearch?: boolean | "auto";
  clientMessages?: ChatMessage[];
  attachments?: UploadedAttachment[];
  preferences?: AssistantPreferences;
};

export type StreamEvent =
  | { type: "activity"; label: string; detail?: string }
  | { type: "conversation"; conversationId: string; title?: string }
  | { type: "sources"; sources: SourceResult[] }
  | { type: "provider"; provider: ProviderId; model: string }
  | { type: "token"; token: string }
  | { type: "done"; messageId?: string }
  | { type: "error"; message: string };
