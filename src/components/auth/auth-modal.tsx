"use client";

import { FormEvent, useMemo, useState } from "react";
import { KeyRound, LogIn, Mail, UserPlus } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
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

type AuthModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason?: "limit" | "auth";
};

export function AuthModal({ open, onOpenChange, reason }: AuthModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const supabase = useMemo(() => {
    try {
      return createSupabaseBrowserClient();
    } catch {
      return null;
    }
  }, []);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);

    if (!supabase) {
      setStatus("Configure o Supabase para habilitar autenticação.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);

    if (error) {
      setStatus(error.message);
      return;
    }

    window.location.reload();
  }

  async function signUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);

    if (!supabase) {
      setStatus("Configure o Supabase para habilitar cadastro.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
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

    setStatus("Cadastro criado. Confirme seu e-mail para continuar.");
  }

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);

    if (!supabase) {
      setStatus("Configure o Supabase para habilitar recuperação.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    });
    setLoading(false);

    if (error) {
      setStatus(error.message);
      return;
    }

    setStatus("Enviamos as instruções para seu e-mail.");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {reason === "limit" ? "Continue com sua conta" : "Acesse o Truqpedia"}
          </DialogTitle>
          <DialogDescription>
            {reason === "limit"
              ? "Seu teste gratuito terminou. Entre ou crie uma conta para manter o histórico e continuar usando."
              : "Entre para recuperar conversas, sincronizar histórico e usar o Truqpedia no dia a dia."}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="login">
              <LogIn className="mr-2 size-4" />
              Entrar
            </TabsTrigger>
            <TabsTrigger value="signup">
              <UserPlus className="mr-2 size-4" />
              Criar
            </TabsTrigger>
            <TabsTrigger value="reset">
              <KeyRound className="mr-2 size-4" />
              Senha
            </TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <form className="space-y-4" onSubmit={signIn}>
              <Field
                id="login-email"
                label="E-mail"
                type="email"
                value={email}
                onChange={setEmail}
              />
              <Field
                id="login-password"
                label="Senha"
                type="password"
                value={password}
                onChange={setPassword}
              />
              <Button className="w-full" disabled={loading}>
                <LogIn />
                Entrar
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form className="space-y-4" onSubmit={signUp}>
              <Field
                id="signup-name"
                label="Nome"
                value={fullName}
                onChange={setFullName}
              />
              <Field
                id="signup-company"
                label="Empresa"
                value={companyName}
                onChange={setCompanyName}
              />
              <Field
                id="signup-email"
                label="E-mail"
                type="email"
                value={email}
                onChange={setEmail}
              />
              <Field
                id="signup-password"
                label="Senha"
                type="password"
                value={password}
                onChange={setPassword}
              />
              <Button className="w-full" disabled={loading}>
                <UserPlus />
                Criar conta
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="reset">
            <form className="space-y-4" onSubmit={resetPassword}>
              <Field
                id="reset-email"
                label="E-mail"
                type="email"
                value={email}
                onChange={setEmail}
              />
              <Button className="w-full" disabled={loading}>
                <Mail />
                Enviar link
              </Button>
            </form>
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

type FieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
};

function Field({ id, label, value, onChange, type = "text" }: FieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
      />
    </div>
  );
}

