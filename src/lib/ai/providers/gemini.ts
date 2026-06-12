import type {
  AIProvider,
  ProviderStream,
  ProviderStreamRequest,
} from "@/lib/ai/types";
import { fetchWithProviderErrors, parseGeminiStream } from "@/lib/ai/streaming";
import { optionalEnv } from "@/lib/utils";

export class GeminiProvider implements AIProvider {
  readonly id = "gemini" as const;
  readonly displayName = "Gemini";

  isConfigured() {
    return Boolean(optionalEnv("GEMINI_API_KEY"));
  }

  async stream(request: ProviderStreamRequest): Promise<ProviderStream> {
    const apiKey = optionalEnv("GEMINI_API_KEY");

    if (!apiKey) {
      throw new Error("Gemini API key is not configured.");
    }

    const model =
      request.mode === "speed"
        ? request.config.speedModel
        : request.config.deepModel;

    const systemInstruction = request.messages.find(
      (message) => message.role === "system",
    );

    const contents = request.messages
      .filter((message) => message.role !== "system")
      .map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }],
      }));

    const response = await fetchWithProviderErrors(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          systemInstruction: systemInstruction
            ? { parts: [{ text: systemInstruction.content }] }
            : undefined,
          contents,
          generationConfig: {
            temperature: request.mode === "speed" ? 0.25 : 0.35,
          },
        }),
      },
      request.config.timeoutMs,
      request.abortSignal,
    );

    return {
      providerId: this.id,
      model,
      tokens: parseGeminiStream(response),
    };
  }
}

