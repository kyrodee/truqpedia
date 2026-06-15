"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  FileSearch,
  FileText,
  LogIn,
  MessageSquareText,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Truck,
  UserPlus,
  Wrench,
} from "lucide-react";
import { TypingIndicator } from "@/components/chat/typing-indicator";
import { MarkdownMessage } from "@/components/markdown/markdown-message";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { billingPlans } from "@/lib/billing/plans";
import type { SourceResult, StreamEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

type LandingUser = {
  email?: string;
} | null;

type DemoMessage = {
  role: "user" | "assistant";
  content: string;
  activities?: Array<{ label: string; detail?: string }>;
  sources?: SourceResult[];
};

const demoPrompts = [
  "Cliente chegou com foto e código parcial. Que dados eu preciso pedir antes de vender?",
  "Compare lona 4515 com 4707 e me ajude a responder sem prometer errado.",
  "Monte uma mensagem de WhatsApp para confirmar aplicação do filtro FS19732.",
];

const audiences = ["Balcão", "Oficina", "Compras", "Estoque", "E-commerce"];

const trustStats = [
  { label: "Menos retrabalho", value: "perguntas certas antes do pedido" },
  { label: "Mais clareza", value: "respostas prontas para cliente e equipe" },
  { label: "Histórico útil", value: "projetos por cliente, frota ou orçamento" },
];

const demoHighlights = [
  {
    icon: FileSearch,
    title: "Confere antes de responder",
    text: "Quando a pergunta depende de dados externos, a IA pesquisa e mostra o que está consultando.",
  },
  {
    icon: ShieldCheck,
    title: "Responde com cautela técnica",
    text: "Ela separa o que dá para concluir, o que precisa confirmar e como evitar venda errada.",
  },
  {
    icon: FileText,
    title: "Transforma em atendimento",
    text: "Gera texto para WhatsApp, resumo para orçamento, checklist e orientação para a equipe.",
  },
];

const steps = [
  {
    icon: Search,
    title: "Chega uma dúvida real",
    text: "Código incompleto, foto da peça, sintoma, motor, chassi, orçamento ou mensagem do cliente.",
  },
  {
    icon: Bot,
    title: "A IA organiza o raciocínio",
    text: "Ela identifica riscos, dados faltantes, equivalências possíveis e quando precisa consultar fontes.",
  },
  {
    icon: MessageSquareText,
    title: "Você responde melhor",
    text: "Receba uma resposta clara, conversativa e pronta para usar no balcão, na oficina ou no WhatsApp.",
  },
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
      "Sim. A ideia é ajudar quem atende no balcão a pedir os dados certos, responder melhor e reduzir devolução por aplicação errada.",
  },
  {
    question: "Ele pesquisa na internet?",
    answer:
      "Sim. No chat completo a pesquisa é automática: o assistente decide quando precisa consultar fontes e mostra o que está fazendo.",
  },
  {
    question: "Preciso cadastrar para testar?",
    answer:
      "Você pode testar a IA pela landing. Ao criar conta, ganha histórico, projetos por cliente/frota e acesso ao chat completo.",
  },
];

export function TruqpediaLanding({ user }: { user: LandingUser }) {
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
      { role: "assistant", content: "", activities: [] },
    ];

    setMessages(nextMessages);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: cleanInput,
          mode: "deep",
          webSearch: "auto",
          clientMessages: messages
            .slice(-8)
            .filter((message) => message.content)
            .map(({ role, content }) => ({ role, content })),
        }),
      });

      if (response.status === 402) {
        const limitMessage =
          "A demonstração chegou ao limite desta sessão. Crie uma conta para continuar e salvar o histórico.";

        setStatus(limitMessage);
        setMessages((current) =>
          current.map((message, index) =>
            index === assistantIndex
              ? { ...message, content: limitMessage }
              : message,
          ),
        );
        return;
      }

      if (!response.ok || !response.body) {
        throw new Error("Não foi possível testar a IA agora.");
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

          if (payload.type === "activity") {
            setMessages((current) =>
              current.map((message, index) =>
                index === assistantIndex
                  ? {
                      ...message,
                      activities: [
                        ...(message.activities ?? []),
                        { label: payload.label, detail: payload.detail },
                      ],
                    }
                  : message,
              ),
            );
          }

          if (payload.type === "sources") {
            setMessages((current) =>
              current.map((message, index) =>
                index === assistantIndex
                  ? { ...message, sources: payload.sources }
                  : message,
              ),
            );
          }

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
      const message = error instanceof Error ? error.message : "Erro no teste.";
      setStatus(message);
      setMessages((current) =>
        current.map((item, index) =>
          index === assistantIndex ? { ...item, content: message } : item,
        ),
      );
    } finally {
      setIsStreaming(false);
    }
  }

  return (
    <main className="min-h-dvh bg-app text-foreground">
      <LandingHeader user={user} />
      <HeroSection user={user} />
      <DemoSection
        input={input}
        isStreaming={isStreaming}
        messages={messages}
        onInputChange={setInput}
        onPromptSelect={setInput}
        onSubmit={submitDemo}
        status={status}
      />
      <HowItWorksSection />
      <PlansSection />
      <FaqSection />
      <LandingFooter user={user} />
    </main>
  );
}

