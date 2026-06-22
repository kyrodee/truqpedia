import { createRequire } from "module";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { optionalEnv } from "@/lib/utils";

const require = createRequire(import.meta.url);

export type KnowledgeChunkInput = {
  content: string;
  metadata: Record<string, string | number | boolean | string[]>;
};

// 1. Recursive text splitter for PDFs/Documents
export function splitTextRecursively(text: string, chunkSize = 1000, chunkOverlap = 200): string[] {
  return splitTextIntoChunks(text, { parser: "plain_text" }, chunkSize, chunkOverlap).map(
    (chunk) => chunk.content,
  );
}

export function splitTextIntoChunks(
  text: string,
  baseMetadata: Record<string, string | number | boolean | string[]> = {},
  chunkSize = 1000,
  chunkOverlap = 200,
): KnowledgeChunkInput[] {
  const chunks: string[] = [];
  const normalizedText = text.replace(/\r\n/g, "\n").trim();
  let start = 0;

  while (start < normalizedText.length) {
    const end = Math.min(start + chunkSize, normalizedText.length);
    let chunk = normalizedText.slice(start, end);

    if (end < normalizedText.length) {
      // Try to find a logical breaking point (paragraph, sentence, or line break)
      const lastParagraph = chunk.lastIndexOf("\n\n");
      const lastSentence = chunk.lastIndexOf(". ");
      const lastLine = chunk.lastIndexOf("\n");
      let breakIndex = -1;

      if (lastParagraph > chunkSize * 0.6) {
        breakIndex = lastParagraph + 2;
      } else if (lastSentence > chunkSize * 0.7) {
        breakIndex = lastSentence + 2;
      } else if (lastLine > chunkSize * 0.8) {
        breakIndex = lastLine + 1;
      }

      if (breakIndex !== -1) {
        chunk = chunk.slice(0, breakIndex);
      }
    }

    if (chunk.trim()) {
      chunks.push(chunk.trim());
    }

    start += chunk.length - chunkOverlap;

    if (chunk.length <= chunkOverlap) {
      break; // Safe check to prevent infinite loop
    }
  }

  return chunks.map((content, index) => ({
    content,
    metadata: {
      ...baseMetadata,
      chunk_index: index,
      content_length: content.length,
      references: extractPartReferences(content),
    },
  }));
}

// 2. Excel/CSV parser (row-based chunking)
export function parseExcelOrCsv(buffer: Buffer): string[] {
  return parseExcelOrCsvChunks(buffer).map((chunk) => chunk.content);
}

export function parseExcelOrCsvChunks(buffer: Buffer): KnowledgeChunkInput[] {
  const xlsx = require("xlsx") as typeof import("xlsx");
  const workbook = xlsx.read(buffer, { type: "buffer" });
  const chunks: KnowledgeChunkInput[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: "" }) as Record<string, unknown>[];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const fields = Object.entries(row)
        .filter(([, val]) => val !== null && val !== undefined && val !== "")
        .map(([key, val]) => `[${key}: ${val}]`)
        .join(" ");

      if (fields.trim()) {
        // Formatos específicos para o RAG, relacionando o catálogo e a linha da tabela
        const content = `Catalogo: ${sheetName} | Linha ${i + 2}: ${fields}`;
        chunks.push({
          content,
          metadata: {
            parser: "spreadsheet",
            sheet_name: sheetName,
            row_number: i + 2,
            chunk_index: chunks.length,
            content_length: content.length,
            references: extractPartReferences(content),
          },
        });
      }
    }
  }

  return chunks;
}

// 3. PDF parser wrapper
export async function parsePdf(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  try {
    const data = await parser.getText();
    return data.text || "";
  } finally {
    await parser.destroy();
  }
}

// 4. Gemini text-embedding-004 generator (with batch support)
export async function generateGeminiEmbeddings(texts: string[]): Promise<number[][]> {
  const apiKey = optionalEnv("GEMINI_API_KEY");
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured in environment variables.");
  }

  const batchSize = 100;
  const embeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const requests = batch.map((text) => ({
      model: "models/text-embedding-004",
      content: {
        parts: [{ text }],
      },
    }));

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:batchEmbedContents?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ requests }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini embedding request failed: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as { embeddings?: Array<{ values: number[] }> };
    if (!data.embeddings || data.embeddings.length === 0) {
      throw new Error("No embeddings returned from Gemini API.");
    }

    embeddings.push(...data.embeddings.map((emb) => emb.values));
  }

  return embeddings;
}

