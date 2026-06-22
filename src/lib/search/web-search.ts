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
  const reference = extractReferenceFromQuery(query);
  const queries = buildSearchQueries(query, reference);
  const collected: SourceResult[] = [];

  for (const provider of providers) {
    for (const candidateQuery of queries) {
      try {
        const results = await runSearch(provider, candidateQuery);
        collected.push(
          ...results.map((result) => ({
            ...result,
            metadata: {
              ...(result.metadata ?? {}),
              query: candidateQuery,
            },
          })),
        );

        const ranked = rankSearchResults(collected, reference);

        if (ranked.length >= 5) {
          return ranked.slice(0, 5);
        }
      } catch {
        continue;
      }
    }
  }

  return rankSearchResults(collected, reference).slice(0, 5);
}

function extractReferenceFromQuery(query: string) {
  const numericReference = query.match(/\b\d{6,14}\b/)?.[0];

  if (numericReference) {
    return normalizeReference(numericReference);
  }

  const codeReference = query.match(/\b[A-Z]{1,4}[-\s]?\d{3,}[A-Z0-9-]*\b/i)?.[0];

  return codeReference ? normalizeReference(codeReference) : null;
}

export function rankSearchResults(
  results: SourceResult[],
  reference: string | null = null,
) {
  const deduped = dedupeResults(results);
  const ranked = deduped
    .map((result) => {
      const referenceMatch = reference
        ? normalizeReference(
            `${result.title} ${result.snippet} ${result.url}`,
          ).includes(reference)
        : false;
      const domainScore = scoreSourceDomain(result.url);
      const snippetScore = result.snippet.length > 80 ? 0.04 : 0;
      const score = domainScore + snippetScore + (referenceMatch ? 1 : 0);

      return {
        ...result,
        score: Number(score.toFixed(4)),
        metadata: {
          ...(result.metadata ?? {}),
          referenceMatch,
          sourceQuality: domainScore,
        },
      };
    })
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  if (!reference) {
    return ranked;
  }

  return ranked.filter((result) => result.metadata?.referenceMatch === true);
}

export function buildSearchQueries(query: string, reference: string | null) {
  const clean = query.replace(/\s+/g, " ").trim();

  if (!reference) {
    return [clean];
  }

  return uniqueQueries([
    reference,
    `"${reference}" catalogo`,
    `"${reference}" OEM equivalente`,
    clean,
  ]);
}

function normalizeReference(value: string) {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function dedupeResults(results: SourceResult[]) {
  const seen = new Set<string>();
  const deduped: SourceResult[] = [];

  for (const result of results) {
    const key = normalizeResultUrl(result.url);

    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(result);
  }

  return deduped;
}

function normalizeResultUrl(url: string) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.searchParams.sort();
    return parsed.toString().toLowerCase();
  } catch {
    return "";
  }
}

function scoreSourceDomain(url: string) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();

    if (
      [
        "bosch",
        "mahle",
        "mann-filter",
        "fleetguard",
        "cummins",
        "volvo",
        "scania",
        "mercedes-benz",
        "iveco",
        "daf",
        "vw",
      ].some((domainPart) => hostname.includes(domainPart))
    ) {
      return 0.3;
    }

    if (hostname.includes("catalog") || hostname.includes("parts")) {
      return 0.18;
    }

    return 0.08;
  } catch {
    return 0;
  }
}

function uniqueQueries(queries: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const query of queries) {
    const clean = query.replace(/\s+/g, " ").trim();
    const key = clean.toLowerCase();

    if (!clean || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(clean);
  }

  return result.slice(0, 4);
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

