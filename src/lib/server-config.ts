import { optionalEnv } from "@/lib/utils";

export const AI_PROVIDER_ENV_NAMES = [
  "GROQ_API_KEY",
] as const;

export const SEARCH_PROVIDER_ENV_NAMES = [
  "TAVILY_API_KEY",
  "BRAVE_SEARCH_API_KEY",
  "SERPER_API_KEY",
] as const;

export const MAX_CHAT_PAYLOAD_BYTES = readPositiveIntEnv(
  "MAX_CHAT_PAYLOAD_BYTES",
  1_000_000,
  { min: 10_000, max: 4_000_000 },
);

export const CHAT_RATE_LIMIT_REQUESTS = readPositiveIntEnv(
  "CHAT_RATE_LIMIT_REQUESTS",
  30,
  { min: 1, max: 1_000 },
);

export const CHAT_RATE_LIMIT_WINDOW_MS = readPositiveIntEnv(
  "CHAT_RATE_LIMIT_WINDOW_MS",
  10 * 60 * 1000,
  { min: 1_000, max: 60 * 60 * 1000 },
);

export const WEB_SEARCH_TIMEOUT_MS = readPositiveIntEnv(
  "WEB_SEARCH_TIMEOUT_MS",
  8_000,
  { min: 1_000, max: 30_000 },
);

export function hasAnyAiProviderKey() {
  return AI_PROVIDER_ENV_NAMES.some((name) => Boolean(optionalEnv(name)));
}

export function getSearchProviderStatus() {
  const configured = SEARCH_PROVIDER_ENV_NAMES.filter((name) =>
    Boolean(optionalEnv(name)),
  ).map((name) => {
    if (name === "TAVILY_API_KEY") {
      return "tavily";
    }

    if (name === "BRAVE_SEARCH_API_KEY") {
      return "brave";
    }

    return "serper";
  });

  return {
    configured,
    fallback: "duckduckgo",
    available: true,
  };
}

export function getProductionConfigStatus() {
  return {
    supabaseUrl: Boolean(optionalEnv("NEXT_PUBLIC_SUPABASE_URL")),
    supabaseAnonKey: Boolean(optionalEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")),
    supabaseServiceRoleKey: Boolean(optionalEnv("SUPABASE_SERVICE_ROLE_KEY")),
    appUrl: Boolean(optionalEnv("NEXT_PUBLIC_APP_URL")),
    aiProvider: hasAnyAiProviderKey(),
    webSearch: getSearchProviderStatus().available,
  };
}

function readPositiveIntEnv(
  name: string,
  fallback: number,
  options: { min: number; max: number },
) {
  const value = optionalEnv(name);

  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    return fallback;
  }

  return Math.min(options.max, Math.max(options.min, parsed));
}
