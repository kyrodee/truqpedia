import type { SourceResult } from "@/lib/types";
import { optionalEnv } from "@/lib/utils";

type SearchProvider = "tavily" | "brave" | "serper";

export async function searchWeb(query: string): Promise<SourceResult[]> {
  const providers: SearchProvider[] = ["tavily", "brave", "serper"];

  for (const provider of providers) {
    try {
      const results = await runSearch(provider, query);

      if (results.length > 0) {
        return results.slice(0, 5);
      }
    } catch {
      continue;
    }
  }

  return [];
}

async function runSearch(provider: SearchProvider, query: string) {
  if (provider === "tavily") {
    return searchTavily(query);
  }

  if (provider === "brave") {
    return searchBrave(query);
  }

  return searchSerper(query);
}

async function searchTavily(query: string): Promise<SourceResult[]> {
  const apiKey = optionalEnv("TAVILY_API_KEY");

  if (!apiKey) {
    return [];
  }

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "advanced",
      max_results: 5,
      include_answer: false,
    }),
  });

  if (!response.ok) {
    return [];
  }

  const json = (await response.json()) as {
    results?: Array<{ title?: string; url?: string; content?: string }>;
  };

  return (
    json.results?.map((result) => ({
      title: result.title ?? result.url ?? "Fonte",
      url: result.url ?? "",
      snippet: result.content ?? "",
      provider: "Tavily",
    })) ?? []
  ).filter((result) => result.url);
}

async function searchBrave(query: string): Promise<SourceResult[]> {
  const apiKey = optionalEnv("BRAVE_SEARCH_API_KEY");

  if (!apiKey) {
    return [];
  }

  const response = await fetch(
    `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`,
    {
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": apiKey,
      },
    },
  );

  if (!response.ok) {
    return [];
  }

  const json = (await response.json()) as {
    web?: {
      results?: Array<{ title?: string; url?: string; description?: string }>;
    };
  };

  return (
    json.web?.results?.map((result) => ({
      title: result.title ?? result.url ?? "Fonte",
      url: result.url ?? "",
      snippet: result.description ?? "",
      provider: "Brave Search",
    })) ?? []
  ).filter((result) => result.url);
}

async function searchSerper(query: string): Promise<SourceResult[]> {
  const apiKey = optionalEnv("SERPER_API_KEY");

  if (!apiKey) {
    return [];
  }

  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
    },
    body: JSON.stringify({ q: query, num: 5 }),
  });

  if (!response.ok) {
    return [];
  }

  const json = (await response.json()) as {
    organic?: Array<{ title?: string; link?: string; snippet?: string }>;
  };

  return (
    json.organic?.map((result) => ({
      title: result.title ?? result.link ?? "Fonte",
      url: result.link ?? "",
      snippet: result.snippet ?? "",
      provider: "Serper",
    })) ?? []
  ).filter((result) => result.url);
}

