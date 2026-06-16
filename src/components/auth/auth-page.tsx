"use client";

import Link from "next/link";
import { type FormEvent, useMemo, useState } from "react";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  KeyRound,
  LogIn,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Wrench,
} from "lucide-react";
import { ForgotPasswordModal } from "@/components/auth/auth-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

type AuthPageProps = {
  mode: "login" | "signup";
  nextPath?: string;
};

export function AuthPage({ mode, nextPath = "/chat" }: AuthPageProps) {
  const isSignup = mode === "signup";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [forgotOpen, setForgotOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const supabase = useMemo(() => {
    try {
      return createSupabaseBrowserClient();
    } catch {
      return null;
    }
  }, []);

  const loginHref = withNext("/login", nextPath);
  const signupHref = withNext("/cadastro", nextPath);
  const success = status?.toLowerCase().includes("cadastro criado");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);

    if (!supabase) {
      setStatus("Autenticação indisponível no momento.");
      return;
    }

    setLoading(true);

    if (isSignup) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
          data: {
            full_name: fullName,
            company_name: companyName,
          },
        },
      });

      setLoading(false);

      if (error) {
        setStatus(error.message);
        return;
      }

      setStatus("Cadastro criado. Confirme seu e-mail para acessar.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setStatus(error.message);
      return;
    }

    window.location.href = nextPath;
  }

  return (
    <main className="min-h-dvh bg-app text-foreground">
      <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-3 px-3 py-2 sm:px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          <span className="hidden sm:inline">Voltar para a página inicial</span>
          <span className="sm:hidden">Voltar</span>
        </Link>
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold">
          <div className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground">
            <Wrench className="size-4" />
          </div>
          Truqpedia
        </Link>
      </div>

      <div className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,450px)] lg:items-center lg:py-0">
        <AuthShowcase isSignup={isSignup} />

        <section className="flex min-w-0 justify-center">
          <div className="flex w-full max-w-md flex-col rounded-md border border-border bg-background p-4 shadow-sm sm:p-6 lg:max-w-[420px]">
            <div className="grid grid-cols-2 rounded-md bg-muted p-1 text-sm">
              <Link
                href={loginHref}
                className={cn(
                  "rounded px-3 py-2 text-center font-medium text-muted-foreground transition-colors",
                  !isSignup && "bg-background text-foreground shadow-sm",
                )}
              >
                Entrar
              </Link>
              <Link
                href={signupHref}
                className={cn(
                  "rounded px-3 py-2 text-center font-medium text-muted-foreground transition-colors",
                  isSignup && "bg-background text-foreground shadow-sm",
                )}
              >
                Cadastrar
              </Link>
            </div>

            <div className="mt-5">
              <div className="grid size-10 place-items-center rounded-md bg-primary text-primary-foreground">
                <ShieldCheck className="size-5" />
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-normal">
                {isSignup ? "Crie sua conta" : "Entre no Truqpedia"}
              </h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground lg:leading-5">
                {isSignup
                  ? "Organize atendimento, projetos e respostas técnicas em um workspace feito para autopeças."
                  : "Continue de onde parou com seus projetos, conversas e histórico técnico."}
              </p>
            </div>

            <form className="mt-5 space-y-3.5" onSubmit={submit}>
              {isSignup ? (
                <>
                  <Field
                    id="signup-name"
                    label="Nome"
                    value={fullName}
                    onChange={setFullName}
                    autoComplete="name"
                    placeholder="Seu nome"
                  />
                  <Field
                    id="signup-company"
                    label="Empresa"
                    value={companyName}
                    onChange={setCompanyName}
                    autoComplete="organization"
                    placeholder="Loja, oficina ou distribuidora"
                  />
                </>
              ) : null}
              <Field
                id="auth-email"
                label="E-mail"
                type="email"
                value={email}
                onChange={setEmail}
                autoComplete="email"
                placeholder="voce@empresa.com.br"
              />
              <Field
                id="auth-password"
                label="Senha"
                type="password"
                value={password}
                onChange={setPassword}
                autoComplete={isSignup ? "new-password" : "current-password"}
                minLength={6}
                placeholder="Mínimo de 6 caracteres"
              />

              {!isSignup ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => setForgotOpen(true)}
                >
                  <KeyRound className="size-4" />
                  Esqueci minha senha
                </button>
              ) : null}

              <Button className="h-11 w-full" disabled={loading}>
                {isSignup ? <UserPlus /> : <LogIn />}
                {loading
                  ? "Aguarde..."
                  : isSignup
                    ? "Criar conta"
                    : "Entrar"}
              </Button>
            </form>

            {status ? (
              <div
                className={cn(
                  "mt-4 rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground",
                  success && "bg-accent text-accent-foreground",
                )}
              >
                {status}
              </div>
            ) : null}

            <div className="mt-4 border-t border-border pt-4 text-sm text-muted-foreground">
              {isSignup ? (
                <>
                  Já tem conta?{" "}
                  <Link href={loginHref} className="font-medium text-foreground">
                    Entrar
                  </Link>
                </>
              ) : (
                <>
                  Ainda não tem conta?{" "}
                  <Link
                    href={signupHref}
                    className="font-medium text-foreground"
                  >
                    Criar conta
                  </Link>
                </>
              )}
            </div>
          </div>
        </section>
      </div>

      <ForgotPasswordModal
        email={email}
        open={forgotOpen}
        onOpenChange={setForgotOpen}
      />
    </main>
  );
}

type FieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  minLength?: number;
  placeholder?: string;
};

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  minLength,
  placeholder,
}: FieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        minLength={minLength}
        placeholder={placeholder}
        required
      />
    </div>
  );
}

function AuthShowcase({ isSignup }: { isSignup: boolean }) {
  return (
    <section className="hidden min-w-0 lg:flex">
      <div className="flex min-h-[600px] w-full max-w-2xl flex-col items-start justify-center">
        <div className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm">
          <Sparkles className="size-4 text-primary" />
          {isSignup ? "Comece com o workspace completo" : "Bem-vindo de volta"}
        </div>
        <h2 className="mt-5 text-4xl font-semibold tracking-normal xl:text-5xl">
          {isSignup
            ? "Um cockpit técnico para vender melhor em autopeças."
            : "Suas conversas técnicas continuam organizadas."}
        </h2>
        <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">
          Use IA para transformar dúvidas soltas em atendimento claro, checklist
          de confirmação, resposta para cliente e histórico pesquisável por
          cliente, frota ou orçamento.
        </p>

        <div className="mt-8 grid max-w-xl gap-3">
          {[
            {
              icon: MessageSquareText,
              title: "Chat técnico conversativo",
              text: "A IA pergunta quando falta dado e explica o que pode ou não concluir.",
            },
            {
              icon: Building2,
              title: "Projetos por operação",
              text: "Organize frotas, compras, orçamentos, catálogo e dúvidas recorrentes.",
            },
            {
              icon: ShieldCheck,
              title: "Mais segurança no atendimento",
              text: "Pesquisa automática, fontes quando precisa e cautela antes de prometer aplicação.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="hover-lift rounded-md border border-border bg-background p-4"
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

        <div className="mt-6 rounded-md border border-border bg-background p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between text-xs">
            <span className="font-medium">Resumo do atendimento</span>
            <span className="text-muted-foreground">pronto para usar</span>
          </div>
          <div className="grid gap-2 text-xs">
            {[
              "Confirmar código gravado e aplicação por catálogo.",
              "Pedir foto da peça antiga antes de prometer equivalência.",
              "Enviar resposta clara ao cliente com próximos passos.",
            ].map((item) => (
              <div
                key={item}
                className="flex items-center gap-2 rounded-md bg-app px-3 py-2"
              >
                <CheckCircle2 className="size-3.5 shrink-0 text-primary" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function withNext(path: "/login" | "/cadastro", nextPath: string) {
  if (nextPath === "/chat") {
    return path;
  }

  return `${path}?next=${encodeURIComponent(nextPath)}`;
}
