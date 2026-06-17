import { CheckoutPage } from "@/components/billing/checkout-page";
import { getBillingPlan } from "@/lib/billing/plans";
import { getCurrentUser } from "@/lib/supabase/server";

type PageProps = {
  searchParams?: Promise<{ plan?: string; success?: string; planId?: string }>;
};

export const dynamic = "force-dynamic";

export default async function CheckoutRoute({ searchParams }: PageProps) {
  const params = await searchParams;
  const { supabase, user } = await getCurrentUser();
  const plan = getBillingPlan(params?.plan ?? params?.planId);

  let subscription: { planId: string; status: string; createdAt: string } | null = null;

  if (supabase && user) {
    try {
      const { data } = await supabase
        .from("user_settings")
        .select("metadata")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data?.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata)) {
        const metadata = data.metadata as Record<string, unknown>;
        if (metadata.subscription && typeof metadata.subscription === "object") {
          subscription = metadata.subscription as {
            planId: string;
            status: string;
            createdAt: string;
          };
        }
      }
    } catch (err) {
      console.error("Error reading user subscription status on server:", err);
    }
  }

  return (
    <CheckoutPage
      plan={plan}
      userEmail={user?.email ?? null}
      subscription={subscription}
      successParam={params?.success}
    />
  );
}
