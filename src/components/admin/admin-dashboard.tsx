"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Save, ShieldCheck, Timer, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { ProviderRuntimeConfig } from "@/lib/types";
import { cn } from "@/lib/utils";

type AdminMetric = {
  id?: string;
  provider_id: string;
  model: string;
  mode: string;
  latency_ms: number;
  success: boolean;
  error_message: string | null;
  created_at: string;
};

type AdminDashboardProps = {
  providers: ProviderRuntimeConfig[];
  metrics: AdminMetric[];
};

export function AdminDashboard({
  providers: initialProviders,
  metrics,
}: AdminDashboardProps) {
  const [providers, setProviders] = useState(initialProviders);
  const [saving, setSaving] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const successful = metrics.filter((metric) => metric.success).length;
  const failed = metrics.filter((metric) => !metric.success).length;
  const averageLatency =
    metrics.length > 0
      ? Math.round(
          metrics.reduce((sum, metric) => sum + (metric.latency_ms ?? 0), 0) /
            metrics.length,
        )
      : 0;

  function updateProvider(
    id: string,
    patch: Partial<ProviderRuntimeConfig>,
  ) {
    setProviders((current) =>
      current.map((provider) =>
        provider.id === id ? { ...provider, ...patch } : provider,
      ),
    );
  }

  async function saveProvider(provider: ProviderRuntimeConfig) {
    setSaving(provider.id);
    setStatus(null);

    const response = await fetch("/api/admin/providers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(provider),
    });

    setSaving(null);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setStatus(data?.error ?? "Nao foi possivel salvar.");
      return;
    }

    setStatus("Configuracao salva.");
  }

  return (
    <main className="min-h-dvh bg-app text-foreground">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:gap-6 sm:px-6 sm:py-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link
              href="/"
              className="mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              Voltar ao chat
            </Link>
            <h1 className="text-xl font-semibold tracking-normal sm:text-2xl">
              Painel administrativo
            </h1>
          </div>
          <div className="inline-flex w-full items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground sm:w-auto">
            <ShieldCheck className="size-4 text-primary" />
            Acesso administrativo
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard label="Sucessos" value={successful} tone="success" />
          <MetricCard label="Falhas" value={failed} tone="warning" />
          <MetricCard label="Latencia media" value={`${averageLatency} ms`} />
        </section>

        <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
          <div className="space-y-4">
            {providers.map((provider) => (
              <div
                key={provider.id}
                className="min-w-0 rounded-lg border border-border bg-background p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{provider.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {provider.id}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Label htmlFor={`${provider.id}-enabled`}>Ativo</Label>
                    <Switch
                      id={`${provider.id}-enabled`}
                      checked={provider.enabled}
                      onCheckedChange={(enabled) =>
                        updateProvider(provider.id, { enabled })
                      }
                    />
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <ConfigField
                    id={`${provider.id}-priority`}
                    label="Prioridade"
                    type="number"
                    value={String(provider.priority)}
                    onChange={(value) =>
                      updateProvider(provider.id, {
                        priority: Number(value),
                      })
                    }
                  />
                  <ConfigField
                    id={`${provider.id}-timeout`}
                    label="Timeout ms"
                    type="number"
                    value={String(provider.timeoutMs)}
                    onChange={(value) =>
                      updateProvider(provider.id, {
                        timeoutMs: Number(value),
                      })
                    }
                  />
                  <ConfigField
                    id={`${provider.id}-speed`}
                    label="Modelo rapido"
                    value={provider.speedModel}
                    onChange={(speedModel) =>
                      updateProvider(provider.id, { speedModel })
                    }
                  />
                  <ConfigField
                    id={`${provider.id}-deep`}
                    label="Modelo profundo"
                    value={provider.deepModel}
                    onChange={(deepModel) =>
                      updateProvider(provider.id, { deepModel })
                    }
                  />
                  <div className="md:col-span-2">
                    <ConfigField
                      id={`${provider.id}-base-url`}
                      label="Base URL"
                      value={provider.baseUrl ?? ""}
                      onChange={(baseUrl) =>
                        updateProvider(provider.id, {
                          baseUrl: baseUrl || undefined,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="mt-4 flex justify-stretch sm:justify-end">
                  <Button
                    className="w-full sm:w-auto"
                    onClick={() => saveProvider(provider)}
                    disabled={saving === provider.id}
                  >
                    <Save />
                    Salvar
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <aside className="rounded-lg border border-border bg-background p-4 shadow-sm xl:sticky xl:top-6 xl:max-h-[calc(100dvh-3rem)] xl:overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Eventos recentes</div>
                <div className="text-xs text-muted-foreground">
                  Ultimas chamadas de IA
                </div>
              </div>
              <Timer className="size-4 text-muted-foreground" />
            </div>

            <div className="space-y-3">
              {metrics.slice(0, 30).map((metric, index) => (
                <div
                  key={`${metric.created_at}-${index}`}
                  className="rounded-md border border-border bg-muted/45 p-3 text-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{metric.provider_id}</span>
                    <span
                      className={cn(
                        "rounded px-2 py-0.5 text-xs",
                        metric.success
                          ? "bg-primary/15 text-primary"
                          : "bg-destructive/15 text-destructive",
                      )}
                    >
                      {metric.success ? "OK" : "Falha"}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {metric.model} · {metric.mode} · {metric.latency_ms} ms
                  </div>
                  {metric.error_message ? (
                    <div className="mt-2 flex gap-2 text-xs text-destructive">
                      <TriangleAlert className="mt-0.5 size-3 shrink-0" />
                      <span className="line-clamp-3">{metric.error_message}</span>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </aside>
        </section>

        {status ? (
          <div className="fixed inset-x-4 bottom-4 rounded-md border border-border bg-popover px-4 py-3 text-sm shadow-xl sm:left-auto sm:right-4">
            {status}
          </div>
        ) : null}
      </div>
    </main>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: "success" | "warning";
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-4 shadow-sm">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div
        className={cn(
          "mt-2 text-3xl font-semibold tracking-normal",
          tone === "success" && "text-primary",
          tone === "warning" && "text-destructive",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function ConfigField({
  id,
  label,
  value,
  onChange,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
