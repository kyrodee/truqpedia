import { NextResponse } from "next/server";
import { z } from "zod";
import { getBillingPlan } from "@/lib/billing/plans";
import { logInfo } from "@/lib/logger";
import { readJsonBody } from "@/lib/request";
import { requireUser } from "@/lib/supabase/authz";
import { recordUsageLog } from "@/lib/usage/metrics";

export const dynamic = "force-dynamic";

const checkoutSchema = z.object({
  planId: z.enum(["balcao", "loja", "operacao"]),
});

export async function POST(request: Request) {
  const { user, response } = await requireUser();

  if (response || !user) {
    return response;
  }

  const jsonBody = await readJsonBody(request, 16 * 1024);

  if (!jsonBody.ok) {
    return jsonBody.response;
  }

  const parsed = checkoutSchema.safeParse(jsonBody.data);

  if (!parsed.success) {
    return NextResponse.json({ error: "Plano inválido." }, { status: 400 });
  }

  const plan = getBillingPlan(parsed.data.planId);

  // Check if we have Mercado Pago credentials in production
  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  await recordUsageLog({
    userId: user.id,
    eventType: "checkout_started",
    metadata: {
      planId: plan.id,
      provider: "mercado_pago",
      gatewayReady: Boolean(accessToken),
    },
  });

  logInfo("checkout.started", {
    userId: user.id,
    planId: plan.id,
    gatewayReady: Boolean(accessToken),
  });

  if (accessToken) {
    try {
      const price = plan.id === "balcao" ? 49.0 : plan.id === "loja" ? 149.0 : 499.0;
      
      const mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: [
            {
              id: plan.id,
              title: `Assinatura Truqpedia - Plano ${plan.name}`,
              quantity: 1,
              unit_price: price,
              currency_id: "BRL",
            }
          ],
          external_reference: `${user.id}:${plan.id}`,
          back_urls: {
            success: `${appUrl}/checkout?success=true&planId=${plan.id}`,
            pending: `${appUrl}/checkout?pending=true&planId=${plan.id}`,
            failure: `${appUrl}/checkout?success=false&planId=${plan.id}`,
          },
          auto_return: "approved",
          notification_url: appUrl.startsWith("https://") ? `${appUrl}/api/webhooks/mercado-pago` : undefined,
        }),
      });

      if (mpResponse.ok) {
        const mpData = (await mpResponse.json()) as { init_point?: string; id?: string };
        if (mpData.init_point) {
          return NextResponse.json({
            status: "success",
            checkoutUrl: mpData.init_point,
            preferenceId: mpData.id,
          });
        }
      }
      
      const errText = await mpResponse.text().catch(() => "Unknown API error");
      console.error("Mercado Pago Preference API error response:", errText);
    } catch (err) {
      console.error("Failed to connect to Mercado Pago Preference API:", err);
    }
  }

  // Fallback to local sandbox payment simulation if credentials are empty or API fails
  return NextResponse.json({
    status: "simulated",
    checkoutUrl: `/checkout/simulate?planId=${plan.id}`,
    message: "Redirecionando para portal de pagamento simulado.",
  });
}
