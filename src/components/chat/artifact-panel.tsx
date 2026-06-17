import { useState, useEffect } from "react";
import { Copy, X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { UiArtifact } from "./types";

type ArtifactPanelProps = {
  artifact: UiArtifact | null;
  artifacts: UiArtifact[];
  onClose: () => void;
  onCopy: (content: string) => void;
  onDownload: (artifact: UiArtifact) => void;
  onDuplicate: (artifact: UiArtifact) => void;
  onSelect: (artifactId: string) => void;
  onUpdate: (
    artifactId: string,
    patch: Pick<UiArtifact, "title" | "content">,
  ) => void;
  open: boolean;
};

export function ArtifactPanel({
  artifact,
  artifacts,
  onClose,
  onCopy,
  onDownload,
  onDuplicate,
  onSelect,
  onUpdate,
  open,
}: ArtifactPanelProps) {
  const [mode, setMode] = useState<"preview" | "edit">("preview");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");

  useEffect(() => {
    setDraftTitle(artifact?.title ?? "");
    setDraftContent(artifact?.content ?? "");
    setMode("preview");
  }, [artifact?.id, artifact?.title, artifact?.content]);

  if (!open) {
    return null;
  }

  const dirty =
    Boolean(artifact) &&
    (draftTitle !== artifact?.title || draftContent !== artifact?.content);

  return (
    <div className="soft-enter fixed inset-x-0 bottom-0 z-50 flex h-[92dvh] max-h-[calc(100dvh-0.5rem)] w-full flex-col rounded-t-lg border border-border bg-background shadow-2xl md:inset-y-0 md:left-auto md:right-0 md:h-auto md:w-[min(520px,44vw)] md:rounded-none md:border-y-0 md:border-l lg:relative lg:inset-auto lg:z-30 lg:h-full lg:w-[500px] lg:shadow-none xl:w-[560px]">
      <div className="flex min-h-16 items-center justify-between gap-3 border-b border-border px-3 py-2 sm:px-4">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">Documento</div>
          <div className="truncate text-xs text-muted-foreground">
            Edite, versione e baixe respostas salvas
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {artifact ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDuplicate(artifact)}
                >
                  <Copy />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Duplicar versão</TooltipContent>
            </Tooltip>
          ) : null}
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X />
          </Button>
        </div>
      </div>

      {artifacts.length > 1 ? (
        <div className="border-b border-border p-3">
          <select
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            value={artifact?.id ?? ""}
            onChange={(event) => onSelect(event.target.value)}
          >
            {artifacts.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {artifact ? (
        <>
          <div className="border-b border-border p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                {mode === "edit" ? (
                  <input
                    className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm font-medium outline-none focus:ring-2 focus:ring-ring"
                    value={draftTitle}
                    onChange={(event) => setDraftTitle(event.target.value)}
                    aria-label="Título do documento"
                  />
                ) : (
                  <div className="truncate text-sm font-medium">
                    {artifact.title}
                  </div>
                )}
                <div className="mt-1 text-xs text-muted-foreground">
                  {new Date(artifact.createdAt).toLocaleString("pt-BR")}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1 self-end sm:self-auto">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onCopy(draftContent || artifact.content)}
                    >
                      <Copy />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Copiar</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        onDownload({
                          ...artifact,
                          title: draftTitle || artifact.title,
                          content: draftContent || artifact.content,
                        })
                      }
                    >
                      <Download />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Baixar Markdown</TooltipContent>
                </Tooltip>
              </div>
            </div>

            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="inline-flex rounded-md border border-border bg-muted p-1">
                <button
                  type="button"
                  className={cn(
                    "h-8 rounded px-3 text-xs font-medium transition-colors",
                    mode === "preview"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground",
                  )}
                  onClick={() => setMode("preview")}
                >
                  Visualizar
                </button>
                <button
                  type="button"
                  className={cn(
                    "h-8 rounded px-3 text-xs font-medium transition-colors",
                    mode === "edit"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground",
                  )}
                  onClick={() => setMode("edit")}
                >
                  Editar
                </button>
              </div>
              <Button
                className="w-full sm:w-auto"
                size="sm"
                disabled={!dirty || !draftTitle.trim() || !draftContent.trim()}
                onClick={() => {
                  onUpdate(artifact.id, {
                    title: draftTitle.trim(),
                    content: draftContent.trim(),
                  });
                }}
              >
                Salvar versão
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-card p-4 sm:p-6">
            {mode === "edit" ? (
              <textarea
                className="h-full w-full resize-none border-0 bg-transparent text-sm leading-6 outline-none focus:ring-0"
                value={draftContent}
                onChange={(event) => setDraftContent(event.target.value)}
                aria-label="Conteúdo do documento"
              />
            ) : (
              <div className="prose prose-sm max-w-none">
                {/* Note: In truqpedia-shell.tsx it just rendered pre-wrap container */}
                <div className="whitespace-pre-wrap font-sans text-sm leading-6 text-foreground">
                  {artifact.content}
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-sm text-muted-foreground">
          <div className="grid size-12 place-items-center rounded-lg bg-muted text-muted-foreground">
            <X className="size-6" />
          </div>
          <div className="mt-4 font-semibold text-foreground">
            Nenhum documento aberto
          </div>
          <p className="mt-2 max-w-sm leading-6">
            Use o botão Documento em uma resposta da IA para criar um arquivo
            editável, comparar versões e baixar em Markdown.
          </p>
        </div>
      )}
    </div>
  );
}
