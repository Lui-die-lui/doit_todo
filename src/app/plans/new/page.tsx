import { createPlanAction } from "@/lib/actions/plans";
import { PlanForm } from "@/components/PlanForm";

export const dynamic = "force-dynamic";

export default async function NewPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ improvement?: string; reflectionId?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div className="text-center">
        <h1 className="label-coord text-xs text-ink-400">PLAN / NEW</h1>
        <h2 className="text-xl font-bold text-ink-900">새 계획 만들기</h2>
      </div>
      {params.reflectionId && (
        <p className="border border-line-strong bg-surface-muted px-3 py-2 text-sm text-ink-700">
          돌아보기(#{params.reflectionId})에서 넘어온 개선점이 반영되어 있습니다.
        </p>
      )}
      <PlanForm
        action={createPlanAction}
        mode="create"
        defaultValues={{ carriedImprovement: params.improvement ?? "" }}
        hiddenFields={params.reflectionId ? { sourceReflectionId: params.reflectionId } : undefined}
      />
    </div>
  );
}
