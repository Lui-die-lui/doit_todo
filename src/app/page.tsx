import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { DemoConstellationGate } from "@/components/observatory/DemoConstellationGate";

export const dynamic = "force-dynamic";

// The first screen a signed-out visitor lands on: the same decorative, data-free
// "locked observatory" gate /dashboard shows signed out (no owner-scoped query runs
// here). The login/signup form itself lives at /login, one click away.
export default async function HomePage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return <DemoConstellationGate />;
}
