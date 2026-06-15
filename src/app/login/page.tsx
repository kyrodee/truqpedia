import { redirect } from "next/navigation";
import { AuthPage } from "@/components/auth/auth-page";
import { getCurrentUser } from "@/lib/supabase/server";

type PageProps = {
  searchParams?: Promise<{ next?: string }>;
};

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { user } = await getCurrentUser();
  const nextPath = safeNext(params?.next);

  if (user) {
    redirect(nextPath);
  }

  return <AuthPage mode="login" nextPath={nextPath} />;
}

function safeNext(value: string | undefined) {
  if (!value?.startsWith("/") || value.startsWith("//")) {
    return "/chat";
  }

  return value;
}

