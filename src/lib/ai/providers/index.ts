import { OpenAICompatibleProvider } from "@/lib/ai/providers/openai-compatible";
import { GeminiProvider } from "@/lib/ai/providers/gemini";
import { CohereProvider } from "@/lib/ai/providers/cohere";
import type { AIProvider } from "@/lib/ai/types";

export function createProviders(): AIProvider[] {
  return [
    new OpenAICompatibleProvider({
      id: "groq",
      displayName: "Groq",
      apiKeyEnv: "GROQ_API_KEY",
      defaultBaseUrl: "https://api.groq.com/openai/v1",
    }),
    new OpenAICompatibleProvider({
      id: "openrouter",
      displayName: "OpenRouter",
      apiKeyEnv: "OPENROUTER_API_KEY",
      defaultBaseUrl: "https://openrouter.ai/api/v1",
      extraHeaders: () => ({
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
        "X-Title": "Truqpedia",
      }),
    }),
    new GeminiProvider(),
    new CohereProvider(),
    new OpenAICompatibleProvider({
      id: "grok",
      displayName: "Grok / xAI",
      apiKeyEnv: "XAI_API_KEY",
      defaultBaseUrl: "https://api.x.ai/v1",
    }),
  ];
}

