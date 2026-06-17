import { type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, FolderPlus, Save, ShieldCheck, Trash2 } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { AssistantPreferences } from "@/lib/types";
import type { SessionUser } from "./types";

type ProjectCreateDialogProps = {
  description: string;
  name: string;
  onDescriptionChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  open: boolean;
  saving: boolean;
};

export function ProjectCreateDialog({
  description,
  name,
  onDescriptionChange,
  onNameChange,
  onOpenChange,
  onSubmit,
  open,
  saving,
}: ProjectCreateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo projeto</DialogTitle>
          <DialogDescription>
            Organize conversas por cliente, frota, catálogo ou orçamento para
            manter o contexto técnico junto.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="project-name">Nome do projeto</Label>
            <Input
              id="project-name"
              autoFocus
              maxLength={120}
              placeholder="Ex: Frota Volvo VM 270 - Cliente Almeida"
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-description">Descrição opcional</Label>
            <Textarea
              id="project-description"
              maxLength={280}
              placeholder="Ex: Conversas sobre filtros, freio e suspensão da frota 2024."
              value={description}
              onChange={(event) => onDescriptionChange(event.target.value)}
              className="min-h-24 resize-none bg-input-shell"
            />
          </div>

          <div className="grid gap-2 rounded-md border border-border bg-muted/60 p-3 text-xs leading-5 text-muted-foreground sm:grid-cols-3">
            <span>Cliente</span>
            <span>Frota</span>
            <span>Catálogo</span>
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
            <Button className="w-full sm:w-auto" disabled={!name.trim() || saving}>
              <FolderPlus className="size-4" />
              {saving ? "Criando..." : "Criar projeto"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type ProjectSettingsDialogProps = {
  deletingAllChats: boolean;
  onDeleteAllConversations: () => void;
  onOpenChange: (open: boolean) => void;
  onPreferencesChange: (preferences: AssistantPreferences) => void;
  onSavePreferences: () => void;
  open: boolean;
  preferences: AssistantPreferences;
  preferencesSaving: boolean;
  status: string | null;
  user: SessionUser | null;
};

export function ProjectSettingsDialog({
  deletingAllChats,
  onDeleteAllConversations,
  onOpenChange,
  onPreferencesChange,
  onSavePreferences,
  open,
  preferences,
  preferencesSaving,
  status,
  user,
}: ProjectSettingsDialogProps) {
  function updatePreference<Key extends keyof AssistantPreferences>(
    key: Key,
    value: AssistantPreferences[Key],
  ) {
    onPreferencesChange({ ...preferences, [key]: value });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Configurações</DialogTitle>
          <DialogDescription>
            Personalize a conversa e gerencie sua conta.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="preferencias" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="preferencias">IA</TabsTrigger>
            <TabsTrigger value="conta">Conta</TabsTrigger>
            <TabsTrigger value="plano">Plano</TabsTrigger>
          </TabsList>

          <TabsContent value="preferencias" className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <PreferenceField label="Como te chamar">
                <Input
                  value={preferences.displayName ?? ""}
                  placeholder="Ex.: Ramon"
                  onChange={(event) =>
                    updatePreference("displayName", event.target.value)
                  }
                />
              </PreferenceField>

              <PreferenceField label="Como se referir a você">
                <Input
                  value={preferences.referenceStyle ?? ""}
                  placeholder="Ex.: pelo primeiro nome, de forma direta"
                  onChange={(event) =>
                    updatePreference("referenceStyle", event.target.value)
                  }
                />
              </PreferenceField>

              <PreferenceField label="Estilo de resposta">
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={preferences.responseStyle ?? ""}
                  onChange={(event) =>
                    updatePreference("responseStyle", event.target.value)
                  }
                >
                  <option value="">Equilibrado</option>
                  <option value="Direto, curto e com próximos passos claros.">
                    Direto
                  </option>
                  <option value="Detalhado, didático e com checklist.">
                    Detalhado
                  </option>
                  <option value="Mais comercial, pronto para WhatsApp e venda.">
                    Comercial
                  </option>
                  <option value="Mais técnico, com cautelas e validações.">
                    Técnico
                  </option>
                </select>
              </PreferenceField>

              <PreferenceField label="Contexto da sua operação">
                <Input
                  value={preferences.businessContext ?? ""}
                  placeholder="Ex.: loja de peças diesel, balcão e e-commerce"
                  onChange={(event) =>
                    updatePreference("businessContext", event.target.value)
                  }
                />
              </PreferenceField>
            </div>

            <PreferenceField label="Como você quer que ele aja">
              <Textarea
                value={preferences.behavior ?? ""}
                placeholder="Ex.: seja direto, faça perguntas quando faltar dado e me entregue mensagem pronta para cliente."
                className="min-h-24 resize-none bg-input-shell"
                onChange={(event) =>
                  updatePreference("behavior", event.target.value)
                }
              />
            </PreferenceField>

            <PreferenceField label="Preferências adicionais">
              <Textarea
                value={preferences.customInstructions ?? ""}
                placeholder="Ex.: priorize linguagem simples para equipe do balcão e destaque riscos de aplicação."
                className="min-h-20 resize-none bg-input-shell"
                onChange={(event) =>
                  updatePreference("customInstructions", event.target.value)
                }
              />
            </PreferenceField>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-5 text-muted-foreground">
                Essas preferências personalizam a conversa, mas não removem a
                cautela técnica do Truqpedia.
              </p>
              <Button
                className="w-full sm:w-auto"
                disabled={preferencesSaving}
                onClick={onSavePreferences}
              >
                <Save className="size-4" />
                {preferencesSaving ? "Salvando..." : "Salvar preferências"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="conta" className="space-y-4">
            <div className="rounded-md border border-border p-4">
              <div className="text-sm font-medium">Conta</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {user?.email ?? "Visitante"}
              </div>
            </div>

            <div className="rounded-md border border-border p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <ShieldCheck className="size-4 text-primary" />
                Histórico e privacidade operacional
              </div>
              <div className="mt-1 text-xs leading-5 text-muted-foreground">
                Projetos e conversas ficam vinculados à sua conta para manter
                clientes, frotas e orçamentos organizados.
              </div>
            </div>

            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4">
              <div className="text-sm font-medium">Apagar histórico de chat</div>
              <div className="mt-1 text-xs leading-5 text-muted-foreground">
                Remove todas as conversas e mensagens salvas da sua conta. Seus
                projetos continuam existindo, mas ficam sem conversas vinculadas.
              </div>
              <Button
                className="mt-4 w-full sm:w-auto"
                variant="destructive"
                disabled={!user || deletingAllChats}
                onClick={onDeleteAllConversations}
              >
                <Trash2 className="size-4" />
                {deletingAllChats ? "Apagando..." : "Apagar todos os chats"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="plano" className="space-y-4">
            <div className="rounded-md border border-border p-4">
              <div className="text-sm font-medium">Plano atual</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Comece pelo plano Loja para projetos, documentos e histórico
                completo.
              </div>
              <Button className="mt-4 w-full sm:w-auto" asChild>
                <Link href="/checkout?plan=loja">
                  Ver planos e checkout
                  <ArrowRight />
                </Link>
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {status ? (
          <div className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
            {status}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function PreferenceField({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      {children}
    </label>
  );
}
