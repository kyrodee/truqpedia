"use client";

import { type FormEvent, type ReactNode, useEffect, useRef, useState } from "react";
import {
  BadgeCheck,
  Bot,
  CheckCircle2,
  ClipboardList,
  Copy,
  Database,
  Download,
  ExternalLink,
  File,
  FileText,
  Folder,
  FolderPlus,
  Globe2,
  LogIn,
  LogOut,
  Menu,
  MoreHorizontal,
  Paperclip,
  PanelLeftClose,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Truck,
  UserRound,
  Wrench,
  X,
} from "lucide-react";
import { AuthModal } from "@/components/auth/auth-modal";
import { MarkdownMessage } from "@/components/markdown/markdown-message";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TypingIndicator } from "@/components/chat/typing-indicator";
import { DEFAULT_CHAT_MODE, FREE_MESSAGE_LIMIT } from "@/lib/constants";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type {
  ChatMessage,
  ChatMode,
  ArtifactSummary,
  ConversationSummary,
  ProjectSummary,
  SourceResult,
  StreamEvent,
  UploadedAttachment,
} from "@/lib/types";
import { cn, relativeTime, truncate } from "@/lib/utils";

type SessionUser = {
  id: string;
  email?: string;
  role?: "user" | "admin";
};

type UiConversation = ConversationSummary;
type UiProject = ProjectSummary;
type UiArtifact = ArtifactSummary;

type UiMessage = ChatMessage & {
  id: string;
  status?: "searching" | "streaming" | "error" | "done";
  sources?: SourceResult[];
  provider?: string;
  model?: string;
  attachments?: UploadedAttachment[];
};

type TruqpediaShellProps = {
  user: SessionUser | null;
  initialConversations: UiConversation[];
  initialProjects: UiProject[];
  initialMessages: UiMessage[];
  initialConversationId: string | null;
  initialProjectId: string | null;
};

type ProjectHealth = {
  status?: "ok" | "degraded";
  checks?: {
    supabaseUrl?: boolean;
    supabaseAnonKey?: boolean;
    supabaseServiceRoleKey?: boolean;
    appUrl?: boolean;
    aiProvider?: boolean;
    webSearch?: boolean;
    database?: "ok" | "not_configured" | "error";
    searchProviders?: string[];
  };
};

const workflowPrompts = [
  {
    icon: Truck,
    title: "Confirmar aplicação",
    description: "Código, veículo, ano, motor e alertas antes da venda.",
    prompt:
      "Aja como especialista de balcão em peças pesadas. Preciso confirmar a aplicação desta peça. Responda com: resumo objetivo, compatibilidades prováveis, dados que faltam para cravar, riscos de vender errado e checklist do que pedir ao cliente antes de fechar.",
    webSearch: true,
  },
  {
    icon: Search,
    title: "Equivalência",
    description: "Compare códigos e marcas sem assumir compatibilidade.",
    prompt:
      "Compare estes códigos/marcas de peça como um comprador técnico. Não assuma equivalência sem prova. Monte uma tabela com função da peça, possíveis equivalências, diferenças críticas, medidas/dados para conferir, risco de incompatibilidade e recomendação final.",
    webSearch: true,
  },
  {
    icon: ClipboardList,
    title: "Anúncio técnico",
    description: "Descrição de marketplace com cautela e bons filtros.",
    prompt:
      "Crie um anúncio pronto para marketplace de peça pesada. Entregue: título forte, descrição clara, benefícios práticos, aplicações prováveis sem prometer compatibilidade, perguntas para confirmar antes da compra e palavras-chave de busca.",
    webSearch: false,
  },
  {
    icon: ShieldCheck,
    title: "Checklist de compra",
    description: "Perguntas para evitar devolução e compra errada.",
    prompt:
      "Monte um checklist de compra para evitar devolução. Separe por: perguntas ao cliente, conferência visual, medidas/códigos, sinais de alerta, quando pedir chassi/catálogo e mensagem curta para enviar ao cliente no WhatsApp.",
    webSearch: false,
  },
];

