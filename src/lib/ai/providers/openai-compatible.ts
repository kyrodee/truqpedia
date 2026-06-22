import type {
  AIProvider,
  ProviderStream,
  ProviderStreamRequest,
} from "@/lib/ai/types";
import {
  fetchWithProviderErrors,
  parseOpenAICompatibleStream,
} from "@/lib/ai/streaming";
import type { ProviderId } from "@/lib/types";
import { optionalEnv } from "@/lib/utils";

type OpenAICompatibleProviderOptions = {
  id: ProviderId;
  displayName: string;
  apiKeyEnv: string;
  defaultBaseUrl: string;
  extraHeaders?: () => Record<string, string>;
};

export class OpenAICompatibleProvider implements AIProvider {
  readonly id: ProviderId;
  readonly displayName: string;
  private readonly apiKeyEnv: string;
  private readonly defaultBaseUrl: string;
  private readonly extraHeaders?: () => Record<string, string>;

  constructor(options: OpenAICompatibleProviderOptions) {
    this.id = options.id;
    this.displayName = options.displayName;
    this.apiKeyEnv = options.apiKeyEnv;
    this.defaultBaseUrl = options.defaultBaseUrl;
    this.extraHeaders = options.extraHeaders;
  }

  isConfigured() {
    return Boolean(optionalEnv(this.apiKeyEnv));
  }

  async stream(request: ProviderStreamRequest): Promise<ProviderStream> {
    const apiKey = optionalEnv(this.apiKeyEnv);

    if (!apiKey) {
      throw new Error(`${this.displayName} API key is not configured.`);
    }

    const model =
      request.model ??
      (request.mode === "speed"
        ? request.config.speedModel
        : request.config.deepModel);

    const response = await fetchWithProviderErrors(
      `${request.config.baseUrl ?? this.defaultBaseUrl}/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          ...this.extraHeaders?.(),
        },
        body: JSON.stringify({
          model,
          messages: request.messages,
          temperature: request.temperature ?? 0.3,
          stream: true,
        }),
      },
      request.config.timeoutMs,
      request.abortSignal,
    );

    return {
      providerId: this.id,
      model,
      tokens: parseOpenAICompatibleStream(response),
    };
  }
}
