import { describe, expect, it } from "vitest";
import {
  buildSearchQueries,
  parseDuckDuckGoResults,
  rankSearchResults,
} from "@/lib/search/web-search";

describe("parseDuckDuckGoResults", () => {
  it("extracts and unwraps DuckDuckGo result links", () => {
    const html = `
      <div class="result results_links results_links_deep web-result">
        <a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fpecas%3Fa%3D1%26b%3D2">Pecas &amp; caminhoes</a>
        <a class="result__snippet">Resumo com <b>destaque</b>.</a>
      </div>
    `;

    expect(parseDuckDuckGoResults(html)).toEqual([
      {
        title: "Pecas & caminhoes",
        url: "https://example.com/pecas?a=1&b=2",
        snippet: "Resumo com destaque.",
        provider: "DuckDuckGo",
      },
    ]);
  });

  it("builds targeted reference queries", () => {
    expect(buildSearchQueries("A 9604600105 serve no Atego", "a9604600105")).toEqual(
      expect.arrayContaining([
        "a9604600105",
        "\"a9604600105\" catalogo",
      ]),
    );
  });

  it("filters reference searches to sources that mention the reference", () => {
    const ranked = rankSearchResults(
      [
        {
          title: "Catalogo terminal A9604600105",
          url: "https://parts.example.com/a9604600105",
          snippet: "Terminal direcao A9604600105 para conferir.",
        },
        {
          title: "Catalogo generico",
          url: "https://parts.example.com/generic",
          snippet: "Catalogo de terminais sem codigo.",
        },
      ],
      "a9604600105",
    );

    expect(ranked).toHaveLength(1);
    expect(ranked[0].metadata?.referenceMatch).toBe(true);
  });
});
