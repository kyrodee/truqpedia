import { NextResponse } from "next/server";
import {
  getProductionConfigStatus,
  getSearchProviderStatus,
} from "@/lib/server-config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const config = getProductionConfigStatus();
  const search = getSearchProviderStatus();
  const supabase = createSupabaseAdminClient();
  let database: "ok" | "not_configured" | "error" = "not_configured";

  if (supabase) {
    const { error } = await supabase
      .from("ai_provider_settings")
      .select("id")
      .limit(1);

    database = error ? "error" : "ok";
  }

  const checks = {
    ...config,
    database,
    searchProviders: [...search.configured, search.fallback],
  };
  const ready = Object.values(config).every(Boolean) && database === "ok";

  return NextResponse.json(
    {
      status: ready ? "ok" : "degraded",
      checks,
    },
    {
      status: ready ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
