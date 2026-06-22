import { describe, expect, it } from "vitest";
import {
  extractQueryReferences,
  knowledgeChunkToSource,
  rankKnowledgeChunks,
} from "@/lib/ai/rag-search";

describe("RAG project search ranking", () => {
  it("extracts normalized query references", () => {
    expect(extractQueryReferences("codigo A 9604600105 e 0002501666")).toEqual([
      "A9604600105",
      "0002501666",
    ]);
  });

  it("boosts chunks that contain the exact part reference", () => {
    const ranked = rankKnowledgeChunks(
      [
        {
          id: "1",
          collection_id: "project",
          document_id: "doc-a",
          content: "Terminal direcao A9604600105 Mercedes Atego",
          metadata: { file_name: "catalogo.xlsx", chunk_index: 0 },
          similarity: 0.65,
        },
        {
          id: "2",
          collection_id: "project",
          document_id: "doc-b",
          content: "Terminal direcao generico Mercedes Atego",
          metadata: { file_name: "catalogo.xlsx", chunk_index: 1 },
          similarity: 0.8,
        },
      ],
      "A 9604600105 serve?",
    );

    expect(ranked[0].id).toBe("1");
    expect(ranked[0].referenceHit).toBe(true);
  });

  it("keeps useful source metadata for the model and UI", () => {
    const [ranked] = rankKnowledgeChunks(
      [
        {
          id: "1",
          collection_id: "project",
          document_id: "doc-a",
          content: "Catalogo: Pecas | Linha 2: [Codigo: FH900]",
          metadata: {
            file_name: "catalogo.xlsx",
            sheet_name: "Pecas",
            row_number: 2,
            chunk_index: 0,
          },
          similarity: 0.91,
        },
      ],
      "FH900",
    );

    const source = knowledgeChunkToSource(ranked, "project");

    expect(source.title).toContain("Pecas, linha 2");
    expect(source.score).toBeGreaterThan(0.8);
    expect(source.metadata).toMatchObject({
      documentId: "doc-a",
      rowNumber: 2,
      referenceHit: true,
    });
  });
});