export function TruqpediaShell({
  user,
  initialConversations,
  initialProjects,
  initialMessages,
  initialConversationId,
  initialProjectId,
}: TruqpediaShellProps) {
  const [conversations, setConversations] =
    useState<UiConversation[]>(initialConversations);
  const [projects, setProjects] = useState<UiProject[]>(initialProjects);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(
    initialProjectId,
  );
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(initialConversationId);
  const [messages, setMessages] = useState<UiMessage[]>(initialMessages);
  const [artifacts, setArtifacts] = useState<UiArtifact[]>([]);
  const [activeArtifactId, setActiveArtifactId] = useState<string | null>(null);
  const [artifactOpen, setArtifactOpen] = useState(false);
  const [input, setInput] = useState("");
  const mode: ChatMode = DEFAULT_CHAT_MODE;
  const [webSearch, setWebSearch] = useState(false);
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authReason, setAuthReason] = useState<"limit" | "auth">("auth");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectSaving, setProjectSaving] = useState(false);
  const [projectHealth, setProjectHealth] = useState<ProjectHealth | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [guestCount, setGuestCount] = useState(0);
  const remainingGuestMessages = Math.max(0, FREE_MESSAGE_LIMIT - guestCount);
  const activeProject =
    projects.find((project) => project.id === activeProjectId) ?? null;
  const projectConversationIds = new Set(
    activeProject?.conversationIds ?? conversations.map((conversation) => conversation.id),
  );
  const filteredConversations = activeProject
    ? conversations.filter((conversation) =>
        projectConversationIds.has(conversation.id),
      )
    : conversations;
  const activeArtifact =
    artifacts.find((artifact) => artifact.id === activeArtifactId) ?? null;

  useEffect(() => {
    setGuestCount(readGuestCount());
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isStreaming]);

  useEffect(() => {
    if (!settingsOpen) {
      return;
    }

    let active = true;
    setSettingsLoading(true);

    fetch("/api/health", { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as ProjectHealth;

        if (active) {
          setProjectHealth(data);
        }
      })
      .catch(() => {
        if (active) {
          setProjectHealth(null);
        }
      })
      .finally(() => {
        if (active) {
          setSettingsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [settingsOpen]);

  async function submitMessage(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const cleanInput = input.trim();

    if (!cleanInput || isStreaming) {
      return;
    }

    setInput("");
    const sentAttachments = attachments;
    setAttachments([]);
    await sendMessage(cleanInput, sentAttachments, messages);
  }

  async function sendMessage(
    cleanInput: string,
    sentAttachments: UploadedAttachment[],
    history: UiMessage[],
  ) {
    setStatus(null);
    setIsStreaming(true);

    const userMessage: UiMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: cleanInput,
      createdAt: new Date().toISOString(),
      attachments: sentAttachments,
    };
    const assistantMessage: UiMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
      status: webSearch ? "searching" : "streaming",
    };

    const nextMessages = [...history, userMessage, assistantMessage];
    setMessages(nextMessages);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversationId: activeConversationId,
          projectId: activeProjectId,
          message: cleanInput,
          mode,
          webSearch,
          attachments: sentAttachments,
          clientMessages: user ? undefined : history.slice(-16),
        }),
        signal: controller.signal,
      });

      if (response.status === 402) {
        setMessages(history);
        setInput(cleanInput);
        setAttachments(sentAttachments);
        setAuthReason("limit");
        setAuthOpen(true);
        setStatus("Crie uma conta para continuar conversando.");
        return;
      }

      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "Nao foi possivel enviar a mensagem.");
      }

      if (!user) {
        setGuestCount((current) =>
          Math.min(FREE_MESSAGE_LIMIT, Math.max(readGuestCount(), current + 1)),
        );
      }

      await consumeStream(response, assistantMessage.id);
      await refreshConversations();
      await refreshProjects();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        updateMessage(assistantMessage.id, {
          content: "Geração interrompida.",
          status: "error",
        });
        return;
      }

      const message =
        error instanceof Error ? error.message : "Erro inesperado no chat.";
      updateMessage(assistantMessage.id, {
        content: message,
        status: "error",
      });
    } finally {
      abortRef.current = null;
      setIsStreaming(false);
    }
  }

  function stopStreaming() {
    abortRef.current?.abort();
  }

  async function consumeStream(response: Response, assistantId: string) {
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let currentSources: SourceResult[] = [];

    if (!reader) {
      return;
    }

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        const line = part
          .split("\n")
          .find((candidate) => candidate.startsWith("data:"));

        if (!line) {
          continue;
        }

        const event = JSON.parse(line.slice(5).trim()) as StreamEvent;

        if (event.type === "conversation") {
          setActiveConversationId(event.conversationId);
          if (activeProjectId) {
            setProjects((current) =>
              current.map((project) =>
                project.id === activeProjectId
                  ? {
                      ...project,
                      conversationIds: Array.from(
                        new Set([
                          ...project.conversationIds,
                          event.conversationId,
                        ]),
                      ),
                    }
                  : project,
              ),
            );
          }
          setConversations((current) => {
            const exists = current.some(
              (conversation) => conversation.id === event.conversationId,
            );

            if (exists) {
              return current;
            }

            return [
              {
                id: event.conversationId,
                title: event.title ?? truncate(input || "Nova conversa", 54),
                mode,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
              ...current,
            ];
          });
        }

        if (event.type === "sources") {
          currentSources = event.sources;
          updateMessage(assistantId, {
            sources: currentSources,
            status: "streaming",
          });
        }

        if (event.type === "provider") {
          updateMessage(assistantId, {
            provider: event.provider,
            model: event.model,
            status: "streaming",
          });
        }

        if (event.type === "token") {
          appendToMessage(assistantId, event.token);
        }

        if (event.type === "error") {
          updateMessage(assistantId, {
            content: event.message,
            status: "error",
          });
        }

        if (event.type === "done") {
          updateMessage(assistantId, {
            id: event.messageId ?? assistantId,
            status: "done",
            sources: currentSources,
          });
        }
      }
    }
  }

  function updateMessage(id: string, patch: Partial<UiMessage>) {
    setMessages((current) =>
      current.map((message) =>
        message.id === id ? { ...message, ...patch } : message,
      ),
    );
  }

  function appendToMessage(id: string, token: string) {
    setMessages((current) =>
      current.map((message) =>
        message.id === id
          ? {
              ...message,
              content: `${message.content}${token}`,
              status:
                message.status === "searching" ? "streaming" : message.status,
            }
          : message,
      ),
    );
  }

  async function refreshConversations() {
    if (!user) {
      return;
    }

    const response = await fetch("/api/conversations");

    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as {
      conversations: Array<{
        id: string;
        title: string;
        mode: ChatMode;
        created_at: string;
        updated_at: string;
      }>;
    };

    setConversations(
      data.conversations.map((conversation) => ({
        id: conversation.id,
        title: conversation.title,
        mode: conversation.mode,
        createdAt: conversation.created_at,
        updatedAt: conversation.updated_at,
      })),
    );
  }

  async function refreshProjects() {
    if (!user) {
      return;
    }

    const response = await fetch("/api/projects");

    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as { projects: UiProject[] };
    setProjects(data.projects);
  }

  async function loadConversation(id: string) {
    if (!user || isStreaming) {
      return;
    }

    setStatus(null);
    const response = await fetch(`/api/conversations/${id}`);

    if (!response.ok) {
      setStatus("Nao foi possivel carregar a conversa.");
      return;
    }

    const data = (await response.json()) as {
      conversation: { id: string; mode: ChatMode };
      messages: Array<{
        id: string;
        role: "user" | "assistant" | "system";
        content: string;
        provider_id?: string | null;
        model?: string | null;
        metadata?: {
          sources?: SourceResult[];
          attachments?: UploadedAttachment[];
        };
        created_at: string;
      }>;
    };

    setActiveConversationId(data.conversation.id);
    setMessages(
      data.messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        provider: message.provider_id ?? undefined,
        model: message.model ?? undefined,
        sources: message.metadata?.sources,
        attachments: message.metadata?.attachments,
        createdAt: message.created_at,
        status: "done",
      })),
    );
  }

  function openCreateProjectModal() {
    if (!user) {
      return;
    }

    setProjectName("");
    setProjectDescription("");
    setProjectModalOpen(true);
  }

  async function createProject(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    if (!user) {
      return;
    }

    const name = projectName.trim();

    if (!name) {
      return;
    }

    setProjectSaving(true);

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: projectDescription.trim(),
        }),
      });

      if (!response.ok) {
        setStatus("Nao foi possivel criar o projeto.");
        return;
      }

      const data = (await response.json()) as { project: UiProject };
      setProjects((current) => [data.project, ...current]);
      setProjectModalOpen(false);
      setProjectName("");
      setProjectDescription("");
      newConversationInProject(data.project.id);
    } catch {
      setStatus("Nao foi possivel criar o projeto.");
    } finally {
      setProjectSaving(false);
    }
  }

  async function renameProject(project: UiProject) {
    const name = window.prompt("Novo nome do projeto", project.name);

    if (!name?.trim()) {
      return;
    }

    const response = await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });

    if (!response.ok) {
      setStatus("Nao foi possivel renomear o projeto.");
      return;
    }

    const data = (await response.json()) as { project: UiProject };
    setProjects((current) =>
      current.map((item) => (item.id === project.id ? data.project : item)),
    );
  }

  async function deleteProject(project: UiProject) {
    const confirmed = window.confirm(`Excluir projeto "${project.name}"?`);

    if (!confirmed) {
      return;
    }

    const response = await fetch(`/api/projects/${project.id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      setStatus("Nao foi possivel excluir o projeto.");
      return;
    }

    setProjects((current) => current.filter((item) => item.id !== project.id));

    if (activeProjectId === project.id) {
      newConversationInProject(null);
    }
  }

  function newConversation() {
    resetConversationDraft();
  }

  function newConversationInProject(projectId: string | null) {
    setActiveProjectId(projectId);
    resetConversationDraft();
  }

  function resetConversationDraft() {
    if (isStreaming) {
      return;
    }

    setActiveConversationId(null);
    setMessages([]);
    setInput("");
    setAttachments([]);
    setStatus(null);
  }

  async function copyMessage(content: string) {
    await navigator.clipboard.writeText(content);
    setStatus("Mensagem copiada.");
  }

  function applyWorkflowPrompt(prompt: string, promptWebSearch: boolean) {
    setInput(prompt);

    if (promptWebSearch) {
      setWebSearch(true);
    }
  }

  function openArtifactFromMessage(message: UiMessage) {
    const artifact: UiArtifact = {
      id: crypto.randomUUID(),
      title: generateArtifactTitle(message.content),
      content: message.content,
      createdAt: new Date().toISOString(),
      sourceMessageId: message.id,
    };

    setArtifacts((current) => [artifact, ...current]);
    setActiveArtifactId(artifact.id);
    setArtifactOpen(true);
  }

  function updateArtifact(
    artifactId: string,
    patch: Pick<UiArtifact, "title" | "content">,
  ) {
    setArtifacts((current) =>
      current.map((artifact) =>
        artifact.id === artifactId ? { ...artifact, ...patch } : artifact,
      ),
    );
    setStatus("Documento atualizado.");
  }

  function duplicateArtifact(artifact: UiArtifact) {
    const duplicate: UiArtifact = {
      ...artifact,
      id: crypto.randomUUID(),
      title: `${artifact.title} - versão ${artifactVersionNumber(
        artifact.title,
        artifacts,
      )}`,
      createdAt: new Date().toISOString(),
    };

    setArtifacts((current) => [duplicate, ...current]);
    setActiveArtifactId(duplicate.id);
    setArtifactOpen(true);
    setStatus("Nova versão criada no documento.");
  }

  function downloadArtifact(artifact: UiArtifact) {
    const blob = new Blob([artifact.content], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${slugify(artifact.title)}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function regenerateFromMessage(messageId: string) {
    if (isStreaming) {
      return;
    }

    const messageIndex = messages.findIndex((message) => message.id === messageId);
    const previousUser = messages
      .slice(0, messageIndex)
      .reverse()
      .find((message) => message.role === "user");

    if (!previousUser) {
      return;
    }

    await sendMessage(
      previousUser.content,
      previousUser.attachments ?? [],
      messages.slice(0, messageIndex),
    );
  }

  async function attachFiles(fileList: FileList | null) {
    if (!fileList?.length) {
      return;
    }

    const files = Array.from(fileList).slice(0, 8 - attachments.length);
    const nextAttachments = await Promise.all(files.map(readAttachment));

    setAttachments((current) => [...current, ...nextAttachments].slice(0, 8));

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function removeAttachment(index: number) {
    setAttachments((current) =>
      current.filter((_, currentIndex) => currentIndex !== index),
    );
  }

  async function renameConversation(conversation: UiConversation) {
    const title = window.prompt("Novo nome da conversa", conversation.title);

    if (!title?.trim()) {
      return;
    }

    const response = await fetch(`/api/conversations/${conversation.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim() }),
    });

    if (response.ok) {
      setConversations((current) =>
        current.map((item) =>
          item.id === conversation.id ? { ...item, title: title.trim() } : item,
        ),
      );
    }
  }

  async function deleteConversation(conversation: UiConversation) {
    const confirmed = window.confirm(`Excluir "${conversation.title}"?`);

    if (!confirmed) {
      return;
    }

    const response = await fetch(`/api/conversations/${conversation.id}`, {
      method: "DELETE",
    });

    if (response.ok) {
      setConversations((current) =>
        current.filter((item) => item.id !== conversation.id),
      );

      if (activeConversationId === conversation.id) {
        newConversation();
      }
    }
  }

  async function signOut() {
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
    } finally {
      window.location.href = "/";
    }
  }

  return (
    <TooltipProvider>
      <div className="flex h-dvh overflow-hidden bg-app text-foreground">
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 flex w-[310px] flex-col border-r border-sidebar-border bg-sidebar/95 backdrop-blur-xl transition-transform md:static md:translate-x-0",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="flex h-16 items-center justify-between px-4">
            <div className="flex items-center gap-3">
              <div className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground shadow-sm">
                <Wrench className="size-4" />
              </div>
              <div>
                <div className="text-sm font-semibold">Truqpedia</div>
                <div className="text-xs text-muted-foreground">
                  Inteligencia automotiva
                </div>
              </div>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  onClick={() => setSidebarOpen(false)}
                >
                  <PanelLeftClose />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Ocultar menu</TooltipContent>
            </Tooltip>
          </div>

          <div className="px-3 pb-3">
            <Button
              className="w-full justify-start"
              onClick={() => newConversationInProject(activeProjectId)}
            >
              <Plus />
              Nova conversa
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-4">
            {user ? (
              <div className="space-y-5">
                <div>
                  <div className="mb-2 flex items-center justify-between px-2 text-xs font-medium uppercase text-muted-foreground">
                    <span>Projetos</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={openCreateProjectModal}
                        >
                          <FolderPlus className="size-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Novo projeto</TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="space-y-1">
                    <button
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                        !activeProjectId
                          ? "bg-sidebar-accent text-foreground"
                          : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground",
                      )}
                      onClick={() => newConversationInProject(null)}
                    >
                      <Folder className="size-4" />
                      Todas as conversas
                    </button>
                    {projects.map((project) => (
                      <div
                        key={project.id}
                        className={cn(
                          "group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm transition-all",
                          activeProjectId === project.id
                            ? "bg-sidebar-accent text-foreground"
                            : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground",
                        )}
                      >
                        <button
                          className="flex min-w-0 flex-1 items-center gap-2 text-left"
                          onClick={() => newConversationInProject(project.id)}
                        >
                          <Folder className="size-4 shrink-0" />
                          <span className="truncate">{project.name}</span>
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 opacity-0 group-hover:opacity-100"
                            >
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => renameProject(project)}>
                              <Pencil />
                              Renomear
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => deleteProject(project)}
                            >
                              <Trash2 />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))}
                    {projects.length === 0 ? (
                      <div className="rounded-md border border-dashed border-sidebar-border bg-background/60 p-3 text-xs leading-5 text-muted-foreground">
                        Agrupe conversas por cliente, frota ou catálogo para
                        manter contexto técnico no mesmo lugar.
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3 w-full justify-start"
                          onClick={openCreateProjectModal}
                        >
                          <FolderPlus className="size-3.5" />
                          Criar projeto
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div>
                  <div className="mb-2 px-2 text-xs font-medium uppercase text-muted-foreground">
                    Conversas
                  </div>
                  <div className="space-y-1">
                    {filteredConversations.map((conversation) => (
                      <div
                        key={conversation.id}
                        className={cn(
                          "group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm transition-all",
                          activeConversationId === conversation.id
                            ? "bg-sidebar-accent text-foreground"
                            : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground",
                        )}
                      >
                        <button
                          className="min-w-0 flex-1 text-left"
                          onClick={() => loadConversation(conversation.id)}
                        >
                          <div className="truncate font-medium">
                            {conversation.title}
                          </div>
                          <div className="truncate text-xs opacity-70">
                            {relativeTime(conversation.updatedAt)}
                          </div>
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 opacity-0 group-hover:opacity-100"
                            >
                              <MoreHorizontal />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => renameConversation(conversation)}
                            >
                              <Pencil />
                              Renomear
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => deleteConversation(conversation)}
                            >
                              <Trash2 />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))}
                    {filteredConversations.length === 0 ? (
                      <div className="rounded-md border border-dashed border-sidebar-border bg-background/60 p-3 text-xs leading-5 text-muted-foreground">
                        {activeProject
                          ? "Este projeto ainda não tem conversa. Comece uma análise já ligada a ele."
                          : "Seu histórico aparecerá aqui assim que você iniciar conversas."}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mx-2 rounded-md border border-sidebar-border bg-background/70 p-3 text-sm text-muted-foreground">
                <div className="font-medium text-foreground">
                  Teste gratuito
                </div>
                <div className="mt-1">
                  {remainingGuestMessages} mensagens restantes nesta sessão.
                </div>
                <Button
                  variant="outline"
                  className="mt-3 w-full justify-start"
                  onClick={() => {
                    setAuthReason("auth");
                    setAuthOpen(true);
                  }}
                >
                  <LogIn />
                  Entrar
                </Button>
              </div>
            )}
          </div>

          <div className="border-t border-sidebar-border p-3">
            {user ? (
              <div className="flex items-center gap-2">
                <div className="grid size-9 place-items-center rounded-md bg-muted">
                  <UserRound className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {user.email}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Conta ativa
                  </div>
                </div>
                {user.role === "admin" ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" asChild>
                        <a href="/admin">
                          <Settings2 />
                        </a>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Admin</TooltipContent>
                  </Tooltip>
                ) : null}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={signOut}>
                      <LogOut />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Sair</TooltipContent>
                </Tooltip>
              </div>
            ) : null}
          </div>
        </aside>

        {sidebarOpen ? (
          <button
            aria-label="Fechar menu"
            className="fixed inset-0 z-30 bg-black/20 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        ) : null}

        <main className="flex min-w-0 flex-1 flex-col font-sans">
          <header className="flex h-16 items-center justify-between border-b border-border bg-background/85 px-3 backdrop-blur-xl sm:px-5">
            <div className="flex min-w-0 items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden"
                    onClick={() => setSidebarOpen(true)}
                  >
                    <Menu />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Abrir menu</TooltipContent>
              </Tooltip>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">
                  {activeConversationTitle(conversations, activeConversationId)}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {activeProject
                    ? `Projeto: ${activeProject.name}`
                    : "Especialista em pecas, aplicacoes e mecanica pesada"}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden h-10 items-center gap-2 rounded-md border border-border bg-background px-3 text-xs font-medium text-muted-foreground sm:flex">
                <Sparkles className="size-4 text-primary" />
                Qualidade máxima
              </div>

              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex h-10 items-center gap-2 rounded-md border border-border bg-background px-3">
                    <Globe2 className="size-4 text-muted-foreground" />
                    <Switch checked={webSearch} onCheckedChange={setWebSearch} />
                  </div>
                </TooltipTrigger>
                <TooltipContent>Pesquisa online</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    aria-label="Configurações"
                    variant="ghost"
                    size="icon"
                    onClick={() => setSettingsOpen(true)}
                  >
                    <Settings2 />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Configurações</TooltipContent>
              </Tooltip>

              {artifacts.length > 0 ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      aria-label="Documentos"
                      variant="ghost"
                      size="icon"
                      onClick={() => setArtifactOpen(true)}
                    >
                      <FileText />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Documentos</TooltipContent>
                </Tooltip>
              ) : null}

              {!user ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setAuthReason("auth");
                    setAuthOpen(true);
                  }}
                >
                  <LogIn />
                  Entrar
                </Button>
              ) : null}
            </div>
          </header>

          <section className="flex-1 overflow-y-auto">
            <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col px-4 py-6 sm:px-6">
              {messages.length === 0 ? (
                <div className="soft-enter flex flex-1 flex-col justify-center gap-6 py-10">
                  <div className="space-y-3">
                    <div className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground">
                      <Bot className="size-4 text-primary" />
                      {activeProject ? activeProject.name : "Truqpedia pronto"}
                    </div>
                    <h1 className="max-w-2xl text-3xl font-semibold tracking-normal sm:text-4xl">
                      Escolha um fluxo e chegue numa resposta técnica mais segura.
                    </h1>
                    <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                      O melhor resultado vem quando a IA sabe se você quer
                      vender, comparar, diagnosticar ou transformar a resposta
                      em documento.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {workflowPrompts.map((item) => (
                      <button
                        key={item.title}
                        className="hover-lift rounded-md border border-border bg-background p-4 text-left shadow-sm"
                        onClick={() =>
                          applyWorkflowPrompt(item.prompt, item.webSearch)
                        }
                      >
                        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                          <item.icon className="size-4 text-primary" />
                          {item.title}
                        </span>
                        <span className="mt-2 block text-sm leading-6 text-muted-foreground">
                          {item.description}
                        </span>
                        {item.webSearch ? (
                          <span className="mt-3 inline-flex items-center gap-1 rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
                            <Globe2 className="size-3.5" />
                            usa pesquisa online
                          </span>
                        ) : null}
                      </button>
                    ))}
                  </div>

                  <div className="grid gap-3 rounded-md border border-border bg-background p-4 text-sm text-muted-foreground sm:grid-cols-3">
                    <div className="flex gap-2">
                      <BadgeCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span>Peça confirmação por chassi quando houver risco de aplicação.</span>
                    </div>
                    <div className="flex gap-2">
                      <FileText className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span>Abra respostas longas como documento para editar e baixar.</span>
                    </div>
                    <div className="flex gap-2">
                      <Search className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span>Ative online quando precisar de fonte auditável.</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6 pb-6">
                  {messages.map((message) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      onCopy={() => void copyMessage(message.content)}
                      onOpenArtifact={
                        message.role === "assistant" && message.content
                          ? () => openArtifactFromMessage(message)
                          : undefined
                      }
                      onRegenerate={
                        message.role === "assistant"
                          ? () => void regenerateFromMessage(message.id)
                          : undefined
                      }
                    />
                  ))}
                  <div ref={endRef} />
                </div>
              )}
            </div>
          </section>

          <div className="border-t border-border bg-background/90 px-4 py-3 backdrop-blur-xl sm:px-6">
            <form
              className="mx-auto flex max-w-4xl items-end gap-2"
              onSubmit={submitMessage}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(event) => void attachFiles(event.target.files)}
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    aria-label="Anexar arquivo"
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-12 shrink-0"
                    disabled={attachments.length >= 8}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Anexar arquivo</TooltipContent>
              </Tooltip>

              <div className="min-w-0 flex-1 rounded-lg border border-border bg-input-shell p-2 shadow-sm">
                <Textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void submitMessage();
                    }
                  }}
                  placeholder="Pergunte por codigo, aplicacao, equivalencia, sintoma ou descricao comercial..."
                  className="min-h-12 border-0 bg-transparent px-2 py-2 shadow-none focus-visible:ring-0"
                  rows={1}
                />
                {attachments.length > 0 ? (
                  <div className="flex flex-wrap gap-2 px-2 pb-2">
                    {attachments.map((attachment, index) => (
                      <div
                        key={`${attachment.name}-${index}`}
                        className="inline-flex max-w-full items-center gap-2 rounded-md border border-border bg-muted px-2 py-1 text-xs text-muted-foreground"
                      >
                        {attachment.text ? (
                          <FileText className="size-3.5 shrink-0" />
                        ) : (
                          <File className="size-3.5 shrink-0" />
                        )}
                        <span className="truncate">{attachment.name}</span>
                        <button
                          type="button"
                          className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                          onClick={() => removeAttachment(index)}
                          aria-label={`Remover ${attachment.name}`}
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="flex items-center justify-between gap-2 px-2 pb-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {webSearch ? (
                      <span className="inline-flex items-center gap-1">
                        <Search className="size-3.5" />
                        Online
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground sm:hidden">
                    <Sparkles className="size-3.5 text-primary" />
                    Qualidade máxima
                  </div>
                </div>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    aria-label={isStreaming ? "Parar geração" : "Enviar mensagem"}
                    type={isStreaming ? "button" : "submit"}
                    size="icon"
                    className="size-12"
                    disabled={!input.trim() && !isStreaming}
                    onClick={isStreaming ? stopStreaming : undefined}
                  >
                    {isStreaming ? <X /> : <Send />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Enviar</TooltipContent>
              </Tooltip>
            </form>
            {status ? (
              <div className="mx-auto mt-2 max-w-4xl text-sm text-muted-foreground">
                {status}
              </div>
            ) : null}
          </div>
        </main>

        <AuthModal
          open={authOpen}
          onOpenChange={setAuthOpen}
          reason={authReason}
        />
        <ProjectSettingsDialog
          health={projectHealth}
          loading={settingsLoading}
          onOpenChange={setSettingsOpen}
          onWebSearchChange={setWebSearch}
          open={settingsOpen}
          user={user}
          webSearch={webSearch}
        />
        <ProjectCreateDialog
          description={projectDescription}
          name={projectName}
          onDescriptionChange={setProjectDescription}
          onNameChange={setProjectName}
          onOpenChange={setProjectModalOpen}
          onSubmit={createProject}
          open={projectModalOpen}
          saving={projectSaving}
        />
        <ArtifactPanel
          artifact={activeArtifact}
          artifacts={artifacts}
          onClose={() => setArtifactOpen(false)}
          onCopy={(content) => void copyMessage(content)}
          onDownload={downloadArtifact}
          onDuplicate={duplicateArtifact}
          onSelect={(artifactId) => setActiveArtifactId(artifactId)}
          onUpdate={updateArtifact}
          open={artifactOpen}
        />
      </div>
    </TooltipProvider>
  );
}

function ArtifactPanel({
  artifact,
  artifacts,
  onClose,
  onCopy,
  onDownload,
  onDuplicate,
  onSelect,
  onUpdate,
  open,
}: {
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
}) {
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
    <div className="soft-enter fixed inset-x-0 bottom-0 z-50 flex h-[86dvh] w-full flex-col rounded-t-2xl border border-border bg-background shadow-2xl md:inset-y-0 md:left-auto md:right-0 md:h-auto md:w-[480px] md:rounded-none md:border-y-0 md:border-l">
      <div className="flex h-16 items-center justify-between border-b border-border px-4">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">Documento</div>
          <div className="truncate text-xs text-muted-foreground">
            Edite, versione e baixe respostas salvas
          </div>
        </div>
        <div className="flex items-center gap-1">
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
            <div className="flex items-start justify-between gap-2">
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
              <div className="flex items-center gap-1">
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

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
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
                size="sm"
                disabled={!dirty || !draftTitle.trim() || !draftContent.trim()}
                onClick={() => {
                  if (!artifact) {
                    return;
                  }

                  onUpdate(artifact.id, {
                    title: draftTitle.trim(),
                    content: draftContent.trim(),
                  });
                  setMode("preview");
                }}
              >
                <Save className="size-3.5" />
                Salvar
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {mode === "edit" ? (
              <Textarea
                value={draftContent}
                onChange={(event) => setDraftContent(event.target.value)}
                className="min-h-full resize-none bg-input-shell text-sm leading-6"
                aria-label="Conteúdo do documento"
              />
            ) : (
              <div className="rounded-md border border-border bg-app p-4">
                <MarkdownMessage content={draftContent || artifact.content} />
              </div>
            )}
          </div>

          <div className="border-t border-border px-4 py-3 text-xs leading-5 text-muted-foreground">
            <div className="flex gap-2">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>
                Para proposta, compra ou segurança, confirme aplicação por
                catálogo, chassi ou fabricante antes de publicar.
              </span>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-1 flex-col justify-center p-6 text-sm text-muted-foreground">
          <div className="grid size-10 place-items-center rounded-md bg-muted text-foreground">
            <FileText className="size-5" />
          </div>
          <div className="mt-4 text-base font-semibold text-foreground">
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

function ProjectCreateDialog({
  description,
  name,
  onDescriptionChange,
  onNameChange,
  onOpenChange,
  onSubmit,
  open,
  saving,
}: {
  description: string;
  name: string;
  onDescriptionChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  open: boolean;
  saving: boolean;
}) {
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

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button disabled={!name.trim() || saving}>
              <FolderPlus className="size-4" />
              {saving ? "Criando..." : "Criar projeto"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ProjectSettingsDialog({
  health,
  loading,
  onOpenChange,
  onWebSearchChange,
  open,
  user,
  webSearch,
}: {
  health: ProjectHealth | null;
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onWebSearchChange: (enabled: boolean) => void;
  open: boolean;
  user: SessionUser | null;
  webSearch: boolean;
}) {
  const checks = health?.checks;
  const searchProviders = checks?.searchProviders ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Configurações</DialogTitle>
          <DialogDescription>
            Projeto, resposta e integrações do Truqpedia.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="geral" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="geral">Geral</TabsTrigger>
            <TabsTrigger value="status">Status</TabsTrigger>
          </TabsList>

          <TabsContent value="geral" className="space-y-4">
            <div className="rounded-md border border-border p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium">Pesquisa online</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {searchProviders.length
                      ? searchProviders.join(", ")
                      : "carregando"}
                  </div>
                </div>
                <Switch checked={webSearch} onCheckedChange={onWebSearchChange} />
              </div>
            </div>

            <div className="rounded-md border border-border p-4">
              <div className="text-sm font-medium">Conta</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {user?.email ?? "Visitante"}
              </div>
            </div>

            <div className="rounded-md border border-border p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Sparkles className="size-4 text-primary" />
                Qualidade máxima sempre ativa
              </div>
              <div className="mt-1 text-xs leading-5 text-muted-foreground">
                O Truqpedia usa sempre o modelo mais completo configurado para
                priorizar precisão técnica, comparação e cautela de aplicação.
              </div>
            </div>
          </TabsContent>

          <TabsContent value="status">
            <div className="grid gap-2 sm:grid-cols-2">
              <StatusItem
                icon={<Database className="size-4" />}
                label="Supabase"
                ok={Boolean(checks?.supabaseUrl && checks.supabaseAnonKey)}
                pending={loading}
              />
              <StatusItem
                icon={<Database className="size-4" />}
                label="Banco"
                ok={checks?.database === "ok"}
                pending={loading}
              />
              <StatusItem
                icon={<Bot className="size-4" />}
                label="IA"
                ok={Boolean(checks?.aiProvider)}
                pending={loading}
              />
              <StatusItem
                icon={<Globe2 className="size-4" />}
                label="Busca"
                ok={Boolean(checks?.webSearch)}
                pending={loading}
              />
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function StatusItem({
  icon,
  label,
  ok,
  pending,
}: {
  icon: ReactNode;
  label: string;
  ok: boolean;
  pending: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3 text-sm">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <span className="font-medium">{label}</span>
      </div>
      <span
        className={cn(
          "rounded px-2 py-1 text-xs",
          pending
            ? "bg-muted text-muted-foreground"
            : ok
              ? "bg-accent text-accent-foreground"
              : "bg-destructive text-destructive-foreground",
        )}
      >
        {pending ? "..." : ok ? "ok" : "erro"}
      </span>
    </div>
  );
}

function MessageBubble({
  message,
  onCopy,
  onOpenArtifact,
  onRegenerate,
}: {
  message: UiMessage;
  onCopy: () => void;
  onOpenArtifact?: () => void;
  onRegenerate?: () => void;
}) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn("soft-enter flex gap-3 font-sans", isUser && "justify-end")}
    >
      {!isUser ? (
        <div className="mt-1 grid size-8 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
          <Bot className="size-4" />
        </div>
      ) : null}
      <div
        className={cn(
          "min-w-0 max-w-[calc(100%-2.75rem)] rounded-lg px-4 py-3 text-sm shadow-sm sm:max-w-[86%]",
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
          <SearchingSources />
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

        {!isUser && message.provider ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
            <span className="rounded bg-muted px-2 py-1">
              {message.provider}
              {message.model ? ` - ${message.model}` : ""}
            </span>
          </div>
        ) : null}

        {!isUser && message.sources?.length ? (
          <SourceCards sources={message.sources} />
        ) : null}

        {!isUser && message.content && message.status !== "error" ? (
          <TechnicalConfidence message={message} />
        ) : null}

        {message.content ? (
          <div
            className={cn(
              "mt-3 flex flex-wrap gap-1 border-t pt-3",
              isUser ? "border-white/15" : "border-border",
            )}
          >
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={onCopy}
            >
              <Copy className="size-3.5" />
              Copiar
            </Button>
            {onOpenArtifact ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={onOpenArtifact}
              >
                <FileText className="size-3.5" />
                Documento
              </Button>
            ) : null}
            {onRegenerate ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={onRegenerate}
              >
                <RotateCcw className="size-3.5" />
                Refazer
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      {isUser ? (
        <div className="mt-1 grid size-8 shrink-0 place-items-center rounded-md bg-muted">
          <UserRound className="size-4" />
        </div>
      ) : null}
    </div>
  );
}

function SearchingSources() {
  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
      <Search className="size-4 animate-pulse text-primary" />
      <div>
        <div className="font-medium text-foreground">Buscando fontes</div>
        <div className="text-xs">Consultando a web antes de responder.</div>
      </div>
    </div>
  );
}

function SourceCards({ sources }: { sources: SourceResult[] }) {
  return (
    <div className="mt-4 border-t border-border pt-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
        <ExternalLink className="size-3.5" />
        Fontes consultadas
      </div>
      <div className="grid gap-2">
        {sources.slice(0, 4).map((source, index) => (
          <a
            key={`${source.url}-${index}`}
            href={source.url}
            target="_blank"
            rel="noreferrer"
            className="hover-lift block rounded-md border border-border bg-muted/60 p-3 text-xs text-muted-foreground"
          >
            <span className="flex items-start gap-2">
              <span className="grid size-6 shrink-0 place-items-center rounded bg-background font-semibold text-foreground">
                {index + 1}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-medium text-foreground">
                  {source.title}
                </span>
                <span className="mt-1 line-clamp-2 block leading-5">
                  {source.snippet || source.url}
                </span>
                <span className="mt-2 inline-flex items-center gap-1 text-foreground">
                  {source.provider ?? "web"}
                  <ExternalLink className="size-3" />
                </span>
              </span>
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}

function TechnicalConfidence({ message }: { message: UiMessage }) {
  const hasSources = Boolean(message.sources?.length);
  const uncertain = /não tenho|não encontrei|pode variar|confirme|verificar/i.test(
    message.content,
  );
  const level = hasSources && !uncertain ? "Alta" : hasSources ? "Média" : "Triagem";

  return (
    <div className="mt-3 rounded-md border border-border bg-muted/50 p-3 text-xs leading-5 text-muted-foreground">
      <div className="flex items-center gap-2 font-medium text-foreground">
        {hasSources ? (
          <CheckCircle2 className="size-4 text-primary" />
        ) : (
          <ShieldCheck className="size-4 text-primary" />
        )}
        Confiança técnica: {level}
      </div>
      <div className="mt-1">
        {hasSources
          ? "Resposta apoiada por fontes consultadas; ainda confirme aplicação crítica por chassi, catálogo ou fabricante."
          : "Sem pesquisa online nesta resposta; use como triagem e confirme dados críticos antes de vender ou comprar."}
      </div>
    </div>
  );
}

async function readAttachment(file: File): Promise<UploadedAttachment> {
  const canReadText = isReadableText(file);
  const maxChars = 60000;

  if (!canReadText) {
    return {
      name: file.name,
      type: file.type,
      size: file.size,
    };
  }

  const text = await file.text();

  return {
    name: file.name,
    type: file.type || "text/plain",
    size: file.size,
    text: text.slice(0, maxChars),
    truncated: text.length > maxChars,
  };
}

function isReadableText(file: File) {
  if (file.type.startsWith("text/")) {
    return true;
  }

  return [
    ".txt",
    ".md",
    ".csv",
    ".json",
    ".xml",
    ".yaml",
    ".yml",
    ".sql",
    ".log",
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".py",
    ".php",
    ".html",
    ".css",
  ].some((extension) => file.name.toLowerCase().endsWith(extension));
}

function activeConversationTitle(
  conversations: UiConversation[],
  activeConversationId: string | null,
) {
  if (!activeConversationId) {
    return "Nova conversa";
  }

  return (
    conversations.find((conversation) => conversation.id === activeConversationId)
      ?.title ?? "Conversa"
  );
}

function generateArtifactTitle(content: string) {
  const firstLine = content
    .split("\n")
    .map((line) => line.replace(/^#+\s*/, "").trim())
    .find(Boolean);

  return truncate(firstLine ?? "Documento", 72);
}

function slugify(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "documento"
  );
}

function artifactVersionNumber(title: string, artifacts: UiArtifact[]) {
  const baseTitle = title.replace(/\s-\sversão\s\d+$/i, "");

  return (
    artifacts.filter((artifact) => artifact.title.startsWith(baseTitle)).length + 1
  );
}

function readGuestCount() {
  if (typeof document === "undefined") {
    return 0;
  }

  const match = document.cookie.match(/(?:^|; )truqpedia_guest_count=(\d+)/);
  return Number(match?.[1] ?? 0);
}
