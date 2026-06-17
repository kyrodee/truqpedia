import { Folder, Paperclip, FileText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { UiProject, ProjectFile } from "./types";

type ProjectFilesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: UiProject | null;
  files: ProjectFile[];
  loading: boolean;
  uploading: boolean;
  uploadProgress: string;
  onUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onDelete: (fileId: string) => void;
};

export function ProjectFilesDialog({
  open,
  onOpenChange,
  project,
  files,
  loading,
  uploading,
  uploadProgress,
  onUpload,
  onDelete,
}: ProjectFilesDialogProps) {
  const fileInputId = "project-file-upload-input";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Folder className="size-5 text-primary" />
            Arquivos do Projeto: {project?.name}
          </DialogTitle>
          <DialogDescription>
            Envie catálogos de peças ou manuais em PDF, CSV ou Excel para contextualizar a IA.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Upload section */}
          <div className="flex items-center justify-center border-2 border-dashed border-border rounded-lg p-6 bg-muted/30 transition-colors hover:bg-muted/50 relative">
            {uploading ? (
              <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground py-2">
                <div className="size-6 border-2 border-t-transparent border-primary rounded-full animate-spin" />
                <span className="font-medium">{uploadProgress}</span>
              </div>
            ) : (
              <label htmlFor={fileInputId} className="flex flex-col items-center gap-2 text-sm text-muted-foreground cursor-pointer w-full py-2">
                <Paperclip className="size-8 text-muted-foreground" />
                <span className="font-semibold text-foreground text-center">Clique para enviar um arquivo</span>
                <span className="text-xs text-center text-muted-foreground/80">PDF, CSV ou Excel (máx. 25MB)</span>
                <input
                  id={fileInputId}
                  type="file"
                  accept=".pdf,.csv,.xlsx,.xls"
                  className="hidden"
                  onChange={onUpload}
                />
              </label>
            )}
          </div>

          {/* Files List */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground">Arquivos Importados</h4>
            
            {loading && files.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                Carregando lista de arquivos...
              </div>
            ) : files.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground border border-dashed rounded-md p-4">
                Nenhum catálogo associado a este projeto ainda.
              </div>
            ) : (
              <div className="max-h-[260px] overflow-y-auto border border-border rounded-md divide-y divide-border">
                {files.map((file) => {
                  const isProcessing = file.status === "uploaded" || file.status === "processing";
                  const isFailed = file.status === "failed";
                  const isReady = file.status === "ready";
                  const dateStr = new Date(file.created_at).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  const sizeKB = Math.round((file.metadata?.size as number ?? 0) / 1024) || 1;

                  return (
                    <div key={file.id} className="flex items-center justify-between p-3 bg-background hover:bg-muted/30 transition-colors">
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <FileText className="size-5 text-muted-foreground shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate" title={file.file_name}>
                            {file.file_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {sizeKB >= 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB} KB`} • {dateStr}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 ml-4">
                        {isReady && (
                          <span className="inline-flex items-center gap-1 rounded bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-500">
                            Pronto ({file.metadata?.total_chunks ?? 0} partes)
                          </span>
                        )}
                        {isFailed && (
                          <span className="inline-flex items-center gap-1 rounded bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive" title={file.metadata?.error || "Erro desconhecido"}>
                            Falhou
                          </span>
                        )}
                        {isProcessing && (
                          <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary animate-pulse">
                            {file.metadata?.stage === "downloading" ? "Enviando..." :
                             file.metadata?.stage === "extracting_text" ? "Lendo texto..." :
                             file.metadata?.stage === "generating_embeddings" ? "Indexando vetor..." :
                             file.metadata?.stage === "storing_chunks" ? "Armazenando..." :
                             "Processando..."}
                          </span>
                        )}

                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={() => onDelete(file.id)}
                          title="Remover arquivo"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
