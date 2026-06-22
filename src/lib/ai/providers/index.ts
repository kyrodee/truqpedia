import { OpenAICompatibleProvider } from "@/lib/ai/providers/openai-compatible";
import type { AIProvider } from "@/lib/ai/types";

export function createProviders(): AIProvider[] {
  return [
    new OpenAICompatibleProvider({
      id: "groq",
      displayName: "Groq",
      apiKeyEnv: "GROQ_API_KEY",
      defaultBaseUrl: "https://api.groq.com/openai/v1",
    }),
  ];
}
