import { sleep } from "@/lib/utils";

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly retryable = true,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export function withTimeout(timeoutMs: number, signal?: AbortSignal) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener("abort", () => controller.abort(), { once: true });
    }
  }

  return {
    signal: controller.signal,
    done() {
      clearTimeout(timeout);
    },
  };
}

export async function fetchWithProviderErrors(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
  signal?: AbortSignal,
) {
  const timer = withTimeout(timeoutMs, signal);

  try {
    const response = await fetch(input, {
      ...init,
      signal: timer.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      const retryable =
        response.status === 408 ||
        response.status === 409 ||
        response.status === 425 ||
        response.status === 429 ||
        response.status >= 500;

      throw new ProviderError(
        `${response.status} ${response.statusText}${body ? `: ${body.slice(0, 320)}` : ""}`,
        retryable,
        response.status,
      );
    }

    if (!response.body) {
      throw new ProviderError("Provider returned an empty stream.", true);
    }

    return response;
  } catch (error) {
    if (error instanceof ProviderError) {
      throw error;
    }

    const message =
      error instanceof Error ? error.message : "Unknown provider request error.";

    throw new ProviderError(message, true);
  } finally {
    timer.done();
  }
}

export async function* parseOpenAICompatibleStream(response: Response) {
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  if (!reader) {
    return;
  }

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const rawLine of lines) {
      const line = rawLine.trim();

      if (!line.startsWith("data:")) {
        continue;
      }

      const payload = line.slice(5).trim();

      if (payload === "[DONE]") {
        return;
      }

      try {
        const json = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const token = json.choices?.[0]?.delta?.content;

        if (token) {
          yield token;
        }
      } catch {
        continue;
      }
    }
  }
}

export async function* parseGeminiStream(response: Response) {
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  if (!reader) {
    return;
  }

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const rawLine of lines) {
      const line = rawLine.trim();

      if (!line.startsWith("data:")) {
        continue;
      }

      try {
        const json = JSON.parse(line.slice(5).trim()) as {
          candidates?: Array<{
            content?: { parts?: Array<{ text?: string }> };
          }>;
        };
        const token = json.candidates?.[0]?.content?.parts?.[0]?.text;

        if (token) {
          yield token;
        }
      } catch {
        continue;
      }
    }
  }
}

export async function* parseCohereStream(response: Response) {
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  if (!reader) {
    return;
  }

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const rawLine of lines) {
      const line = rawLine.trim();

      if (!line.startsWith("data:")) {
        continue;
      }

      try {
        const json = JSON.parse(line.slice(5).trim()) as {
          type?: string;
          delta?: { message?: { content?: { text?: string } } };
        };
        const token = json.delta?.message?.content?.text;

        if (token) {
          yield token;
        }
      } catch {
        continue;
      }
    }
  }
}

export async function* streamFromText(text: string) {
  const chunks = text.match(/.{1,18}(\s|$)/g) ?? [text];

  for (const chunk of chunks) {
    await sleep(12);
    yield chunk;
  }
}

