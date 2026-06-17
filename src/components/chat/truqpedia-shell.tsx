"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useRef, useState } from "react";
import {
  Folder,
  FolderPlus,
  LogIn,
  LogOut,
  Menu,
  MoreHorizontal,
  Paperclip,
  PanelLeftClose,
  Plus,
  Search,
  Send,
  Settings2,
  UserRound,
  Wrench,
  X,
  File,
  FileText,
  Pencil,
  Trash2,
  Bot,
  Truck,
  ClipboardList,
  ShieldCheck,
  BadgeCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DEFAULT_CHAT_MODE, FREE_MESSAGE_LIMIT } from "@/lib/constants";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type {
  AssistantPreferences,
  ChatMode,
  UploadedAttachment,
} from "@/lib/types";
import { cn, relativeTime, truncate } from "@/lib/utils";
import type {
  SessionUser,
  UiConversation,
  UiProject,
  UiArtifact,
  ProjectFile,
  UiMessage,
  SourceResult,
  StreamEvent,
} from "./types";
import { ConversationRenameDialog, ConversationDeleteDialog } from "./conversation-dialogs";
import { ProjectCreateDialog, ProjectSettingsDialog } from "./project-dialogs";
import { ProjectFilesDialog } from "./project-files-dialog";
import { ArtifactPanel } from "./artifact-panel";
import { MessageBubble } from "./message-bubble";

type TruqpediaShellProps = {
  user: SessionUser | null;
  initialConversations: UiConversation[];
  initialProjects: UiProject[];
  initialMessages: UiMessage[];
  initialConversationId: string | null;
  initialProjectId: string | null;
  initialAssistantPreferences: AssistantPreferences;
};

const workflowPrompts = [
  {
    icon: Truck,
    title: "Confirmar aplicação",
    description: "Código, veículo, ano, motor e alertas antes da venda.",
    prompt:
      "Aja como especialista de balcão em peças pesadas. Preciso confirmar a aplicação desta peça. Responda com: resumo objetivo, compatibilidades prováveis, dados que faltam para cravar, riscos de vender errado e checklist do que pedir ao cliente antes de fechar.",
  },
  {
    icon: Search,
    title: "Equivalência",
    description: "Compare códigos e marcas sem assumir compatibilidade.",
    prompt:
      "Compare estes códigos/marcas de peça como um comprador técnico. Não assuma equivalência sem prova. Monte uma tabela com função da peça, possíveis equivalências, diferenças críticas, medidas/dados para conferir, risco de incompatibilidade e recomendação final.",
  },
  {
    icon: ClipboardList,
    title: "Anúncio técnico",
    description: "Descrição de marketplace com cautela e bons filtros.",
    prompt:
      "Crie um anúncio pronto para marketplace de peça pesada. Entregue: título forte, descrição clara, benefícios práticos, aplicações prováveis sem prometer compatibilidade, perguntas para confirmar antes da compra e palavras-chave de busca.",
  },
  {
    icon: ShieldCheck,
    title: "Checklist de compra",
    description: "Perguntas para evitar devolução e compra errada.",
    prompt:
      "Monte um checklist de compra para evitar devolução. Separe por: perguntas ao cliente, conferência visual, medidas/códigos, sinais de alerta, quando pedir chassi/catálogo e mensagem curta para enviar ao cliente no WhatsApp.",
  },
];

const MIN_ACTIVITY_DWELL_MS = 3200;

