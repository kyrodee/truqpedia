import { describe, expect, it } from "vitest";
import { buildProviderMessages } from "@/lib/ai/model-router";
import { classifyChatIntent } from "@/lib/ai/intent";
import { decideWebSearch } from "@/lib/search/auto-search";
import { offlineEvalCases } from "@/lib/ai/evals/cases";

describe("offline AI behavior evals", () => {
  for (const evalCase of offlineEvalCases) {
    it(evalCase.name, () => {
      const intent = classifyChatIntent({ message: evalCase.message });
      const search = decideWebSearch({
        message: evalCase.message,
        attachments: [],
        requested: "auto",
        intent,
      });
      const messages = buildProviderMessages({
        history: [],
        userMessage: evalCase.message,
        sources: [],
        intent,
        searchAttempt: {
          enabled: search.enabled,
          query: search.query,
          sourceCount: 0,
        },
      });
      const systemPrompt = messages[0].content.toLowerCase();

      expect(intent.id).toBe(evalCase.expectedIntent);

      if (evalCase.expectedRisk) {
        expect(intent.riskLevel).toBe(evalCase.expectedRisk);
      }

      if (typeof evalCase.shouldSearch === "boolean") {
        expect(search.enabled).toBe(evalCase.shouldSearch);
      }

      for (const expectedText of evalCase.mustContainInPrompt) {
        expect(systemPrompt).toContain(expectedText.toLowerCase());
      }
    });
  }
});
