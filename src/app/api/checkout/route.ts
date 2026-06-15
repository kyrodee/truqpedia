import { NextResponse } from "next/server";
import { z } from "zod";
import { billingPlans, getBillingPlan } from "@/lib/billing/plans";
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

  await recordUsageLog({
    userId: user.id,
    eventType: "checkout_started",
    metadata: {
      planId: plan.id,
      provider: "mercado_pago",
      gatewayReady: false,
    },
  });

  logInfo("checkout.started", {
    userId: user.id,
    planId: plan.id,
    availablePlans: billingPlans.map((item) => item.id),
  });

  return NextResponse.json({
    status: "pending_gateway",
    provider: "mercado_pago",
    plan,
    message:
      "Checkout registrado. Quando a integração do Mercado Pago estiver ativa, este endpoint retornará a URL de pagamento.",
  });
}

