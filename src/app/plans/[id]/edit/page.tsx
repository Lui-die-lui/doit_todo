import { notFound } from "next/navigation";
import { getPlanById } from "@/lib/queries";
import { revisePlanAction } from "@/lib/actions/plans";
import { PlanForm } from "@/components/PlanForm";

export const dynamic = "force-dynamic";

export default async function EditPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const planId = Number(id);
  if (!Number.isInteger(planId) || planId <= 0) notFound();

  const plan = await getPlanById(planId);
  if (!plan || plan.deletedAt) notFound();

  const boundAction = revisePlanAction.bind(null, planId);

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <div>
        <h1 className="label-coord text-xs text-ink-400">PLAN / EDIT</h1>
        <h2 className="text-xl font-bold text-ink-900">계획 수정</h2>
      </div>
      <p className="text-sm text-ink-500">
        수정 전 내용은 자동으로 수정 이력에 보존됩니다. 수정 이유를 함께 입력해주세요.
      </p>
      <PlanForm
        action={boundAction}
        mode="edit"
        defaultValues={{
          title: plan.title,
          description: plan.description,
          startDate: plan.startDate,
          endDate: plan.endDate,
          priority: plan.priority,
          successCriteria: plan.successCriteria,
          estimatedMinutes: plan.estimatedMinutes,
        }}
      />
    </div>
  );
}
