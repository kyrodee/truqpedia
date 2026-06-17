import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_CHAT_MODE } from "@/lib/constants";
import { logInfo, logError } from "@/lib/logger";
import type { Database } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

// Webhooks are called anonymously by Mercado Pago, so we use the admin/service-role client to write to the db
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey);

type Json = Database["public"]["Tables"]["user_settings"]["Row"]["metadata"];

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const searchParams = url.searchParams;

    // Mercado Pago sends the payload ID and resource type
    // They can send as query params (e.g. topic=payment, id=123) or in the JSON body
    let resourceId = searchParams.get("data.id") || searchParams.get("id");
    let topic = searchParams.get("type") || searchParams.get("topic");

    if (!resourceId || !topic) {
      const body = (await request.json().catch(() => ({}))) as {
        action?: string;
        type?: string;
        data?: { id?: string };
      };
      
      resourceId = body.data?.id ?? null;
      topic = body.type ?? null;
    }

    logInfo("webhook.mercado_pago.received", { topic, resourceId });

    if (topic === "payment" && resourceId) {
      const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
      if (!accessToken) {
        logError("webhook.mercado_pago.missing_token", { resourceId });
        return NextResponse.json({ error: "Access token not configured" }, { status: 500 });
      }

      // Fetch payment details directly from Mercado Pago API
      const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${resourceId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!mpResponse.ok) {
        logError("webhook.mercado_pago.payment_fetch_failed", {
          resourceId,
          status: mpResponse.status,
          statusText: mpResponse.statusText,
        });
        // Return 200 to Mercado Pago to acknowledge receipt of webhook and prevent loops
        return NextResponse.json({ received: true, error: "Failed to fetch payment details" });
      }

      const payment = (await mpResponse.json()) as {
        status?: string;
        external_reference?: string;
        id?: number;
      };

      logInfo("webhook.mercado_pago.payment_status", {
        paymentId: payment.id,
        status: payment.status,
        externalReference: payment.external_reference,
      });

      // Check if the payment was approved
      if (payment.status === "approved" && payment.external_reference) {
        const parts = payment.external_reference.split(":");
        if (parts.length === 2) {
          const [userId, planId] = parts;

          // Fetch current user settings
          const { data: current, error: fetchErr } = await supabaseAdmin
            .from("user_settings")
            .select("metadata")
            .eq("user_id", userId)
            .maybeSingle();

          if (fetchErr) {
            logError("webhook.mercado_pago.db_fetch_error", { userId, error: fetchErr.message });
            return NextResponse.json({ error: fetchErr.message }, { status: 500 });
          }

          // Build new metadata subscription structure
          const metadata = {
            ...(isJsonObject(current?.metadata) ? current.metadata : {}),
            subscription: {
              planId,
              status: "active",
              createdAt: new Date().toISOString(),
              paymentId: String(payment.id),
              provider: "mercado_pago",
            },
          };

          // Update settings in database
          const { error: upsertErr } = await supabaseAdmin.from("user_settings").upsert({
            user_id: userId,
            default_mode: DEFAULT_CHAT_MODE,
            web_search_enabled: true,
            locale: "pt-BR",
            metadata,
          });

          if (upsertErr) {
            logError("webhook.mercado_pago.db_write_error", { userId, error: upsertErr.message });
            return NextResponse.json({ error: upsertErr.message }, { status: 500 });
          }

          logInfo("webhook.mercado_pago.subscription_activated", { userId, planId, paymentId: payment.id });
        }
      }
    }

    // Always acknowledge to Mercado Pago
    return NextResponse.json({ received: true });
  } catch (err) {
    logError("webhook.mercado_pago.uncaught_exception", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ received: true, error: "Uncaught error" });
  }
}

function isJsonObject(value: Json | undefined): value is Record<string, Json | undefined> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
