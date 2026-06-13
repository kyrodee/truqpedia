import { NextResponse } from "next/server";

type JsonBodyResult =
  | { ok: true; data: unknown }
  | { ok: false; response: NextResponse };

const encoder = new TextEncoder();

export async function readJsonBody(
  request: Request,
  maxBytes: number,
): Promise<JsonBodyResult> {
  const contentLength = request.headers.get("content-length");

  if (contentLength) {
    const parsedLength = Number(contentLength);

    if (Number.isFinite(parsedLength) && parsedLength > maxBytes) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Payload muito grande." },
          { status: 413 },
        ),
      };
    }
  }

  const rawBody = await request.text().catch(() => "");

  if (encoder.encode(rawBody).byteLength > maxBytes) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Payload muito grande." },
        { status: 413 },
      ),
    };
  }

  try {
    return { ok: true, data: rawBody ? JSON.parse(rawBody) : null };
  } catch {
    return { ok: true, data: null };
  }
}
