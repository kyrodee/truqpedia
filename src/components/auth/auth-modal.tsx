"use client";

import { type FormEvent, useMemo, useState } from "react";
import { Mail } from "lucide-react";
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
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type ForgotPasswordModalProps = {
  email?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ForgotPasswordModal({
  email = "",
  open,
  onOpenChange,
}: ForgotPasswordModalProps) {
  const [resetEmail, setResetEmail] = useState(email);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const supabase = useMemo(() => {
    try {
      return createSupabaseBrowserClient();
    } catch {
      return null;
    }
  }, []);

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);

    if (!supabase) {
      setStatus("Recuperação indisponível no momento.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/auth/callback?next=/chat`,
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
          <DialogTitle>Recuperar senha</DialogTitle>
          <DialogDescription>
            Informe seu e-mail para receber um link seguro de recuperação.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={resetPassword}>
          <div className="space-y-2">
            <Label htmlFor="reset-email">E-mail</Label>
            <Input
              id="reset-email"
              type="email"
              value={resetEmail}
              onChange={(event) => setResetEmail(event.target.value)}
              required
            />
          </div>
          <Button className="w-full" disabled={loading}>
            <Mail />
            {loading ? "Enviando..." : "Enviar link"}
          </Button>
        </form>

        {status ? (
          <div className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
            {status}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

