"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Database,
  FileSearch,
  FileText,
  Layers,
  LogIn,
  MessageSquareText,
  PanelRight,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Truck,
  UserPlus,
  Wrench,
} from "lucide-react";
import { AuthModal } from "@/components/auth/auth-modal";
import { MarkdownMessage } from "@/components/markdown/markdown-message";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TypingIndicator } from "@/components/chat/typing-indicator";
import type { StreamEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

type LandingUser = {
  email?: string;
} | null;

type DemoMessage = {
  role: "user" | "assistant";
  content: string;
};

const demoPrompts = [
  "Cliente pediu lona 4515, mas tenho 4707. Como respondo?",
  "Crie um anúncio vendedor para filtro diesel FS19732",
  "Que perguntas faço para não vender a peça errada?",
];

const steps = [
  {
    icon: Search,
    title: "Digite a dúvida do balcão",
    text: "Código da peça, foto da etiqueta, aplicação, sintoma ou pergunta do cliente. O Truqpedia organiza a informação e mostra o que falta confirmar.",
  },
  {
    icon: FileSearch,
    title: "Receba uma resposta que ajuda a decidir",
    text: "Comparação, aplicação provável, riscos de incompatibilidade e perguntas certas para evitar compra errada ou devolução.",
  },
  {
    icon: ShieldCheck,
    title: "Venda com mais confiança",
    text: "Transforme a resposta em mensagem para WhatsApp, anúncio, checklist de compra ou orientação técnica para sua equipe.",
  },
];

const plans = [
  {
    name: "Balcão",
    price: "R$ 49",
    description: "Para responder cliente mais rápido sem perder cautela técnica.",
    features: ["Confirmação de aplicação", "Mensagens para cliente", "Histórico básico"],
  },
  {
    name: "Loja",
    price: "R$ 149",
    featured: true,
    description: "Para organizar clientes, frotas e orçamentos em um só lugar.",
    features: ["Projetos por cliente", "Busca online", "Anúncios e checklists"],
  },
  {
    name: "Operação",
    price: "Sob consulta",
    description: "Para distribuidoras e operações com equipe e base própria.",
    features: ["Equipe", "Integrações", "Base técnica própria"],
  },
];

const trustStats = [
  { label: "Aplicação", value: "perguntas certas antes de vender" },
  { label: "Fontes", value: "links quando a resposta precisa de prova" },
  { label: "Venda", value: "texto pronto para cliente e anúncio" },
];

const faqs = [
  {
    question: "O Truqpedia substitui catálogo ou fabricante?",
    answer:
      "Não. Ele acelera a análise, compara informações e mostra o que confirmar. Em peça crítica, a palavra final continua sendo catálogo, chassi ou fabricante.",
  },
  {
    question: "Serve para loja pequena?",
    answer:
      "Sim. A ideia é ajudar quem atende no balcão a responder melhor, pedir os dados certos e reduzir devolução por aplicação errada.",
  },
  {
    question: "Ele pesquisa na internet?",
    answer:
      "Sim, no chat completo você pode ativar pesquisa online. Quando houver fonte, a resposta mostra links e deixa claro o que foi usado.",
  },
  {
    question: "Preciso cadastrar para testar?",
    answer:
      "Você pode testar a IA pela landing. Ao criar conta, ganha histórico, projetos por cliente/frota e acesso ao chat completo.",
  },
];

export function TruqpediaLanding({ user }: { user: LandingUser }) {
  const [authOpen, setAuthOpen] = useState(false);
  const [authReason, setAuthReason] = useState<"limit" | "auth">("auth");
  const [authView, setAuthView] = useState<"login" | "signup">("login");
  const [input, setInput] = useState(demoPrompts[0]);
  const [messages, setMessages] = useState<DemoMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function submitDemo(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const cleanInput = input.trim();

    if (!cleanInput || isStreaming) {
      return;
    }

    setInput("");
    setStatus(null);
    setIsStreaming(true);

    const assistantIndex = messages.length + 1;
    const nextMessages: DemoMessage[] = [
      ...messages,
      { role: "user", content: cleanInput },
      { role: "assistant", content: "" },
    ];

    setMessages(nextMessages);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: cleanInput,
          mode: "deep",
          webSearch: false,
          clientMessages: messages.slice(-8),
        }),
      });

      if (response.status === 402) {
        setAuthReason("limit");
        setAuthView("signup");
        setAuthOpen(true);
        setStatus("Crie uma conta para continuar testando.");
        return;
      }

      if (!response.ok || !response.body) {
        throw new Error("Nao foi possivel testar a IA agora.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

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

          const payload = JSON.parse(line.slice(5).trim()) as StreamEvent;

          if (payload.type === "token") {
            setMessages((current) =>
              current.map((message, index) =>
                index === assistantIndex
                  ? { ...message, content: `${message.content}${payload.token}` }
                  : message,
              ),
            );
          }

          if (payload.type === "error") {
            setMessages((current) =>
              current.map((message, index) =>
                index === assistantIndex
                  ? { ...message, content: payload.message }
                  : message,
              ),
            );
          }
        }
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Erro no teste.");
    } finally {
      setIsStreaming(false);
    }
  }

  function openAuth(view: "login" | "signup") {
    setAuthReason("auth");
    setAuthView(view);
    setAuthOpen(true);
  }

  return (
    <main className="min-h-dvh bg-app text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground">
              <Wrench className="size-4" />
            </div>
            <div>
              <div className="text-sm font-semibold">Truqpedia</div>
              <div className="text-xs text-muted-foreground">
                IA para peças pesadas
              </div>
            </div>
          </div>
          <nav className="hidden items-center gap-5 text-sm text-muted-foreground md:flex">
            <a href="#como-funciona" className="hover:text-foreground">
              Como funciona
            </a>
            <a href="#planos" className="hover:text-foreground">
              Planos
            </a>
            <a href="#faq" className="hover:text-foreground">
              FAQ
            </a>
          </nav>
          {user ? (
            <Button asChild>
              <Link href="/chat">
                Abrir chat
                <ArrowRight />
              </Link>
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => openAuth("login")}>
                <LogIn />
                Entrar
              </Button>
              <Button onClick={() => openAuth("signup")}>
                <UserPlus />
                Cadastrar
              </Button>
            </div>
          )}
        </div>
      </header>

      <section className="border-b border-border">
        <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-6xl flex-col justify-center gap-8 px-4 py-10 sm:px-6">
          <div className="soft-enter max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground">
              <Sparkles className="size-4 text-primary" />
              Teste a IA antes de entrar
            </div>
            <h1 className="text-4xl font-semibold tracking-normal sm:text-6xl">
              Venda a peça certa com menos dúvida e menos devolução.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              O Truqpedia ajuda lojas, oficinas e distribuidores a confirmar
              aplicação, comparar códigos e transformar dúvidas técnicas em
              resposta pronta para o cliente.
            </p>
            {!user ? (
              <div className="flex flex-col gap-2 pt-2 sm:flex-row">
                <Button onClick={() => openAuth("signup")}>
                  <UserPlus />
                  Criar conta grátis
                </Button>
                <Button variant="outline" onClick={() => openAuth("login")}>
                  <LogIn />
                  Já tenho conta
                </Button>
              </div>
            ) : null}
            <div className="grid max-w-3xl gap-2 pt-2 sm:grid-cols-3">
              {trustStats.map((item) => (
                <div
                  key={item.label}
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  <div className="text-xs uppercase text-muted-foreground">
                    {item.label}
                  </div>
                  <div className="mt-1 font-medium">{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
            <div className="soft-enter rounded-md border border-border bg-background p-3 shadow-sm">
              <div className="flex items-center justify-between border-b border-border px-2 pb-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Bot className="size-4" />
                  Teste a IA
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Sparkles className="size-3.5" />
                  qualidade máxima
                </div>
              </div>

              <div className="min-h-[250px] space-y-4 px-2 py-4">
                {messages.length === 0 ? (
                  <div className="grid gap-2 sm:grid-cols-3">
                    {demoPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        className="hover-lift rounded-md border border-border bg-muted p-3 text-left text-sm text-muted-foreground"
                        onClick={() => setInput(prompt)}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                ) : (
                  messages.map((message, index) => (
                    <div
                      key={`${message.role}-${index}`}
                      className={cn(
                        "max-w-[88%] rounded-md px-3 py-2 text-sm leading-6",
                        message.role === "user"
                          ? "ml-auto bg-user-message text-user-message-foreground"
                          : "border border-border bg-background",
                        )}
                      >
                      {message.content ? (
                        message.role === "assistant" ? (
                          <MarkdownMessage
                            content={message.content}
                            className="prose-p:my-1 prose-ul:my-1"
                          />
                        ) : (
                          <div className="whitespace-pre-wrap">
                            {message.content}
                          </div>
                        )
                      ) : (
                        <TypingIndicator />
                      )}
                    </div>
                  ))
                )}
              </div>

              <form className="flex gap-2 border-t border-border pt-3" onSubmit={submitDemo}>
                <Textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Teste com um código, aplicação ou descrição..."
                  className="min-h-11 resize-none bg-input-shell"
                  rows={1}
                />
                <Button
                  type="submit"
                  size="icon"
                  className="size-11 shrink-0"
                  disabled={!input.trim() || isStreaming}
                >
                  {isStreaming ? <TypingIndicator /> : <Send />}
                </Button>
              </form>
              {status ? (
                <div className="mt-2 text-sm text-muted-foreground">{status}</div>
              ) : null}
            </div>

            <ProductPreview />
          </div>
        </div>
      </section>

      <section id="como-funciona" className="border-b border-border bg-background">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="mb-8 max-w-2xl">
            <h2 className="text-2xl font-semibold">Como funciona</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Feito para o dia a dia de quem precisa responder cliente,
              comparar peça e fechar orçamento sem apostar no escuro.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {steps.map((step) => (
              <div
                key={step.title}
                className="hover-lift rounded-md border border-border bg-app p-5"
              >
                <step.icon className="size-5 text-primary" />
                <div className="mt-4 text-sm font-semibold">{step.title}</div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {step.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="planos">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="mb-8 max-w-2xl">
            <h2 className="text-2xl font-semibold">Planos</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Comece pelo atendimento do balcão e evolua para equipe, frotas e
              base técnica própria.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={cn(
                  "hover-lift rounded-md border p-5",
                  plan.featured
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background",
                )}
              >
                <div className="text-sm font-semibold">{plan.name}</div>
                <div className="mt-3 text-2xl font-semibold">{plan.price}</div>
                <p
                  className={cn(
                    "mt-2 text-sm leading-6",
                    plan.featured
                      ? "text-primary-foreground/80"
                      : "text-muted-foreground",
                  )}
                >
                  {plan.description}
                </p>
                <div className="mt-5 space-y-2 text-sm">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-center gap-2">
                      <CheckCircle2 className="size-4" />
                      {feature}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="border-y border-border bg-background">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="mb-8 max-w-2xl">
            <h2 className="text-2xl font-semibold">Perguntas frequentes</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              O Truqpedia foi pensado para ajudar na decisão, sem fingir que
              catálogo e fabricante deixaram de importar.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {faqs.map((item) => (
              <div
                key={item.question}
                className="hover-lift rounded-md border border-border bg-app p-5"
              >
                <div className="text-sm font-semibold">{item.question}</div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {item.answer}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="bg-primary text-primary-foreground">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1fr_auto]">
          <div>
            <div className="flex items-center gap-3">
              <div className="grid size-9 place-items-center rounded-md bg-primary-foreground text-primary">
                <Wrench className="size-4" />
              </div>
              <div>
                <div className="text-sm font-semibold">Truqpedia</div>
                <div className="text-xs text-primary-foreground/70">
                  IA para vender peça pesada com mais confiança.
                </div>
              </div>
            </div>
            <p className="mt-4 max-w-xl text-sm leading-6 text-primary-foreground/75">
              Confirme aplicações, compare códigos e responda clientes com mais
              clareza. Sempre com cautela técnica onde a peça não pode estar
              errada.
            </p>
          </div>
          {!user ? (
            <div className="flex flex-col gap-2 sm:flex-row md:items-start">
              <Button
                variant="secondary"
                onClick={() => openAuth("signup")}
              >
                <UserPlus />
                Criar conta
              </Button>
              <Button
                variant="outline"
                className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
                onClick={() => openAuth("login")}
              >
                <LogIn />
                Entrar
              </Button>
            </div>
          ) : (
            <Button variant="secondary" asChild>
              <Link href="/chat">
                Abrir chat
                <ArrowRight />
              </Link>
            </Button>
          )}
        </div>
      </footer>

      <AuthModal
        initialView={authView}
        open={authOpen}
        onOpenChange={setAuthOpen}
        reason={authReason}
      />
    </main>
  );
}

function ProductPreview() {
  return (
    <div className="soft-enter grid content-start gap-3">
      <div className="overflow-hidden rounded-md border border-border bg-background shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Truck className="size-4" />
            Projeto Volvo VM 270
          </div>
          <div className="inline-flex items-center gap-1 rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
            <Search className="size-3.5" />
            online
          </div>
        </div>
        <div className="grid grid-cols-[118px_1fr] text-xs">
          <div className="border-r border-border bg-sidebar p-3">
            <div className="mb-3 flex items-center gap-2 font-medium">
              <Layers className="size-3.5" />
              Projetos
            </div>
            {["Frota 2024", "Catálogo filtros", "Oficina"].map((item, index) => (
              <div
                key={item}
                className={cn(
                  "mb-1 rounded px-2 py-1.5",
                  index === 0
                    ? "bg-sidebar-accent text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {item}
              </div>
            ))}
          </div>
          <div className="p-3">
            <div className="mb-3 flex items-center gap-2 text-muted-foreground">
              <MessageSquareText className="size-3.5" />
              Confirmar aplicação do filtro FS19732
            </div>
            <div className="rounded-md bg-user-message px-3 py-2 text-user-message-foreground">
              Serve no motor MWM? O cliente tem só a foto da peça.
            </div>
            <div className="mt-2 rounded-md border border-border bg-app px-3 py-2 leading-5">
              Peça provável de linha diesel. Confirme código gravado, rosca,
              dimensões e aplicação por catálogo antes da venda. [1]
            </div>
            <div className="mt-3 grid gap-2">
              <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-2 py-1.5 text-muted-foreground">
                <Database className="size-3.5" />
                Fonte 1 - catálogo consultado
              </div>
              <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-2 py-1.5 text-muted-foreground">
                <PanelRight className="size-3.5" />
                Documento pronto para orçamento
              </div>
            </div>
          </div>
        </div>
      </div>

      {[
        {
          icon: Layers,
          text: "Projetos por cliente, frota ou catálogo",
        },
        {
          icon: FileText,
          text: "Textos prontos para WhatsApp, anúncio e orçamento",
        },
        {
          icon: ShieldCheck,
          text: "Histórico e fontes para auditoria técnica",
        },
      ].map((item) => (
        <div
          key={item.text}
          className="hover-lift flex items-start gap-3 rounded-md border border-border bg-background p-4 text-sm"
        >
          <item.icon className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>{item.text}</span>
        </div>
      ))}
    </div>
  );
}
