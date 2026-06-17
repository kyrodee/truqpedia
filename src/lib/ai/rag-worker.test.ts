import { describe, expect, it } from "vitest";
import { splitTextRecursively, parseExcelOrCsv } from "./rag-worker";
import * as xlsx from "xlsx";

describe("rag-worker.ts core logic", () => {
  describe("splitTextRecursively", () => {
    it("splits a long text into chunks of specified size", () => {
      const text = "A".repeat(2500);
      const chunks = splitTextRecursively(text, 1000, 200);

      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[0].length).toBeLessThanOrEqual(1000);
    });

    it("tries to break at logical points like newlines", () => {
      const paragraph1 = "Este é o primeiro parágrafo técnico sobre motores.";
      const paragraph2 = "Este é o segundo parágrafo sobre transmissão.";
      const text = `${paragraph1}\n\n${paragraph2}`;

      const chunks = splitTextRecursively(text, 80, 10);
      expect(chunks[0]).toBe(paragraph1);
      expect(chunks[1]).toContain(paragraph2);
    });
  });

  describe("parseExcelOrCsv", () => {
    it("parses sheets and chunks them row by row", () => {
      // Create a dummy workbook in memory
      const ws = xlsx.utils.json_to_sheet([
        { Codigo: "A9604600105", Descricao: "Terminal Direcao", Preco: 450 },
        { Codigo: "FH900", Descricao: "Farol Volvo", Preco: 1200 },
      ]);
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, "Pecas");

      const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
      const chunks = parseExcelOrCsv(buffer);

      expect(chunks.length).toBe(2);
      expect(chunks[0]).toContain("Catálogo: Pecas");
      expect(chunks[0]).toContain("Linha 2");
      expect(chunks[0]).toContain("[Codigo: A9604600105]");
      expect(chunks[0]).toContain("[Descricao: Terminal Direcao]");
      expect(chunks[0]).toContain("[Preco: 450]");

      expect(chunks[1]).toContain("[Codigo: FH900]");
      expect(chunks[1]).toContain("[Descricao: Farol Volvo]");
    });
  });
});
