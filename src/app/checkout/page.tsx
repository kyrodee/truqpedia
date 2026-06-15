import { CheckoutPage } from "@/components/billing/checkout-page";
import { getBillingPlan } from "@/lib/billing/plans";
import { getCurrentUser } from "@/lib/supabase/server";

type PageProps = {
  searchParams?: Promise<{ plan?: string }>;
};

export const dynamic = "force-dynamic";

export default async function CheckoutRoute({ searchParams }: PageProps) {
  const params = await searchParams;
  const { user } = await getCurrentUser();
  const plan = getBillingPlan(params?.plan);

  return <CheckoutPage plan={plan} userEmail={user?.email ?? null} />;
}