// 5. Core worker to process document and store chunks
export async function processDocumentAsset(input: {
  supabase: SupabaseClient<Database>;
  documentId: string;
  collectionId: string;
  userId: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
}) {
  const updateStatus = async (status: "processing" | "ready" | "failed", metadata: Record<string, unknown> = {}) => {
    await input.supabase
      .from("document_assets")
      .update({
        status,
        metadata: {
          ...metadata,
          updated_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.documentId);
  };

  try {
    // Stage 1: Downloading from Storage
    await updateStatus("processing", { stage: "downloading", progress: 10 });
    const { data: fileData, error: downloadError } = await input.supabase.storage
      .from("document-assets")
      .download(input.storagePath);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file from storage: ${downloadError?.message ?? "Empty file"}`);
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Stage 2: Extracting Text
    await updateStatus("processing", { stage: "extracting_text", progress: 30 });
    let chunks: KnowledgeChunkInput[] = [];

    const isCsvOrExcel =
      input.mimeType.includes("csv") ||
      input.mimeType.includes("excel") ||
      input.mimeType.includes("spreadsheetml") ||
      /\.(xlsx|xls|csv)$/i.test(input.fileName);

    if (isCsvOrExcel) {
      chunks = parseExcelOrCsvChunks(buffer);
    } else if (input.mimeType.includes("pdf") || /\.pdf$/i.test(input.fileName)) {
      const fullText = await parsePdf(buffer);
      if (!fullText.trim()) {
        throw new Error("Could not extract any readable text from the PDF file.");
      }
      chunks = splitTextIntoChunks(fullText, { parser: "pdf" });
    } else {
      // Treat as plain text
      const fullText = buffer.toString("utf-8");
      if (!fullText.trim()) {
        throw new Error("File is empty.");
      }
      chunks = splitTextIntoChunks(fullText, { parser: "plain_text" });
    }

    if (chunks.length === 0) {
      throw new Error("Document yielded 0 chunks of text.");
    }

    // Stage 3: Generating Embeddings
    await updateStatus("processing", {
      stage: "generating_embeddings",
      progress: 60,
      total_chunks: chunks.length,
    });

    const embeddings = await generateGeminiEmbeddings(
      chunks.map((chunk) => chunk.content),
    );

    // Stage 4: Storing in database
    await updateStatus("processing", {
      stage: "storing_chunks",
      progress: 80,
      total_chunks: chunks.length,
    });

    // Clean up any existing chunks for this document first (to support reprocessing)
    await input.supabase
      .from("knowledge_chunks")
      .delete()
      .eq("document_id", input.documentId);

    const rowsToInsert = chunks.map((chunk, index) => ({
      collection_id: input.collectionId,
      document_id: input.documentId,
      owner_user_id: input.userId,
      content: chunk.content,
      embedding: embeddings[index], // Supabase vector column uses array representation
      metadata: {
        ...chunk.metadata,
        file_name: input.fileName,
        chunk_index: index,
        total_chunks: chunks.length,
      },
    }));

    // Insert in batches of 100 rows to prevent query payload limits
    const batchSize = 100;
    for (let i = 0; i < rowsToInsert.length; i += batchSize) {
      const batch = rowsToInsert.slice(i, i + batchSize);
      const { error: insertError } = await input.supabase
        .from("knowledge_chunks")
        .insert(batch);

      if (insertError) {
        throw new Error(`Failed to store chunks in database: ${insertError.message}`);
      }
    }

    // Stage 5: Done!
    await updateStatus("ready", {
      total_chunks: chunks.length,
      processed_at: new Date().toISOString(),
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown RAG processing error";
    await updateStatus("failed", {
      error: errorMessage,
      failed_at: new Date().toISOString(),
    });
    throw err;
  }
}

export function extractPartReferences(text: string) {
  const matches =
    text.match(/\b(?:[A-Z]{1,5}[-\s]?\d{3,}[A-Z0-9-]*|\d{6,14})\b/gi) ?? [];
  const seen = new Set<string>();
  const references: string[] = [];

  for (const match of matches) {
    const normalized = /^e\s+\d/i.test(match)
      ? match.replace(/^e\s+/i, "").trim().toUpperCase()
      : match.replace(/\s+/g, "").trim().toUpperCase();

    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    references.push(normalized);
  }

  return references.slice(0, 20);
}
