import type {
  AIProvider,
  ProviderStream,
  ProviderStreamRequest,
} from "@/lib/ai/types";
import { fetchWithProviderErrors, parseCohereStream } from "@/lib/ai/streaming";
import { optionalEnv } from "@/lib/utils";

export class CohereProvider implements AIProvider {
  readonly id = "cohere" as const;
  readonly displayName = "Cohere";

  isConfigured() {
    return Boolean(optionalEnv("COHERE_API_KEY"));
  }

  async stream(request: ProviderStreamRequest): Promise<ProviderStream> {
    const apiKey = optionalEnv("COHERE_API_KEY");

    if (!apiKey) {
      throw new Error("Cohere API key is not configured.");
    }

    const model =
      request.mode === "speed"
        ? request.config.speedModel
        : request.config.deepModel;

    const response = await fetchWithProviderErrors(
      "https://api.cohere.com/v2/chat",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          stream: true,
          messages: request.messages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
          temperature: request.mode === "speed" ? 0.25 : 0.35,
        }),
      },
      request.config.timeoutMs,
      request.abortSignal,
    );

    return {
      providerId: this.id,
      model,
      tokens: parseCohereStream(response),
    };
  }
}

