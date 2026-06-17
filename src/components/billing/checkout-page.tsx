"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  LogIn,
  ReceiptText,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BillingPlan } from "@/lib/billing/plans";

type CheckoutPageProps = {
  plan: BillingPlan;
  userEmail?: string | null;
  subscription?: { planId: string; status: string; createdAt: string } | null;
  successParam?: string;
};

export function CheckoutPage({ plan, userEmail, subscription, successParam }: CheckoutPageProps) {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isSubscribed = subscription?.status === "active";
  const activePlanId = subscription?.planId;

  async function startCheckout() {
    setStatus(null);
    setLoading(true);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id }),
      });
      const data = (await response.json()) as {
        message?: string;
        checkoutUrl?: string;
        error?: string;
      };

      if (!response.ok) {
        setStatus(data.error ?? "Não foi possível iniciar o checkout.");
        return;
      }

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }

      setStatus(
        data.message ??
          "Checkout preparado. A integração do Mercado Pago entra no próximo passo.",
      );
    } catch {
      setStatus("Não foi possível iniciar o checkout.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-dvh bg-app text-foreground font-sans">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Voltar
        </Link>

        {/* Payment Success/Failure Banners */}
        <div className="mt-6">
          {successParam === "true" && (
            <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-4 text-green-600 text-sm leading-6 flex items-start gap-3 shadow-sm soft-enter">
              <CheckCircle2 className="size-5 shrink-0 mt-0.5 text-green-500" />
              <div>
                <h4 className="font-bold text-foreground inline-flex items-center gap-1.5">
                  <Sparkles className="size-4 text-amber-500 animate-pulse" />
                  Assinatura Ativada com Sucesso!
                </h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  Seu pagamento foi aprovado e sua conta foi atualizada. Você já tem acesso total aos recursos do seu plano contratado no chat técnico.
                </p>
              </div>
            </div>
          )}

          {successParam === "false" && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-destructive text-sm leading-6 flex items-start gap-3 shadow-sm soft-enter">
              <ShieldCheck className="size-5 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-foreground">Pagamento cancelado ou recusado</h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  Não foi possível concluir a contratação. Caso ache que foi um erro ou o valor tenha sido debitado, por favor entre em contato com nosso suporte técnico.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 grid items-start gap-4 lg:mt-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
          <section className="min-w-0 rounded-md border border-border bg-background p-4 shadow-sm sm:p-6">
            <div className="inline-flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
              <CreditCard className="size-4 text-primary" />
              Checkout do plano
            </div>
            <h1 className="mt-5 text-2xl font-semibold tracking-normal sm:text-3xl">
              Confirmar plano {plan.name}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              Revise o que está incluso, confirme a conta e avance para o
              pagamento. A integração do Mercado Pago será conectada nesta mesma
              etapa.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["Plano", "Escolha o melhor pacote para sua operação."],
                ["Conta", "Entre ou crie conta para salvar a assinatura."],
                ["Pagamento", "Mercado Pago entra no próximo passo."],
              ].map(([step, text], index) => (
                <div
                  key={step}
                  className="rounded-md border border-border bg-app p-3 text-sm"
                >
                  <div className="text-xs text-muted-foreground">
                    Passo {index + 1}
                  </div>
                  <div className="mt-1 font-medium">{step}</div>
                  <div className="mt-2 text-xs leading-5 text-muted-foreground">
                    {text}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-border bg-app p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <ReceiptText className="size-4 text-primary" />
                  Resumo da contratação
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Plano {plan.name}, {plan.priceDescription}. Você poderá
                  trocar gateway, cupom e regras de cobrança quando o Mercado
                  Pago estiver integrado.
                </p>
              </div>
              <div className="rounded-md border border-border bg-app p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <ShieldCheck className="size-4 text-primary" />
                  Acesso após pagamento
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  O fluxo foi preparado para ativar plano, registrar evento de
                  checkout e manter histórico de assinatura por usuário.
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-md border border-border bg-muted/60 p-4">
              <div className="flex gap-3 text-sm leading-6 text-muted-foreground">
                <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
                <span>
                  Você pode revisar o plano antes de entrar. Para iniciar o
                  checkout de verdade, a conta precisa estar autenticada.
                </span>
              </div>
            </div>
          </section>

          <aside className="rounded-md border border-border bg-background p-4 shadow-sm sm:p-5 lg:sticky lg:top-6">
            <div className="text-sm font-semibold">{plan.name}</div>
            <div className="mt-3 flex items-end gap-2">
              <div className="text-3xl font-semibold">{plan.price}</div>
              <div className="pb-1 text-xs text-muted-foreground">
                {plan.priceDescription}
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {plan.description}
            </p>

            <div className="mt-5 space-y-2 text-sm">
              {plan.features.map((feature) => (
                <div key={feature} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-md border border-border bg-app p-3 text-xs text-muted-foreground">
              Conta: {userEmail ?? "entre para continuar o checkout"}
            </div>

            {isSubscribed ? (
              <div className="mt-5 rounded-md border border-green-500/20 bg-green-500/5 p-3 text-xs text-green-600 flex gap-2">
                <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-green-500" />
                <div>
                  <span className="font-semibold block text-foreground">Assinatura Ativa</span>
                  Plano contratado: {activePlanId === "balcao" ? "Balcão" : activePlanId === "loja" ? "Loja" : "Operação"}
                </div>
              </div>
            ) : null}

            {isSubscribed ? (
              <Button className="mt-4 w-full" asChild>
                <Link href="/chat">
                  Ir para o Workspace (Chat)
                </Link>
              </Button>
            ) : userEmail ? (
              <Button
                className="mt-4 w-full"
                disabled={loading}
                onClick={startCheckout}
              >
                <CreditCard />
                {loading ? "Preparando..." : "Continuar para pagamento"}
              </Button>
            ) : (
              <Button className="mt-4 w-full" asChild>
                <Link href={`/login?next=${encodeURIComponent(`/checkout?plan=${plan.id}`)}`}>
                  <LogIn />
                  Entrar para continuar
                </Link>
              </Button>
            )}

            {status ? (
              <div className="mt-3 rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                {status}
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    </main>
  );
}
