"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, CreditCard, ShieldAlert, Sparkles, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getBillingPlan } from "@/lib/billing/plans";

function SimulateCheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planId = searchParams.get("planId") || "loja";
  const plan = getBillingPlan(planId);

  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadUser() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push(`/login?next=/checkout/simulate?planId=${planId}`);
          return;
        }
        setEmail(user.email ?? "usuário@truqpedia.com.br");
      } catch {
        setError("Erro ao autenticar usuário.");
      }
    }
    void loadUser();
  }, [planId, router]);

  async function handleSimulatePayment() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/checkout/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || "Erro ao simular pagamento.");
      }

      // Redirect back with success query param
      router.push(`/checkout?success=true&planId=${planId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido.");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-dvh bg-app text-foreground font-sans flex flex-col justify-between">
      {/* Header */}
      <header className="border-b border-border bg-background/88 backdrop-blur-xl px-4 py-3 sm:px-6">
        <div className="mx-auto max-w-5xl flex items-center justify-between">
          <Link href="/checkout" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" />
            Voltar ao site
          </Link>
          <div className="flex items-center gap-2 font-semibold text-sm">
            <div className="grid size-7 place-items-center rounded bg-primary text-primary-foreground">
              <Wrench className="size-3.5" />
            </div>
            Truqpedia
          </div>
        </div>
      </header>

      {/* Main card */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-background border border-border rounded-xl shadow-2xl overflow-hidden soft-enter">
          {/* Mercado Pago Simulated Banner */}
          <div className="bg-[#00aae4] px-6 py-5 text-white flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider font-semibold opacity-85">Sandbox Simulator</div>
              <h2 className="text-xl font-bold tracking-tight mt-0.5">Mercado Pago</h2>
            </div>
            <CreditCard className="size-8 opacity-90" />
          </div>

          <div className="p-6 space-y-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 rounded bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-600 border border-amber-500/20">
                <ShieldAlert className="size-3.5" />
                Ambiente de Testes / Desenvolvimento
              </div>
              <p className="text-xs text-muted-foreground leading-5">
                Esta página simula a resposta do gateway de pagamento real para que você teste a ativação da assinatura no banco de dados sem precisar configurar credenciais reais.
              </p>
            </div>

            {/* Plan Info box */}
            <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-xs text-muted-foreground uppercase font-semibold">Plano Selecionado</div>
                  <div className="text-base font-bold text-foreground mt-0.5">{plan.name}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground uppercase font-semibold">Valor</div>
                  <div className="text-base font-bold text-foreground mt-0.5">{plan.price}</div>
                </div>
              </div>
              <div className="border-t border-border/60 pt-2 flex justify-between items-center text-xs text-muted-foreground">
                <span>Comprador:</span>
                <span className="font-medium text-foreground truncate max-w-[200px]" title={email || ""}>
                  {email || "Carregando..."}
                </span>
              </div>
            </div>

            {plan.features.length > 0 ? (
              <div className="space-y-2">
                <div className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">O que está incluso:</div>
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex gap-2">
                      <CheckCircle2 className="size-4 shrink-0 text-[#00aae4]" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {error ? (
              <div className="rounded bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive">
                {error}
              </div>
            ) : null}

            <div className="flex flex-col gap-2">
              <Button
                className="w-full h-11 bg-[#00aae4] hover:bg-[#0092c4] text-white border-0 shadow-md font-semibold text-sm transition-all"
                disabled={loading || !email}
                onClick={handleSimulatePayment}
              >
                <Sparkles className="size-4 mr-2" />
                {loading ? "Processando Simulação..." : "Confirmar Pagamento Simulado"}
              </Button>
              <Button
                variant="outline"
                className="w-full h-10"
                asChild
              >
                <Link href="/checkout">Cancelar compra</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border bg-background/50 px-4 py-4 sm:px-6 text-center text-xs text-muted-foreground">
        <div className="mx-auto max-w-5xl">
          Truqpedia &copy; {new Date().getFullYear()} • Ambiente Seguro de Demonstração
        </div>
      </footer>
    </main>
  );
}

export default function SimulateCheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-dvh flex items-center justify-center bg-app text-foreground font-sans">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-4 border-[#00aae4] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm text-muted-foreground">Carregando simulador de pagamento...</p>
        </div>
      </div>
    }>
      <SimulateCheckoutContent />
    </Suspense>
  );
}
