import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/authz";

export const dynamic = "force-dynamic";

export async function GET() {
  const { supabase, response } = await requireAdmin();

  if (response || !supabase) {
    return response;
  }

  const { data, error } = await supabase
    .from("provider_metrics")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ metrics: data ?? [] });
}
