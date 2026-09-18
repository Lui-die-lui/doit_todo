import { notFound } from "next/navigation";
import { getActivePlans, getTaskById } from "@/lib/queries";
import { updateTaskAction } from "@/lib/actions/tasks";
import { TaskForm } from "@/components/TaskForm";
import { requireSessionOrRedirect } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function EditTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSessionOrRedirect();
  const { id } = await params;
  const taskId = Number(id);
  if (!Number.isInteger(taskId) || taskId <= 0) notFound();

  const task = await getTaskById(session.user.id, taskId);
  if (!task || task.deletedAt) notFound();

  const plans = await getActivePlans(session.user.id);
  const boundAction = updateTaskAction.bind(null, taskId);

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <div>
        <h1 className="label-coord text-xs text-ink-400">TASKS / EDIT</h1>
        <h2 className="text-xl font-bold text-ink-900">할 일 수정</h2>
      </div>
      <TaskForm
        action={boundAction}
        mode="edit"
        plans={plans}
        defaultValues={{
          planId: task.planId,
          title: task.title,
          description: task.description,
          dueDate: task.dueDate,
          priority: task.priority,
          tag: task.tag,
          estimatedMinutes: task.estimatedMinutes,
        }}
      />
    </div>
  );
}
