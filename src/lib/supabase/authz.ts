import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function requireUser() {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return {
      supabase: null,
      user: null,
      response: NextResponse.json(
        { error: "Supabase is not configured." },
        { status: 503 },
      ),
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      supabase,
      user: null,
      response: NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      ),
    };
  }

  return { supabase, user, response: null };
}

export async function requireAdmin() {
  const result = await requireUser();

  if (result.response || !result.supabase || !result.user) {
    return result;
  }

  const { data: profile } = await result.supabase
    .from("user_profiles")
    .select("role")
    .eq("id", result.user.id)
    .single();

  if (profile?.role !== "admin") {
    return {
      ...result,
      response: NextResponse.json(
        { error: "Admin access required." },
        { status: 403 },
      ),
    };
  }

  return result;
}

