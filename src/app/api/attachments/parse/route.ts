import { NextResponse } from "next/server";
import { parsePdf, parseExcelOrCsv } from "@/lib/ai/rag-worker";
import { logError } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = file.type || "";
    const fileName = file.name || "";

    let text = "";

    const isCsvOrExcel =
      mimeType.includes("csv") ||
      mimeType.includes("excel") ||
      mimeType.includes("spreadsheetml") ||
      /\.(xlsx|xls|csv)$/i.test(fileName);

    if (isCsvOrExcel) {
      const rows = parseExcelOrCsv(buffer);
      text = rows.join("\n");
    } else if (mimeType.includes("pdf") || /\.pdf$/i.test(fileName)) {
      text = await parsePdf(buffer);
    } else {
      // Plain text fallback
      text = buffer.toString("utf-8");
    }

    const maxChars = 60000;
    const truncated = text.length > maxChars;

    return NextResponse.json({
      name: fileName,
      type: mimeType || "text/plain",
      size: file.size,
      text: text.slice(0, maxChars),
      truncated,
    });
  } catch (error) {
    logError("attachments.parse.failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao extrair texto do arquivo." },
      { status: 500 }
    );
  }
}
