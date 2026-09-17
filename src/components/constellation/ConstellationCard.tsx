import {
  buildConstellationTasks,
  computeConstellationLayout,
  getOrbitBoundaryDates,
  type RawTaskForConstellation,
  type RawWorkLogForConstellation,
} from "@/lib/constellation";
import { formatDateTimeSeoul, minutesToLabel, seoulTodayDateString } from "@/lib/date";
import { ConstellationSVG } from "./ConstellationSVG";

export function ConstellationCard({
  planTitle,
  planStartDate,
  planEndDate,
  planEstimatedMinutes,
  tasks,
  workLogs,
  coord,
  nextPlan,
}: {
  planTitle: string;
  planStartDate: string;
  planEndDate: string;
  planEstimatedMinutes: number;
  tasks: RawTaskForConstellation[];
  workLogs: RawWorkLogForConstellation[];
  coord?: string;
  nextPlan?: { id: number; title: string } | null;
}) {
  const today = seoulTodayDateString();
  const constellationTasks = buildConstellationTasks(tasks, workLogs);
  const layout = computeConstellationLayout(constellationTasks, planStartDate, planEndDate, today);
  const orbitDateLabels = getOrbitBoundaryDates(planStartDate, planEndDate);

  const actualMinutesTotal = constellationTasks.reduce((sum, t) => sum + t.actualMinutesTotal, 0);
  const diff = actualMinutesTotal - planEstimatedMinutes;
  const completedAtValues = constellationTasks
    .map((t) => t.completedAt)
    .filter((v): v is Date | string => v !== null)
    .map((v) => new Date(v).getTime());
  const completedAt = completedAtValues.length ? new Date(Math.max(...completedAtValues)) : null;

  return (
    <div className="border border-line bg-surface p-5 sm:p-7">
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <span className="label-coord text-[10px] text-ink-400">{coord ?? "CONSTELLATION"}</span>
        <span className="label-coord text-[10px] text-ink-400">
          {layout.stars.length} STARS · {layout.stars.filter((s) => s.status === "DONE").length} LIT
        </span>
      </div>

      {layout.stars.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-400">
          아직 할 일이 없습니다. 할 일을 추가하면 좌표가 나타납니다.
        </p>
      ) : (
        <ConstellationSVG layout={layout} planTitle={planTitle} orbitDateLabels={orbitDateLabels} nextPlan={nextPlan} />
      )}

      {layout.isComplete && (
        <div className="mt-4 border-t border-line pt-4 text-center">
          <p className="label-coord text-xs text-ink-900">CONSTELLATION COMPLETE</p>
          <p className="mt-1 text-sm font-medium text-ink-900">{planTitle}</p>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-xs text-ink-500">
            <div>
              <dt className="label-coord text-[10px] text-ink-400">완료일</dt>
              <dd className="font-mono text-ink-900">{completedAt ? formatDateTimeSeoul(completedAt) : "-"}</dd>
            </div>
            <div>
              <dt className="label-coord text-[10px] text-ink-400">예상 / 실제</dt>
              <dd className="text-ink-900">
                {minutesToLabel(planEstimatedMinutes)} / {minutesToLabel(actualMinutesTotal)}
              </dd>
            </div>
            <div>
              <dt className="label-coord text-[10px] text-ink-400">차이</dt>
              <dd className="text-ink-900">
                {diff > 0 ? "+" : ""}
                {minutesToLabel(diff)}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}
