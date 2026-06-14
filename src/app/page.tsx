import { TruqpediaLanding } from "@/components/landing/truqpedia-landing";
import { getCurrentUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { user } = await getCurrentUser();

  return <TruqpediaLanding user={user ? { email: user.email } : null} />;
}

