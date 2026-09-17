import { isOverdue, minutesToLabel, formatDateOnly } from "./date";
import { priorityLabels } from "./validation";

/** Golden angle in degrees -- gives a stable, well-spread angular sequence keyed purely off id. */
const GOLDEN_ANGLE_DEG = 137.50776405;

export const ORBIT_RADII: readonly [number, number, number] = [34, 62, 90];
const MIN_STAR_RADIUS = 2.2;
const MAX_STAR_RADIUS = 5.5;
/** Minimum arc length (in the same normalized units as ORBIT_RADII) kept between two stars on one orbit. */
const MIN_ARC_LENGTH = 11;

export type ConstellationTaskInput = {
  id: number;
  title: string;
  status: "TODO" | "DONE";
  priority: "HIGH" | "MEDIUM" | "LOW";
  tag: string;
  dueDate: string; // YYYY-MM-DD
  estimatedMinutes: number;
  createdAt: Date | string;
  completedAt: Date | string | null;
  actualMinutesTotal: number;
  workLogCount: number;
  hasBlocker: boolean;
};

export type ConstellationStar = {
  id: number;
  title: string;
  x: number;
  y: number;
  radius: number;
  angleDeg: number;
  orbit: 0 | 1 | 2;
  status: "TODO" | "DONE";
  priority: "HIGH" | "MEDIUM" | "LOW";
  tag: string;
  dueDate: string;
  estimatedMinutes: number;
  actualMinutesTotal: number;
  workLogCount: number;
  completedAt: Date | string | null;
  hasBlocker: boolean;
  isOverdue: boolean;
};

export type ConstellationConnection = { from: ConstellationStar; to: ConstellationStar };

export type ConstellationLayout = {
  stars: ConstellationStar[];
  connections: ConstellationConnection[];
  center: { x: number; y: number };
  orbitRadii: readonly [number, number, number];
  isComplete: boolean;
};

function daysBetweenDateStrings(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const aUtc = Date.UTC(ay, am - 1, ad);
  const bUtc = Date.UTC(by, bm - 1, bd);
  return Math.round((bUtc - aUtc) / 86_400_000);
}

function addDaysToDateString(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d) + days * 86_400_000);
  const yyyy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * The date each orbit ring represents (its outer boundary): orbit 0 ends at
 * the 1/3 mark of the plan's date range, orbit 1 at 2/3, orbit 2 at the
 * plan's end date. Used to label the rings with real dates instead of
 * decorative text.
 */
export function getOrbitBoundaryDates(planStartDate: string, planEndDate: string): [string, string, string] {
  const totalDays = Math.max(1, daysBetweenDateStrings(planStartDate, planEndDate));
  return [
    addDaysToDateString(planStartDate, Math.round(totalDays / 3)),
    addDaysToDateString(planStartDate, Math.round((totalDays * 2) / 3)),
    planEndDate,
  ];
}

function orbitForDueDate(dueDate: string, planStartDate: string, planEndDate: string): 0 | 1 | 2 {
  const totalDays = Math.max(1, daysBetweenDateStrings(planStartDate, planEndDate));
  const offsetDays = Math.min(totalDays, Math.max(0, daysBetweenDateStrings(planStartDate, dueDate)));
  const fraction = offsetDays / totalDays;
  if (fraction < 1 / 3) return 0;
  if (fraction < 2 / 3) return 1;
  return 2;
}

function radiusForEstimate(estimatedMinutes: number, minEst: number, maxEst: number): number {
  if (maxEst === minEst) return (MIN_STAR_RADIUS + MAX_STAR_RADIUS) / 2;
  const t = (estimatedMinutes - minEst) / (maxEst - minEst);
  return MIN_STAR_RADIUS + t * (MAX_STAR_RADIUS - MIN_STAR_RADIUS);
}

/**
 * Deterministic layout: every value is derived purely from task id/dueDate/
 * estimatedMinutes and the plan's date range -- never from Math.random or
 * array index/order -- so the same data always produces the same picture,
 * and adding/removing an unrelated task never moves existing stars.
 */
