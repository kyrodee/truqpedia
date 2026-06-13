"use client";

import { type FormEvent, type ReactNode, useEffect, useRef, useState } from "react";
import {
  Bot,
  Database,
  File,
  FileText,
  Gauge,
  Globe2,
  LogIn,
  LogOut,
  Menu,
  MoreHorizontal,
  Paperclip,
  PanelLeftClose,
  Pencil,
  Plus,
  Search,
  Send,
  Settings2,
  Sparkles,
  Trash2,
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
import { FREE_MESSAGE_LIMIT } from "@/lib/constants";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type {
  ChatMessage,
  ChatMode,
  ConversationSummary,
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

type UiMessage = ChatMessage & {
  id: string;
  status?: "streaming" | "error" | "done";
  sources?: SourceResult[];
  provider?: string;
  model?: string;
  attachments?: UploadedAttachment[];
};

type TruqpediaShellProps = {
  user: SessionUser | null;
  initialConversations: UiConversation[];
  initialMessages: UiMessage[];
  initialConversationId: string | null;
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

const starterPrompts = [
  "Identifique aplicações para filtro diesel com código FS19732",
  "Compare cubo de roda, rolamento e retentor para carreta",
  "Crie descrição de marketplace para compressor de ar de caminhão",
];

export function TruqpediaShell({
  user,
  initialConversations,
  initialMessages,
  initialConversationId,
}: TruqpediaShellProps) {
  const [conversations, setConversations] =
    useState<UiConversation[]>(initialConversations);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(initialConversationId);
  const [messages, setMessages] = useState<UiMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<ChatMode>("speed");
  const [webSearch, setWebSearch] = useState(false);
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authReason, setAuthReason] = useState<"limit" | "auth">("auth");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [projectHealth, setProjectHealth] = useState<ProjectHealth | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [guestCount, setGuestCount] = useState(0);
  const remainingGuestMessages = Math.max(0, FREE_MESSAGE_LIMIT - guestCount);

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

    setStatus(null);
    setInput("");
    const sentAttachments = attachments;
    setAttachments([]);
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
      status: "streaming",
    };

    const nextMessages = [...messages, userMessage, assistantMessage];
    setMessages(nextMessages);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversationId: activeConversationId,
          message: cleanInput,
          mode,
          webSearch,
          attachments: sentAttachments,
          clientMessages: user ? undefined : messages.slice(-16),
        }),
      });

      if (response.status === 402) {
        setMessages(messages);
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
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro inesperado no chat.";
      updateMessage(assistantMessage.id, {
        content: message,
        status: "error",
      });
    } finally {
      setIsStreaming(false);
    }
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
          updateMessage(assistantId, { sources: currentSources });
        }

        if (event.type === "provider") {
          updateMessage(assistantId, {
            provider: event.provider,
            model: event.model,
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
          ? { ...message, content: `${message.content}${token}` }
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
    setMode(data.conversation.mode);
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

  function newConversation() {
    if (isStreaming) {
      return;
    }

    setActiveConversationId(null);
    setMessages([]);
    setInput("");
    setAttachments([]);
    setStatus(null);
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
            <Button className="w-full justify-start" onClick={newConversation}>
              <Plus />
              Nova conversa
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-4">
            {user ? (
              <div className="space-y-1">
                {conversations.map((conversation) => (
                  <div
                    key={conversation.id}
                    className={cn(
                      "group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm transition-colors",
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
                  Especialista em pecas, aplicacoes e mecanica pesada
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden rounded-md border border-border bg-muted p-1 sm:flex">
                <button
                  type="button"
                  className={cn(
                    "flex h-8 items-center gap-2 rounded px-3 text-xs font-medium transition-colors",
                    mode === "speed"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground",
                  )}
                  onClick={() => setMode("speed")}
                >
                  <Gauge className="size-4" />
                  Rapido
                </button>
                <button
                  type="button"
                  className={cn(
                    "flex h-8 items-center gap-2 rounded px-3 text-xs font-medium transition-colors",
                    mode === "deep"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground",
                  )}
                  onClick={() => setMode("deep")}
                >
                  <Sparkles className="size-4" />
                  Profundo
                </button>
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
                <div className="flex flex-1 flex-col justify-center gap-6 py-12">
                  <div className="space-y-3">
                    <div className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground">
                      <Bot className="size-4 text-primary" />
                      Truqpedia pronto
                    </div>
                    <h1 className="max-w-2xl text-3xl font-semibold tracking-normal sm:text-4xl">
                      Encontre a resposta tecnica sem sair do fluxo de venda.
                    </h1>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-3">
                    {starterPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        className="rounded-md border border-border bg-background p-3 text-left text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                        onClick={() => setInput(prompt)}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-6 pb-6">
                  {messages.map((message) => (
                    <MessageBubble key={message.id} message={message} />
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
                  <div className="flex items-center gap-2 text-xs text-muted-foreground sm:hidden">
                    <button
                      type="button"
                      className={cn(
                        "rounded px-2 py-1",
                        mode === "speed" && "bg-muted text-foreground",
                      )}
                      onClick={() => setMode("speed")}
                    >
                      Rapido
                    </button>
                    <button
                      type="button"
                      className={cn(
                        "rounded px-2 py-1",
                        mode === "deep" && "bg-muted text-foreground",
                      )}
                      onClick={() => setMode("deep")}
                    >
                      Profundo
                    </button>
                  </div>
                </div>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    aria-label="Enviar mensagem"
                    type="submit"
                    size="icon"
                    className="size-12"
                    disabled={!input.trim() || isStreaming}
                  >
                    {isStreaming ? <TypingIndicator /> : <Send />}
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
          mode={mode}
          onModeChange={setMode}
          onOpenChange={setSettingsOpen}
          onWebSearchChange={setWebSearch}
          open={settingsOpen}
          user={user}
          webSearch={webSearch}
        />
      </div>
    </TooltipProvider>
  );
}

function ProjectSettingsDialog({
  health,
  loading,
  mode,
  onModeChange,
  onOpenChange,
  onWebSearchChange,
  open,
  user,
  webSearch,
}: {
  health: ProjectHealth | null;
  loading: boolean;
  mode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
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
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="geral">Geral</TabsTrigger>
            <TabsTrigger value="modelo">Modelo</TabsTrigger>
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
          </TabsContent>

          <TabsContent value="modelo" className="space-y-4">
            <div className="rounded-md border border-border p-4">
              <div className="mb-3 text-sm font-medium">Modo de resposta</div>
              <div className="inline-flex rounded-md border border-border bg-muted p-1">
                <button
                  type="button"
                  className={cn(
                    "flex h-8 items-center gap-2 rounded px-3 text-xs font-medium",
                    mode === "speed"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground",
                  )}
                  onClick={() => onModeChange("speed")}
                >
                  <Gauge className="size-4" />
                  Rapido
                </button>
                <button
                  type="button"
                  className={cn(
                    "flex h-8 items-center gap-2 rounded px-3 text-xs font-medium",
                    mode === "deep"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground",
                  )}
                  onClick={() => onModeChange("deep")}
                >
                  <Sparkles className="size-4" />
                  Profundo
                </button>
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

function MessageBubble({ message }: { message: UiMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3 font-sans", isUser && "justify-end")}>
      {!isUser ? (
        <div className="mt-1 grid size-8 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
          <Bot className="size-4" />
        </div>
      ) : null}
      <div
        className={cn(
          "min-w-0 max-w-[86%] rounded-lg px-4 py-3 text-sm shadow-sm",
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

        {!isUser && (message.provider || message.sources?.length) ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
            {message.provider ? (
              <span className="rounded bg-muted px-2 py-1">
                {message.provider}
                {message.model ? ` · ${message.model}` : ""}
              </span>
            ) : null}
            {message.sources?.map((source, index) => (
              <a
                key={source.url}
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="rounded bg-muted px-2 py-1 transition-colors hover:text-foreground"
              >
                Fonte {index + 1}
              </a>
            ))}
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

function readGuestCount() {
  if (typeof document === "undefined") {
    return 0;
  }

  const match = document.cookie.match(/(?:^|; )truqpedia_guest_count=(\d+)/);
  return Number(match?.[1] ?? 0);
}
