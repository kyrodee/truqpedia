import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { optionalEnv } from "@/lib/utils";

export function createSupabaseAdminClient() {
  const url = optionalEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = optionalEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !serviceRoleKey) {
    return null;
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

