import { type FormEvent } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { relativeTime } from "@/lib/utils";
import type { UiConversation } from "./types";

type RenameDialogProps = {
  conversation: UiConversation | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (event?: FormEvent<HTMLFormElement>) => void;
  onTitleChange: (title: string) => void;
  saving: boolean;
  title: string;
};

export function ConversationRenameDialog({
  conversation,
  onOpenChange,
  onSubmit,
  onTitleChange,
  saving,
  title,
}: RenameDialogProps) {
  return (
    <Dialog open={Boolean(conversation)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Renomear conversa</DialogTitle>
          <DialogDescription>
            Dê um nome curto para encontrar este atendimento mais rápido depois.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="conversation-title">Nome da conversa</Label>
            <Input
              id="conversation-title"
              autoFocus
              maxLength={120}
              placeholder="Ex: Volvo FH - embreagem Sachs"
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              required
            />
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              className="w-full sm:w-auto"
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              className="w-full sm:w-auto"
              disabled={!title.trim() || saving}
            >
              <Pencil className="size-4" />
              {saving ? "Salvando..." : "Salvar nome"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type DeleteDialogProps = {
  conversation: UiConversation | null;
  deleting: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
};

export function ConversationDeleteDialog({
  conversation,
  deleting,
  onConfirm,
  onOpenChange,
}: DeleteDialogProps) {
  return (
    <Dialog open={Boolean(conversation)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Excluir conversa</DialogTitle>
          <DialogDescription>
            Esta ação remove o chat e suas mensagens salvas. Não dá para
            desfazer.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-border bg-muted/70 p-3 text-sm">
          <div className="font-medium text-foreground">
            {conversation?.title ?? "Conversa"}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {conversation ? relativeTime(conversation.updatedAt) : null}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            className="w-full sm:w-auto"
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            className="w-full sm:w-auto"
            type="button"
            variant="destructive"
            disabled={deleting}
            onClick={onConfirm}
          >
            <Trash2 className="size-4" />
            {deleting ? "Excluindo..." : "Excluir conversa"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
