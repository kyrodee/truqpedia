import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { loadProviderConfigs } from "@/lib/ai/model-router";
import { getCurrentUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const { supabase, user } = await getCurrentUser();

  if (!supabase || !user) {
    redirect("/");
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    redirect("/");
  }

  const [{ data: metrics }, providers] = await Promise.all([
    supabase
      .from("provider_metrics")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(80),
    loadProviderConfigs(),
  ]);

  return (
    <AdminDashboard
      providers={providers}
      metrics={metrics ?? []}
    />
  );
}