export function computeConstellationLayout(
  tasks: ConstellationTaskInput[],
  planStartDate: string,
  planEndDate: string,
  todaySeoul: string,
): ConstellationLayout {
  const center = { x: 0, y: 0 };

  if (tasks.length === 0) {
    return { stars: [], connections: [], center, orbitRadii: ORBIT_RADII, isComplete: false };
  }

  const estimates = tasks.map((t) => t.estimatedMinutes);
  const minEst = Math.min(...estimates);
  const maxEst = Math.max(...estimates);

  const raw = tasks
    .map((task) => {
      const angleDeg = (task.id * GOLDEN_ANGLE_DEG) % 360;
      const orbit = orbitForDueDate(task.dueDate, planStartDate, planEndDate);
      const radius = radiusForEstimate(task.estimatedMinutes, minEst, maxEst);
      return { task, angleDeg, orbit, radius };
    })
    // stable sort by angle, id as final tiebreaker -- required for deterministic overlap resolution
    .sort((a, b) => (a.angleDeg !== b.angleDeg ? a.angleDeg - b.angleDeg : a.task.id - b.task.id));

  const byOrbit: Record<0 | 1 | 2, typeof raw> = { 0: [], 1: [], 2: [] };
  for (const item of raw) byOrbit[item.orbit].push(item);

  const stars: ConstellationStar[] = [];
  ([0, 1, 2] as const).forEach((orbitKey) => {
    const orbitRadius = ORBIT_RADII[orbitKey];
    const minGapDeg = (MIN_ARC_LENGTH / orbitRadius) * (180 / Math.PI);
    const items = byOrbit[orbitKey];
    let lastAngle: number | null = null;

    for (const item of items) {
      let angle = item.angleDeg;
      if (lastAngle !== null && angle - lastAngle < minGapDeg) {
        angle = lastAngle + minGapDeg;
      }
      lastAngle = angle;

      const rad = (angle * Math.PI) / 180;
      const x = orbitRadius * Math.cos(rad);
      const y = orbitRadius * Math.sin(rad);

      stars.push({
        id: item.task.id,
        title: item.task.title,
        x,
        y,
        radius: item.radius,
        angleDeg: angle,
        orbit: orbitKey,
        status: item.task.status,
        priority: item.task.priority,
        tag: item.task.tag,
        dueDate: item.task.dueDate,
        estimatedMinutes: item.task.estimatedMinutes,
        actualMinutesTotal: item.task.actualMinutesTotal,
        workLogCount: item.task.workLogCount,
        completedAt: item.task.completedAt,
        hasBlocker: item.task.hasBlocker,
        isOverdue: isOverdue(item.task.dueDate, item.task.status, todaySeoul),
      });
    }
  });

  // Restore id-ascending order for stable list rendering / a11y tab order.
  stars.sort((a, b) => a.id - b.id);

  const completedInOrder = stars
    .filter((s) => s.status === "DONE")
    .sort((a, b) => {
      const at = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const bt = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      return at !== bt ? at - bt : a.id - b.id;
    });

  const connections: ConstellationConnection[] = [];
  for (let i = 1; i < completedInOrder.length; i++) {
    connections.push({ from: completedInOrder[i - 1], to: completedInOrder[i] });
  }

  const isComplete = stars.length > 0 && stars.every((s) => s.status === "DONE");

  // When every star is lit, close the figure (last -> first) so the chain
  // reads as one finished constellation rather than an open path.
  if (isComplete && completedInOrder.length >= 3) {
    connections.push({
      from: completedInOrder[completedInOrder.length - 1],
      to: completedInOrder[0],
    });
  }

  return { stars, connections, center, orbitRadii: ORBIT_RADII, isComplete };
}

/** Rich, screen-reader-friendly description of one star, shared by the SVG a11y label and the hover/focus panel. */
export function describeStar(star: ConstellationStar): string {
  const statusLabel = star.status === "DONE" ? "완료" : star.isOverdue ? "지연" : "진행 중";
  const parts = [
    star.title,
    `상태 ${statusLabel}`,
    `마감일 ${formatDateOnly(star.dueDate)}`,
    `우선순위 ${priorityLabels[star.priority]}`,
    `예상 ${minutesToLabel(star.estimatedMinutes)}`,
    `실제 ${minutesToLabel(star.actualMinutesTotal)}`,
    `실행 기록 ${star.workLogCount}건`,
  ];
  if (star.hasBlocker) parts.push("막힌 기록 있음");
  return parts.join(" · ");
}

export type RawTaskForConstellation = {
  id: number;
  title: string;
  status: "TODO" | "DONE";
  priority: "HIGH" | "MEDIUM" | "LOW";
  tag: string;
  dueDate: string;
  estimatedMinutes: number;
  createdAt: Date | string;
  completedAt: Date | string | null;
};

export type RawWorkLogForConstellation = {
  taskId: number;
  actualMinutes: number;
  blockerReason: string | null;
};

/** Joins raw task rows with their work logs into constellation input -- pure, no DB access. */
export function buildConstellationTasks(
  tasks: RawTaskForConstellation[],
  workLogs: RawWorkLogForConstellation[],
): ConstellationTaskInput[] {
  const byTask = new Map<number, { actual: number; count: number; blocked: boolean }>();
  for (const w of workLogs) {
    const agg = byTask.get(w.taskId) ?? { actual: 0, count: 0, blocked: false };
    agg.actual += w.actualMinutes;
    agg.count += 1;
    if ((w.blockerReason ?? "").trim().length > 0) agg.blocked = true;
    byTask.set(w.taskId, agg);
  }
  return tasks.map((t) => {
    const agg = byTask.get(t.id) ?? { actual: 0, count: 0, blocked: false };
    return {
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      tag: t.tag,
      dueDate: t.dueDate,
      estimatedMinutes: t.estimatedMinutes,
      createdAt: t.createdAt,
      completedAt: t.completedAt,
      actualMinutesTotal: agg.actual,
      workLogCount: agg.count,
      hasBlocker: agg.blocked,
    };
  });
}
