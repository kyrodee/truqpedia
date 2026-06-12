import type {
  ChatMode,
  ChatMessage,
  ProviderId,
  ProviderRuntimeConfig,
  SourceResult,
} from "@/lib/types";

export type ProviderMessage = Pick<ChatMessage, "role" | "content">;

export type ProviderStreamRequest = {
  mode: ChatMode;
  messages: ProviderMessage[];
  sources: SourceResult[];
  config: ProviderRuntimeConfig;
  abortSignal?: AbortSignal;
};

export type ProviderStream = {
  providerId: ProviderId;
  model: string;
  tokens: AsyncGenerator<string>;
};

export interface AIProvider {
  id: ProviderId;
  displayName: string;
  isConfigured(): boolean;
  stream(request: ProviderStreamRequest): Promise<ProviderStream>;
}

export type ProviderAttemptResult = {
  providerId: ProviderId;
  model: string;
  latencyMs: number;
  tokens: string;
  failed: boolean;
  errorMessage?: string;
};