function LandingHeader({ user }: { user: LandingUser }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/88 backdrop-blur-xl">
      <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-2 px-3 py-2 sm:gap-3 sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
            <Wrench className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">Truqpedia</div>
            <div className="hidden text-xs text-muted-foreground sm:block">
              IA para autopeças
            </div>
          </div>
        </Link>
        <nav className="hidden items-center gap-5 text-sm text-muted-foreground md:flex">
          <a href="#demonstracao" className="hover:text-foreground">
            Demonstração
          </a>
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
              <span className="hidden sm:inline">Abrir chat</span>
              <ArrowRight />
            </Link>
          </Button>
        ) : (
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" className="px-3 sm:px-4" asChild>
              <Link href="/login">
                <LogIn />
                <span className="hidden sm:inline">Entrar</span>
              </Link>
            </Button>
            <Button className="px-3 sm:px-4" asChild>
              <Link href="/cadastro">
                <UserPlus />
                <span className="hidden sm:inline">Cadastrar</span>
              </Link>
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}

function HeroSection({ user }: { user: LandingUser }) {
  return (
    <section className="relative isolate overflow-hidden border-b border-border bg-app">
      <div className="mx-auto flex min-h-[calc(100svh-4rem)] max-w-6xl flex-col justify-center px-4 py-10 sm:min-h-[calc(82dvh-4rem)] sm:px-6 sm:py-14 lg:min-h-[calc(78dvh-4rem)] lg:py-20">
        <div className="relative z-10 max-w-4xl soft-enter">
          <div className="inline-flex max-w-full items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm">
            <Sparkles className="size-4 text-primary" />
            Para quem trabalha com autopeças todos os dias
          </div>
          <h1 className="mt-5 max-w-4xl text-3xl font-semibold tracking-normal sm:text-5xl lg:text-6xl">
            Decisão técnica mais clara do balcão ao estoque.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
            O Truqpedia ajuda a entender pedidos confusos, comparar códigos,
            confirmar aplicações e responder clientes com a segurança que a
            rotina de autopeças exige.
          </p>
          <div className="mt-7 flex flex-col gap-2 sm:flex-row">
            {user ? (
              <Button className="w-full sm:w-auto" asChild>
                <Link href="/chat">
                  Abrir workspace
                  <ArrowRight />
                </Link>
              </Button>
            ) : (
              <>
                <Button className="w-full sm:w-auto" asChild>
                  <Link href="/cadastro">
                    <UserPlus />
                    Criar conta grátis
                  </Link>
                </Button>
                <Button className="w-full sm:w-auto" variant="outline" asChild>
                  <a href="#demonstracao">
                    Testar sem cadastro
                    <ArrowRight />
                  </a>
                </Button>
              </>
            )}
          </div>
          <div className="mt-7 flex flex-wrap gap-2">
            {audiences.map((audience) => (
              <span
                key={audience}
                className="rounded-md border border-border bg-background/90 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm"
              >
                {audience}
              </span>
            ))}
          </div>
        </div>

        <div className="relative z-10 mt-10 grid gap-2 sm:grid-cols-3 lg:max-w-4xl">
          {trustStats.map((item) => (
            <div
              key={item.label}
              className="soft-enter rounded-md border border-border bg-background/90 px-4 py-3 text-sm shadow-sm"
            >
              <div className="text-xs uppercase text-muted-foreground">
                {item.label}
              </div>
              <div className="mt-1 font-medium">{item.value}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function DemoSection({
  input,
  isStreaming,
  messages,
  onInputChange,
  onPromptSelect,
  onSubmit,
  status,
}: {
  input: string;
  isStreaming: boolean;
  messages: DemoMessage[];
  onInputChange: (value: string) => void;
  onPromptSelect: (value: string) => void;
  onSubmit: (event?: FormEvent<HTMLFormElement>) => void;
  status: string | null;
}) {
  return (
    <section id="demonstracao" className="border-b border-border bg-background">
      <div className="mx-auto grid max-w-6xl items-stretch gap-6 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,390px)_minmax(0,1fr)] lg:gap-8 lg:py-16">
        <div className="flex h-full flex-col">
          <div className="inline-flex items-center gap-2 rounded-md border border-border bg-app px-3 py-1.5 text-xs font-medium text-muted-foreground">
            <Bot className="size-4 text-primary" />
            Demonstração
          </div>
          <h2 className="mt-4 text-3xl font-semibold tracking-normal">
            Teste com uma dúvida que apareceria na sua operação.
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Escreva como falaria no balcão. A IA responde em Markdown, conversa
            com você, pesquisa quando faz sentido e mostra o raciocínio enquanto
            trabalha.
          </p>
          <div className="mt-6 grid flex-1 gap-3 sm:grid-cols-3 lg:grid-cols-1 lg:grid-rows-3">
            {demoHighlights.map((item) => (
              <div
                key={item.title}
                className="rounded-md border border-border bg-app p-4"
              >
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <item.icon className="size-4 text-primary" />
                  {item.title}
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="min-w-0 flex h-full flex-col rounded-md border border-border bg-app p-3 shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-border px-2 pb-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <MessageSquareText className="size-4" />
                Assistente Truqpedia
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Resposta técnica, fonte quando precisa e texto pronto para usar.
              </div>
            </div>
          </div>

          <div className="min-h-[320px] flex-1 space-y-4 overflow-y-auto px-1 py-4 sm:min-h-[380px] sm:px-2 lg:min-h-[410px]">
            {messages.length === 0 ? (
              <DemoEmptyState onPromptSelect={onPromptSelect} />
            ) : (
              messages.map((message, index) => (
                <DemoBubble key={`${message.role}-${index}`} message={message} />
              ))
            )}
          </div>

          <form
            className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row"
            onSubmit={onSubmit}
          >
            <Textarea
              value={input}
              onChange={(event) => onInputChange(event.target.value)}
              placeholder="Ex.: cliente quer trocar referência, mas só tem foto da peça..."
              className="min-h-20 resize-none bg-input-shell sm:min-h-16"
              rows={2}
            />
            <Button
              type="submit"
              className="h-11 w-full shrink-0 sm:h-16 sm:w-12"
              size="icon"
              disabled={!input.trim() || isStreaming}
              aria-label="Enviar teste"
            >
              {isStreaming ? <TypingIndicator /> : <Send />}
            </Button>
          </form>
          {status ? (
            <div className="mt-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
              {status}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function DemoEmptyState({
  onPromptSelect,
}: {
  onPromptSelect: (value: string) => void;
}) {
  return (
    <div className="rounded-md border border-dashed border-border bg-background/70 p-5">
      <div className="grid gap-4 md:grid-cols-[1fr_220px] md:items-center">
        <div>
          <div className="grid size-11 place-items-center rounded-md bg-primary text-primary-foreground">
            <Truck className="size-5" />
          </div>
          <div className="mt-4 text-sm font-semibold">
            Comece por uma situação real
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Use um exemplo ou descreva uma dúvida do balcão, da oficina, de
            compras ou do e-commerce. Quanto mais contexto, melhor a resposta.
          </p>
        </div>
        <div className="grid gap-2">
          {demoPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              className="rounded-md border border-border bg-app px-3 py-2 text-left text-xs leading-5 text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => onPromptSelect(prompt)}
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function DemoBubble({ message }: { message: DemoMessage }) {
  const isUser = message.role === "user";
  const hasActivities = !isUser && Boolean(message.activities?.length);

  return (
    <div className={cn("flex", isUser && "justify-end")}>
      <div
        className={cn(
          "max-w-[94%] rounded-md px-3 py-2 text-sm leading-6",
          isUser
            ? "bg-user-message text-user-message-foreground"
            : "border border-border bg-background",
        )}
      >
        {hasActivities ? (
          <DemoActivities activities={message.activities ?? []} />
        ) : null}

        {message.content ? (
          isUser ? (
            <div className="whitespace-pre-wrap">{message.content}</div>
          ) : (
            <MarkdownMessage
              content={message.content}
              className={cn(
                "prose-p:my-1 prose-ul:my-1",
                hasActivities && "mt-3 border-t border-border pt-3",
              )}
            />
          )
        ) : hasActivities ? null : (
          <TypingIndicator />
        )}

        {!isUser && message.sources?.length ? (
          <div className="mt-3 grid gap-1 border-t border-border pt-2 text-xs text-muted-foreground">
            {message.sources.slice(0, 3).map((source, index) => (
              <a
                key={`${source.url}-${index}`}
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="truncate rounded bg-muted px-2 py-1 hover:text-foreground"
                title={source.title}
              >
                Fonte {index + 1}: {source.title || source.url}
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function DemoActivities({
  activities,
}: {
  activities: Array<{ label: string; detail?: string }>;
}) {
  return (
    <div className="space-y-2 text-xs">
      {activities.slice(-4).map((activity, index) => (
        <div key={`${activity.label}-${index}`} className="flex gap-2">
          <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
          <span>
            <span className="block font-medium">{activity.label}</span>
            {activity.detail ? (
              <span className="text-muted-foreground">{activity.detail}</span>
            ) : null}
          </span>
        </div>
      ))}
    </div>
  );
}

function HowItWorksSection() {
  return (
    <section id="como-funciona" className="border-b border-border bg-background">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="mb-8 max-w-2xl">
          <h2 className="text-2xl font-semibold">Como funciona</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Feito para quem precisa responder cliente, comparar peça e fechar
            orçamento sem apostar no escuro.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
  );
}

function PlansSection() {
  return (
    <section id="planos">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="mb-8 max-w-2xl">
          <h2 className="text-2xl font-semibold">Planos</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Comece pelo atendimento do balcão e evolua para equipe, frotas e
            base técnica própria.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {billingPlans.map((plan) => (
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
              <div
                className={cn(
                  "mt-1 text-xs",
                  plan.featured
                    ? "text-primary-foreground/70"
                    : "text-muted-foreground",
                )}
              >
                {plan.priceDescription}
              </div>
              <p
                className={cn(
                  "mt-3 text-sm leading-6",
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
                    <CheckCircle2 className="size-4 shrink-0" />
                    {feature}
                  </div>
                ))}
              </div>
              <Button
                className="mt-5 w-full"
                variant={plan.featured ? "secondary" : "outline"}
                asChild
              >
                <Link href={`/checkout?plan=${plan.id}`}>
                  {plan.checkoutLabel}
                  <ArrowRight />
                </Link>
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqSection() {
  return (
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
  );
}

function LandingFooter({ user }: { user: LandingUser }) {
  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:px-6 md:grid-cols-[1fr_auto] md:gap-8">
        <div>
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-md bg-primary-foreground text-primary">
              <Wrench className="size-4" />
            </div>
            <div>
              <div className="text-sm font-semibold">Truqpedia</div>
              <div className="text-xs text-primary-foreground/70">
                IA para trabalhar melhor com autopeças.
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
            <Button className="w-full sm:w-auto" variant="secondary" asChild>
              <Link href="/cadastro">
                <UserPlus />
                Criar conta
              </Link>
            </Button>
            <Button
              variant="outline"
              className="w-full border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground sm:w-auto"
              asChild
            >
              <Link href="/login">
                <LogIn />
                Entrar
              </Link>
            </Button>
          </div>
        ) : (
          <Button className="w-full sm:w-auto" variant="secondary" asChild>
            <Link href="/chat">
              Abrir chat
              <ArrowRight />
            </Link>
          </Button>
        )}
      </div>
    </footer>
  );
}
