import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { AuthScreen } from "@/components/auth/AuthScreen";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <Suspense>
      <AuthScreen />
    </Suspense>
  );
}