export function TruqpediaShell({
  user,
  initialConversations,
  initialProjects,
  initialMessages,
  initialConversationId,
  initialProjectId,
  initialAssistantPreferences,
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
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [assistantPreferences, setAssistantPreferences] =
    useState<AssistantPreferences>(initialAssistantPreferences);
  const [preferencesSaving, setPreferencesSaving] = useState(false);
  const [settingsStatus, setSettingsStatus] = useState<string | null>(null);
  const [deletingAllChats, setDeletingAllChats] = useState(false);
  const [renameConversationTarget, setRenameConversationTarget] =
    useState<UiConversation | null>(null);
  const [renameConversationTitle, setRenameConversationTitle] = useState("");
  const [renamingConversation, setRenamingConversation] = useState(false);
  const [deleteConversationTarget, setDeleteConversationTarget] =
    useState<UiConversation | null>(null);
  const [deletingConversation, setDeletingConversation] = useState(false);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectSaving, setProjectSaving] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [isFilesDialogOpen, setIsFilesDialogOpen] = useState(false);
  const [filesDialogProject, setFilesDialogProject] = useState<UiProject | null>(null);
  const [projectFiles, setProjectFiles] = useState<ProjectFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const pollTimerRef = useRef<number | null>(null);

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
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        window.clearTimeout(pollTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isFilesDialogOpen && pollTimerRef.current) {
      window.clearTimeout(pollTimerRef.current);
    }
  }, [isFilesDialogOpen]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isStreaming]);

  async function submitMessage(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const cleanInput =
      input.trim() ||
      (attachments.length > 0
        ? "Analise os arquivos anexados e me ajude com uma orientação técnica."
        : "");

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
      status: "searching",
      activities: [],
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
          webSearch: "auto",
          attachments: sentAttachments,
          preferences: cleanAssistantPreferences(assistantPreferences),
          clientMessages: user ? undefined : history.slice(-16),
        }),
        signal: controller.signal,
      });

      if (response.status === 402) {
        setMessages(history);
        setInput(cleanInput);
        setAttachments(sentAttachments);
        setStatus("Crie uma conta para continuar conversando.");
        window.location.href = "/cadastro?next=/chat";
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
    let firstTokenRevealed = false;
    let revealAfter = Date.now() + MIN_ACTIVITY_DWELL_MS;

    if (!reader) {
      return;
    }

    const waitUntilActivityIsReadable = async () => {
      if (firstTokenRevealed) {
        return;
      }

      const remaining = revealAfter - Date.now();

      if (remaining > 0) {
        await sleep(remaining);
      }

      firstTokenRevealed = true;
    };

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

        if (event.type === "activity") {
          revealAfter = Date.now() + MIN_ACTIVITY_DWELL_MS;
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantId
                ? {
                    ...message,
                    activities: [
                      ...(message.activities ?? []),
                      { label: event.label, detail: event.detail },
                    ],
                    status: "searching",
                  }
                : message,
            ),
          );
        }

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
            status: firstTokenRevealed ? "streaming" : "searching",
          });
        }

        if (event.type === "token") {
          await waitUntilActivityIsReadable();
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

  const startPollingFiles = (projectId: string) => {
    if (pollTimerRef.current) {
      window.clearTimeout(pollTimerRef.current);
    }

    pollTimerRef.current = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}/files`);
        if (!response.ok) return;
        const data = (await response.json()) as { files?: ProjectFile[] };
        setProjectFiles(data.files ?? []);

        const hasPending = data.files?.some(
          (f) => f.status === "uploaded" || f.status === "processing"
        );

        if (hasPending && isFilesDialogOpen) {
          startPollingFiles(projectId);
        }
      } catch (err) {
        console.error("Error polling files:", err);
      }
    }, 2000) as unknown as number;
  };

  async function loadProjectFiles(projectId: string) {
    setLoadingFiles(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/files`);
      if (!response.ok) {
        throw new Error("Erro ao carregar arquivos");
      }
      const data = (await response.json()) as { files?: ProjectFile[] };
      setProjectFiles(data.files ?? []);

      const hasPending = data.files?.some(
        (f) => f.status === "uploaded" || f.status === "processing"
      );

      if (hasPending) {
        startPollingFiles(projectId);
      }
    } catch (err) {
      console.error(err);
      setStatus("Não foi possível carregar os arquivos.");
    } finally {
      setLoadingFiles(false);
    }
  }

  function openProjectFilesDialog(project: UiProject) {
    setFilesDialogProject(project);
    setIsFilesDialogOpen(true);
    loadProjectFiles(project.id);
  }

  async function handleProjectFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !filesDialogProject) return;

    setUploadingFile(true);
    setUploadProgress("Enviando arquivo...");

    try {
      const supabase = createSupabaseBrowserClient();
      const fileExt = file.name.split(".").pop();
      const uniqueId = Math.random().toString(36).substring(2, 11);
      const storagePath = `${user?.id}/${filesDialogProject.id}/${uniqueId}.${fileExt}`;

      // 1. Upload directly to storage bucket 'document-assets'
      const { error: uploadError } = await supabase.storage
        .from("document-assets")
        .upload(storagePath, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      setUploadProgress("Processando extração de texto...");

      // 2. Trigger the process API
      const res = await fetch(`/api/projects/${filesDialogProject.id}/process`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          storagePath,
          fileName: file.name,
          mimeType: file.type,
          size: file.size,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Erro no processamento RAG.");
      }

      setUploadProgress("Pronto!");
      await loadProjectFiles(filesDialogProject.id);
    } catch (err) {
      console.error("Erro no upload do RAG:", err);
      alert(err instanceof Error ? err.message : "Erro ao carregar e processar arquivo.");
    } finally {
      setUploadingFile(false);
      setUploadProgress("");
      if (event.target) {
        event.target.value = "";
      }
    }
  }

  async function deleteProjectFile(fileId: string) {
    if (!filesDialogProject) return;
    const confirmed = window.confirm("Tem certeza que deseja remover este catálogo do projeto? Os dados associados serão removidos do chat.");
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/projects/${filesDialogProject.id}/files?fileId=${fileId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Erro ao excluir arquivo.");
      }

      await loadProjectFiles(filesDialogProject.id);
    } catch (err) {
      console.error("Erro ao deletar arquivo:", err);
      alert("Erro ao excluir arquivo.");
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

  function applyWorkflowPrompt(prompt: string) {
    setInput(prompt);
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

  function openRenameConversationDialog(conversation: UiConversation) {
    if (isStreaming) {
      return;
    }

    setRenameConversationTarget(conversation);
    setRenameConversationTitle(conversation.title);
  }

  async function renameConversation(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    if (!renameConversationTarget) {
      return;
    }

    const title = renameConversationTitle.trim();

    if (!title) {
      return;
    }

    setRenamingConversation(true);

    try {
      const response = await fetch(
        `/api/conversations/${renameConversationTarget.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        },
      );

      if (!response.ok) {
        setStatus("Nao foi possivel renomear a conversa.");
        return;
      }

      const data = (await response.json()) as {
        conversation: {
          id: string;
          title: string;
          mode: ChatMode;
          created_at: string;
          updated_at: string;
        };
      };
      setConversations((current) =>
        current.map((item) =>
          item.id === renameConversationTarget.id
            ? {
                ...item,
                title: data.conversation.title,
                updatedAt: data.conversation.updated_at,
              }
            : item,
        ),
      );
      setRenameConversationTarget(null);
      setRenameConversationTitle("");
    } catch {
      setStatus("Nao foi possivel renomear a conversa.");
    } finally {
      setRenamingConversation(false);
    }
  }

  function openDeleteConversationDialog(conversation: UiConversation) {
    if (isStreaming) {
      return;
    }

    setDeleteConversationTarget(conversation);
  }

  async function deleteConversation() {
    if (!deleteConversationTarget) {
      return;
    }

    setDeletingConversation(true);

    try {
      const response = await fetch(
        `/api/conversations/${deleteConversationTarget.id}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        setStatus("Nao foi possivel excluir a conversa.");
        return;
      }

      const deletedId = deleteConversationTarget.id;
      setConversations((current) =>
        current.filter((item) => item.id !== deletedId),
      );

      if (activeConversationId === deletedId) {
        newConversation();
      }
      setDeleteConversationTarget(null);
    } catch {
      setStatus("Nao foi possivel excluir a conversa.");
    } finally {
      setDeletingConversation(false);
    }
  }

  async function saveAssistantPreferences() {
    if (!user) {
      return;
    }

    setPreferencesSaving(true);
    setSettingsStatus(null);

    try {
      const response = await fetch("/api/user-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assistantPreferences: cleanAssistantPreferences(assistantPreferences),
        }),
      });

      if (!response.ok) {
        setSettingsStatus("Não foi possível salvar as preferências.");
        return;
      }

      setSettingsStatus("Preferências salvas.");
    } catch {
      setSettingsStatus("Não foi possível salvar as preferências.");
    } finally {
      setPreferencesSaving(false);
    }
  }

  async function deleteAllConversations() {
    if (!user || deletingAllChats) {
      return;
    }

    const confirmed = window.confirm(
      "Apagar todas as conversas? Esta ação remove o histórico de chat da sua conta.",
    );

    if (!confirmed) {
      return;
    }

    setDeletingAllChats(true);
    setSettingsStatus(null);

    try {
      const response = await fetch("/api/conversations", {
        method: "DELETE",
      });

      if (!response.ok) {
        setSettingsStatus("Não foi possível apagar as conversas.");
        return;
      }

      setConversations([]);
      setMessages([]);
      setActiveConversationId(null);
      setProjects((current) =>
        current.map((project) => ({ ...project, conversationIds: [] })),
      );
      setSettingsStatus("Conversas apagadas.");
    } catch {
      setSettingsStatus("Não foi possível apagar as conversas.");
    } finally {
      setDeletingAllChats(false);
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
      <div className="flex h-dvh min-w-0 overflow-hidden bg-app text-foreground">
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 flex w-[min(310px,calc(100vw-0.75rem))] flex-col border-r border-sidebar-border bg-sidebar/95 backdrop-blur-xl transition-transform md:static md:w-[300px] md:translate-x-0 lg:w-[310px]",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="flex min-h-16 items-center justify-between gap-3 px-3 py-2 sm:px-4">
            <div className="flex items-center gap-3">
              <div className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground shadow-sm">
                <Wrench className="size-4" />
              </div>
              <div>
                <div className="text-sm font-semibold">Truqpedia</div>
                <div className="truncate text-xs text-muted-foreground">
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
                            <DropdownMenuItem onClick={() => openProjectFilesDialog(project)}>
                              <File className="size-4 mr-2" />
                              Arquivos
                            </DropdownMenuItem>
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
                              onClick={() =>
                                openRenameConversationDialog(conversation)
                              }
                            >
                              <Pencil />
                              Renomear
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() =>
                                openDeleteConversationDialog(conversation)
                              }
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
                  asChild
                >
                  <Link href="/login?next=/chat">
                    <LogIn />
                    Entrar
                  </Link>
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
          <header className="flex min-h-16 items-center justify-between gap-2 border-b border-border bg-background/85 px-2 py-2 backdrop-blur-xl sm:px-5">
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

            <div className="flex shrink-0 items-center gap-1">
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
                <Button variant="outline" className="px-2 sm:px-4" asChild>
                  <Link href="/login?next=/chat">
                    <LogIn />
                    <span className="hidden sm:inline">Entrar</span>
                  </Link>
                </Button>
              ) : null}
            </div>
          </header>

          <section className="flex-1 overflow-y-auto">
            <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col px-3 py-4 sm:px-6 sm:py-6">
              {messages.length === 0 ? (
                <div className="soft-enter flex flex-1 flex-col justify-center gap-5 py-8 sm:gap-6 sm:py-10">
                  <div className="space-y-3">
                    <div className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground">
                      <Bot className="size-4 text-primary" />
                      {activeProject ? activeProject.name : "Truqpedia pronto"}
                    </div>
                    <h1 className="max-w-2xl text-2xl font-semibold tracking-normal sm:text-4xl">
                      Escolha um fluxo e chegue numa resposta técnica mais segura.
                    </h1>
                    <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                      O melhor resultado vem quando a IA sabe se você quer
                      vender, comparar, diagnosticar ou transformar a resposta
                      em documento.
                    </p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    {workflowPrompts.map((item) => (
                      <button
                        key={item.title}
                        className="hover-lift rounded-md border border-border bg-background p-4 text-left shadow-sm"
                        onClick={() => applyWorkflowPrompt(item.prompt)}
                      >
                        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                          <item.icon className="size-4 text-primary" />
                          {item.title}
                        </span>
                        <span className="mt-2 block text-sm leading-6 text-muted-foreground">
                          {item.description}
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="grid gap-3 rounded-md border border-border bg-background p-3 text-sm text-muted-foreground sm:p-4 lg:grid-cols-3">
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
                      <span>A pesquisa aparece durante a resposta quando for necessária.</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6 pb-6">
                  {messages.map((message) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      onCopy={
                        message.role === "assistant"
                          ? () => void copyMessage(message.content)
                          : undefined
                      }
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

          <div className="mobile-safe-bottom border-t border-border bg-background/90 px-2 py-2 backdrop-blur-xl sm:px-6 sm:py-3">
            <form
              className="mx-auto flex max-w-5xl items-end gap-1.5 sm:gap-2"
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
                    className="size-10 shrink-0 sm:size-11"
                    disabled={attachments.length >= 8}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Anexar arquivo</TooltipContent>
              </Tooltip>

              <div className="min-w-0 flex-1 rounded-md border border-border bg-input-shell p-1 shadow-sm">
                <Textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void submitMessage();
                    }
                  }}
                  placeholder="Pergunte por código, aplicação, equivalência, sintoma ou descrição comercial..."
                  className="min-h-10 border-0 bg-transparent px-2 py-2 shadow-none focus-visible:ring-0 sm:min-h-9 sm:py-1.5"
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
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    aria-label={isStreaming ? "Parar geração" : "Enviar mensagem"}
                    type={isStreaming ? "button" : "submit"}
                    size="icon"
                    className="size-10 shrink-0 sm:size-11"
                    disabled={!input.trim() && attachments.length === 0 && !isStreaming}
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

        <ProjectSettingsDialog
          deletingAllChats={deletingAllChats}
          onOpenChange={setSettingsOpen}
          onDeleteAllConversations={() => void deleteAllConversations()}
          onPreferencesChange={setAssistantPreferences}
          onSavePreferences={() => void saveAssistantPreferences()}
          open={settingsOpen}
          preferences={assistantPreferences}
          preferencesSaving={preferencesSaving}
          status={settingsStatus}
          user={user}
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
        <ConversationRenameDialog
          conversation={renameConversationTarget}
          onOpenChange={(open) => {
            if (!open) {
              setRenameConversationTarget(null);
              setRenameConversationTitle("");
            }
          }}
          onSubmit={renameConversation}
          onTitleChange={setRenameConversationTitle}
          saving={renamingConversation}
          title={renameConversationTitle}
        />
        <ConversationDeleteDialog
          conversation={deleteConversationTarget}
          deleting={deletingConversation}
          onConfirm={() => void deleteConversation()}
          onOpenChange={(open) => {
            if (!open) {
              setDeleteConversationTarget(null);
            }
          }}
        />
        {artifactOpen ? (
          <button
            aria-label="Fechar documento"
            className="fixed inset-0 z-30 bg-black/40 lg:hidden"
            onClick={() => setArtifactOpen(false)}
          />
        ) : null}
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
        <ProjectFilesDialog
          open={isFilesDialogOpen}
          onOpenChange={setIsFilesDialogOpen}
          project={filesDialogProject}
          files={projectFiles}
          loading={loadingFiles}
          uploading={uploadingFile}
          uploadProgress={uploadProgress}
          onUpload={handleProjectFileUpload}
          onDelete={deleteProjectFile}
        />
      </div>
    </TooltipProvider>
  );
}

function isServerParsable(file: File) {
  const name = file.name.toLowerCase();
  return (
    file.type === "application/pdf" ||
    name.endsWith(".pdf") ||
    file.type.includes("excel") ||
    file.type.includes("spreadsheetml") ||
    name.endsWith(".xlsx") ||
    name.endsWith(".xls")
  );
}

async function readAttachment(file: File): Promise<UploadedAttachment> {
  const maxChars = 60000;

  if (isServerParsable(file)) {
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/attachments/parse", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Erro na resposta do parser");
      }

      const result = (await response.json()) as UploadedAttachment;
      return result;
    } catch (err) {
      console.error("Falha ao extrair texto do anexo:", err);
      return {
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
      };
    }
  }

  const canReadText = isReadableText(file);

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

function cleanAssistantPreferences(
  preferences: AssistantPreferences,
): AssistantPreferences {
  return Object.fromEntries(
    Object.entries(preferences)
      .map(([key, value]) => [key, typeof value === "string" ? value.trim() : value])
      .filter(([, value]) => Boolean(value)),
  ) as AssistantPreferences;
}

function readGuestCount() {
  if (typeof document === "undefined") {
    return 0;
  }

  const match = document.cookie.match(/(?:^|; )truqpedia_guest_count=(\d+)/);
  return Number(match?.[1] ?? 0);
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
