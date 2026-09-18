import Link from "next/link";
import { createTaskAction } from "@/lib/actions/tasks";
import { getActivePlans } from "@/lib/queries";
import { TaskForm } from "@/components/TaskForm";
import { requireSessionOrRedirect } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams: Promise<{ planId?: string }>;
}) {
  const session = await requireSessionOrRedirect();
  const { planId } = await searchParams;
  const plans = await getActivePlans(session.user.id);

  if (plans.length === 0) {
    return (
      <div className="border border-dashed border-line-strong bg-surface p-8 text-center text-sm text-ink-500">
        할 일을 추가하려면 먼저 계획이 필요합니다.{" "}
        <Link href="/plans/new" className="font-medium text-ink-900 underline">
          계획 만들기
        </Link>
      </div>
    );
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <div>
        <h1 className="label-coord text-xs text-ink-400">TASKS / NEW</h1>
        <h2 className="text-xl font-bold text-ink-900">새 할 일 추가</h2>
      </div>
      <TaskForm
        action={createTaskAction}
        mode="create"
        plans={plans}
        defaultValues={planId ? { planId: Number(planId) } : undefined}
      />
    </div>
  );
}
