import { describe, expect, it } from "vitest";
import { parseDuckDuckGoResults } from "@/lib/search/web-search";

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
});
