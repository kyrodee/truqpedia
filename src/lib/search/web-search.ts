import type { SourceResult } from "@/lib/types";
import { WEB_SEARCH_TIMEOUT_MS } from "@/lib/server-config";
import { optionalEnv } from "@/lib/utils";

type SearchProvider = "tavily" | "brave" | "serper" | "duckduckgo";

export async function searchWeb(query: string): Promise<SourceResult[]> {
  const providers: SearchProvider[] = [
    "tavily",
    "brave",
    "serper",
    "duckduckgo",
  ];

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

  if (provider === "serper") {
    return searchSerper(query);
  }

  return searchDuckDuckGo(query);
}

async function searchTavily(query: string): Promise<SourceResult[]> {
  const apiKey = optionalEnv("TAVILY_API_KEY");

  if (!apiKey) {
    return [];
  }

  const response = await fetchWithTimeout("https://api.tavily.com/search", {
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

  const response = await fetchWithTimeout(
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

  const response = await fetchWithTimeout("https://google.serper.dev/search", {
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

async function searchDuckDuckGo(query: string): Promise<SourceResult[]> {
  const response = await fetchWithTimeout(
    `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
    {
      headers: {
        Accept: "text/html",
        "User-Agent": "Truqpedia/1.0 (+https://truqpedia.local)",
      },
    },
  );

  if (!response.ok) {
    return [];
  }

  return parseDuckDuckGoResults(await response.text()).slice(0, 5);
}

export function parseDuckDuckGoResults(html: string): SourceResult[] {
  const blocks = html.split(/<div class="result results_links[^"]*">/i).slice(1);

  return blocks
    .map<SourceResult | null>((block) => {
      const link = block.match(
        /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i,
      );

      if (!link) {
        return null;
      }

      const snippet = block.match(
        /<(?:a|div)[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/(?:a|div)>/i,
      );
      const url = normalizeDuckDuckGoUrl(decodeHtml(link[1] ?? ""));
      const title = cleanHtmlText(link[2] ?? "");

      if (!url || !title) {
        return null;
      }

      return {
        title,
        url,
        snippet: cleanHtmlText(snippet?.[1] ?? ""),
        provider: "DuckDuckGo",
      };
    })
    .filter((result): result is SourceResult => Boolean(result));
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WEB_SEARCH_TIMEOUT_MS);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeDuckDuckGoUrl(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl, "https://duckduckgo.com");
    const redirected = parsed.searchParams.get("uddg");
    const url = redirected ? new URL(redirected) : parsed;

    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : "";
  } catch {
    return "";
  }
}

function cleanHtmlText(html: string) {
  return decodeHtml(html.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();
}

function decodeHtml(value: string) {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };

  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, code) => {
    if (code[0] === "#") {
      const radix = code[1]?.toLowerCase() === "x" ? 16 : 10;
      const digits = radix === 16 ? code.slice(2) : code.slice(1);
      const parsed = Number.parseInt(digits, radix);

      return Number.isFinite(parsed) ? String.fromCodePoint(parsed) : entity;
    }

    return named[code.toLowerCase()] ?? entity;
  });
}

