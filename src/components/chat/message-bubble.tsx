import { Bot, UserRound, FileText, File, Copy, RotateCcw, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarkdownMessage } from "@/components/markdown/markdown-message";
import { TypingIndicator } from "@/components/chat/typing-indicator";
import { cn } from "@/lib/utils";
import type { UiMessage, SourceResult } from "./types";

type MessageBubbleProps = {
  message: UiMessage;
  onCopy?: () => void;
  onOpenArtifact?: () => void;
  onRegenerate?: () => void;
};

export function MessageBubble({
  message,
  onCopy,
  onOpenArtifact,
  onRegenerate,
}: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "soft-enter flex gap-2 font-sans sm:gap-3",
        isUser && "justify-end",
      )}
    >
      {!isUser ? (
        <div className="mt-1 hidden size-8 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground min-[420px]:grid">
          <Bot className="size-4" />
        </div>
      ) : null}
      <div
        className={cn(
          "min-w-0 max-w-full rounded-lg px-3 py-3 text-sm shadow-sm min-[420px]:max-w-[calc(100%-2.5rem)] sm:max-w-[86%] sm:px-4",
          isUser
            ? "bg-user-message text-user-message-foreground"
            : "border border-border bg-background text-foreground",
          message.status === "error" && "border-destructive text-destructive",
        )}
      >
        {message.content ? (
          isUser ? (
            <div className="whitespace-pre-wrap leading-6">{message.content}</div>
          ) : (
            <div className="relative">
              <MarkdownMessage content={message.content} />
              {message.status === "streaming" ? (
                <span className="typing-caret ml-1 inline-block h-4 w-px translate-y-0.5 bg-foreground" />
              ) : null}
            </div>
          )
        ) : message.status === "searching" ? (
          <ActivityTimeline activities={message.activities ?? []} />
        ) : (
          <TypingIndicator />
        )}

        {isUser && message.attachments?.length ? (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-white/15 pt-3">
            {message.attachments.map((attachment, index) => (
              <span
                key={`${attachment.name}-${index}`}
                className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-white/10 px-2 py-1 text-xs"
              >
                {attachment.text ? (
                  <FileText className="size-3.5 shrink-0" />
                ) : (
                  <File className="size-3.5 shrink-0" />
                )}
                <span className="truncate">{attachment.name}</span>
              </span>
            ))}
          </div>
        ) : null}

        {!isUser && message.sources?.length ? (
          <SourceCards sources={message.sources} />
        ) : null}

        {!isUser && message.content ? (
          <div
            className="mt-3 flex flex-wrap gap-1 border-t border-border pt-2"
          >
            {onCopy ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-[11px]"
                onClick={onCopy}
              >
                <Copy className="size-3" />
                Copiar
              </Button>
            ) : null}
            {onOpenArtifact ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-[11px]"
                onClick={onOpenArtifact}
              >
                <FileText className="size-3" />
                Documento
              </Button>
            ) : null}
            {onRegenerate ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-[11px]"
                onClick={onRegenerate}
              >
                <RotateCcw className="size-3" />
                Refazer
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      {isUser ? (
        <div className="mt-1 hidden size-8 shrink-0 place-items-center rounded-md bg-muted min-[420px]:grid">
          <UserRound className="size-4" />
        </div>
      ) : null}
    </div>
  );
}

function ActivityTimeline({
  activities,
}: {
  activities: Array<{ label: string; detail?: string }>;
}) {
  if (activities.length === 0) {
    return <TypingIndicator />;
  }

  return (
    <div className="space-y-2 rounded-md border border-border bg-muted/70 p-3 text-sm">
      {activities.slice(-4).map((activity, index) => {
        const active = index === activities.slice(-4).length - 1;

        return (
          <div key={`${activity.label}-${index}`} className="flex gap-2">
            <span
              className={cn(
                "mt-1 grid size-4 shrink-0 place-items-center rounded-full border border-border bg-background",
                active && "border-primary",
              )}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full bg-muted-foreground",
                  active && "animate-pulse bg-primary",
                )}
              />
            </span>
            <span className="min-w-0">
              <span className="block font-medium text-foreground">
                {activity.label}
              </span>
              {activity.detail ? (
                <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                  {activity.detail}
                </span>
              ) : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function SourceCards({ sources }: { sources: SourceResult[] }) {
  return (
    <details className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground">
      <summary className="cursor-pointer select-none list-none">
        <span className="inline-flex items-center gap-1.5 rounded bg-muted px-2 py-1">
          <ExternalLink className="size-3" />
          Fontes ({Math.min(sources.length, 4)})
        </span>
      </summary>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {sources.slice(0, 4).map((source, index) => (
          <a
            key={`${source.url}-${index}`}
            href={source.url}
            target="_blank"
            rel="noreferrer"
            className="max-w-full truncate rounded border border-border bg-muted/50 px-2 py-1 hover:bg-muted hover:text-foreground"
            title={source.title || source.url}
          >
            [{index + 1}] {source.title || source.url}
          </a>
        ))}
      </div>
    </details>
  );
}
