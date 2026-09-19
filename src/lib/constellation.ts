import { isOverdue, minutesToLabel, formatDateOnly, SEOUL_TIME_ZONE } from "./date";
import { priorityLabels } from "./validation";

/** Golden angle in degrees -- gives a stable, well-spread angular sequence keyed purely off id. */
const GOLDEN_ANGLE_DEG = 137.50776405;

export const ORBIT_RADII: readonly [number, number, number] = [34, 62, 90];
const MIN_STAR_RADIUS = 2.8;
const MAX_STAR_RADIUS = 5.5;
/** Minimum arc length (in the same normalized units as ORBIT_RADII) kept between two stars on one orbit. */
const MIN_ARC_LENGTH = 11;

/** A completed-star connection group must have at least this many stars to draw any lines
 * at all -- fewer than this and the stars show but stay unconnected (an in-progress group). */
const MIN_CONSTELLATION_GROUP_SIZE = 4;
/** ... and at most this many -- past this, the current group's connections end and a new
 * group starts, so one plan's constellation never turns into a single ever-growing web. */
const MAX_CONSTELLATION_GROUP_SIZE = 7;

export type StarSizeTier = "small" | "medium" | "large";

/**
 * Which third of the [MIN_STAR_RADIUS, MAX_STAR_RADIUS] range a star falls
 * into, by its estimated-minutes-derived radius. Used to vary a completed
 * star's glyph (outline / filled / filled+rays) by how big the task was.
 */
export function sizeTierForRadius(radius: number): StarSizeTier {
  const range = MAX_STAR_RADIUS - MIN_STAR_RADIUS;
  if (radius < MIN_STAR_RADIUS + range / 3) return "small";
  if (radius < MIN_STAR_RADIUS + (range * 2) / 3) return "medium";
  return "large";
}

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

/** Seoul-local calendar date (YYYY-MM-DD) a star's completedAt falls on -- the key used to
 * group completed stars into constellation-connection groups. A DONE task should always
 * have completedAt set; a missing value falls back to the epoch, matching the same
 * fallback used when sorting completed stars into completion order. */
function seoulCompletionDateKey(completedAt: Date | string | null): string {
  const d = completedAt ? (typeof completedAt === "string" ? new Date(completedAt) : completedAt) : new Date(0);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SEOUL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * Splits DONE items (already sorted into completion order) into the separate groups that
 * get connecting lines drawn within them, so one plan's constellation doesn't turn into a
 * single ever-growing web as completed tasks pile up. Generic over anything with an `id`
 * and `completedAt` -- called both on raw tasks (to drive cluster placement before any
 * star has coordinates) and on positioned stars (to drive MST connections after).
 *
 * - Items completed on the same Seoul calendar date are kept together where possible: each
 *   date's items are folded into the running group as one whole unit, only cut apart when a
 *   single date alone has more than MAX_CONSTELLATION_GROUP_SIZE items -- that date is split
 *   into the fewest possible chunks, sized as evenly as the MIN..MAX range allows (e.g. 8 ->
 *   4+4, 9 -> 5+4, 10 -> 5+5, 14 -> 7+7).
 * - Dates (or date-chunks) are folded into the current group for as long as the group's
 *   total stays at or under MAX_CONSTELLATION_GROUP_SIZE; one that would push it over ends
 *   the current group and starts a new one instead.
 * - Every group is returned, including one smaller than MIN_CONSTELLATION_GROUP_SIZE (most
 *   often the newest, still-forming stars) -- the caller decides not to draw connections for
 *   those (see computeConstellationLayout), but the stars themselves are unaffected.
 */
export function groupCompletedStarsForConnections<T extends { id: number; completedAt: Date | string | null }>(
  completedInOrder: T[],
): T[][] {
  if (completedInOrder.length === 0) return [];

  // 1) Bucket by completion date, preserving completion order within and across dates.
  const dateBuckets: T[][] = [];
  for (const item of completedInOrder) {
    const key = seoulCompletionDateKey(item.completedAt);
    const lastBucket = dateBuckets[dateBuckets.length - 1];
    if (lastBucket && seoulCompletionDateKey(lastBucket[0].completedAt) === key) {
      lastBucket.push(item);
    } else {
      dateBuckets.push([item]);
    }
  }

  // 2) A single date with too many items for one group is split into near-even chunks
  // that each fit within [MIN_CONSTELLATION_GROUP_SIZE, MAX_CONSTELLATION_GROUP_SIZE].
  const sizedBuckets: T[][] = [];
  for (const bucket of dateBuckets) {
    if (bucket.length <= MAX_CONSTELLATION_GROUP_SIZE) {
      sizedBuckets.push(bucket);
      continue;
    }
    const chunkCount = Math.ceil(bucket.length / MAX_CONSTELLATION_GROUP_SIZE);
    const baseSize = Math.floor(bucket.length / chunkCount);
    const remainder = bucket.length % chunkCount;
    let offset = 0;
    for (let i = 0; i < chunkCount; i++) {
      // Spread the remainder across the first chunks so sizes differ by at most one
      // (9 items / 2 chunks -> 5 + 4, never 6 + 3).
      const size = baseSize + (i < remainder ? 1 : 0);
      sizedBuckets.push(bucket.slice(offset, offset + size));
      offset += size;
    }
  }

  // 3) Fold whole date-buckets into a running group while it stays within the max size;
  // a bucket that would push it over ends the current group and starts a new one.
  const groups: T[][] = [];
  let current: T[] = [];
  for (const bucket of sizedBuckets) {
    if (current.length > 0 && current.length + bucket.length > MAX_CONSTELLATION_GROUP_SIZE) {
      groups.push(current);
      current = [];
    }
    current.push(...bucket);
  }
  if (current.length > 0) groups.push(current);

  return groups;
}

/** Dependency-free deterministic PRNG (mulberry32). Only ever used to pick organic-looking
 * constellation coordinates from a stable seed -- never for anything security-sensitive. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a 32-bit string hash -- turns a stable identity key (group index + member task ids,
 * or that plus one task id) into a numeric seed for mulberry32, so the exact same input data
 * always derives the exact same seed and the exact same layout. */
function hashSeed(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** How far inside its allotted angular slot a group's cluster window sits, on each side --
 * keeps adjacent groups' wedges from ever touching. */
const CLUSTER_SLOT_MARGIN_FRACTION = 0.12;
/** Share of a slot's usable width the window itself occupies; the remainder is slack the
 * window's seeded center can move within, so groups still get different rotations. */
const CLUSTER_WINDOW_FILL = 0.7;
/** A cluster's angular half-width never exceeds this, however few groups share the plan, so
 * a lone group still reads as one confined region rather than half the circle. */
const CLUSTER_MAX_HALF_WIDTH_DEG = 60;
const CLUSTER_MIN_HALF_WIDTH_DEG = 10;
/** Within its window, each star sits in its own sub-interval (so stars can't clump on top of
 * one another) but is jittered by up to this fraction of that sub-interval's half-width on
 * either side -- enough that spacing is visibly uneven rather than a regular fan. */
const CLUSTER_STRATA_JITTER = 0.7;
/** Small deterministic nudge toward/away from a star's own orbit ring, layered on top of the
 * angle-based clustering for a little organic distance variation. Well inside the 28-unit gap
 * between adjacent ORBIT_RADII rings, so a star never visually drifts into a neighboring
 * ring's territory -- the ring itself (i.e. which due-date third a task falls in) is never
 * reassigned by this jitter. */
const CLUSTER_RADIUS_JITTER_MAX = 6;

type ClusterPlacement = { angleDeg: number; radiusJitter: number };

/**
 * Assigns each DONE task a clustered angle (and a small radius jitter) so that every
 * constellation group -- the same groups groupCompletedStarsForConnections uses for
 * connections -- occupies one bounded, non-overlapping wedge of the circle instead of being
 * scattered by the golden-angle spread used for TODO stars. Every value is derived from the
 * attempt number, the group's own index and its members' task ids via mulberry32/hashSeed, so
 * the same data always reproduces the same placement. `attempt` is 0 for the first try;
 * computeConstellationLayout only asks for a higher one (a different, equally deterministic
 * arrangement) when attempt 0 leaves a line crossing another line or running over a star.
 *
 * - The circle is split into one slot per group (in completion order); each group's window
 *   (center + half-width) is placed entirely inside its slot with margin, so two groups'
 *   wedges can never touch, however their random draws land.
 * - Within its window, the group's members are dealt into sub-intervals in a seeded shuffled
 *   order and each jittered inside its own sub-interval -- stars can't pile onto one another,
 *   yet spacing is visibly uneven rather than a regular fan or polygon. A small seeded radius
 *   jitter adds the same kind of unevenness in distance.
 * - A per-group seeded mirror flip reflects that group's whole arrangement, and the seeded
 *   window center rotates it, so groups don't repeat the same shape.
 *
 * One known limit: the existing per-orbit min-gap pass in computeConstellationLayout still
 * runs afterward, and when many of one group's stars share the tight inner ring it can push a
 * star a little past its window's edge. That keeps stars from overlapping, and the result is
 * still deterministic, but the wedge is then slightly looser than nominal.
 */
function buildClusterPlacements(groups: ConstellationTaskInput[][], attempt: number): Map<number, ClusterPlacement> {
  const placements = new Map<number, ClusterPlacement>();
  const groupCount = groups.length;
  if (groupCount === 0) return placements;

  const slotWidth = 360 / groupCount;
  const usableWidth = slotWidth * (1 - CLUSTER_SLOT_MARGIN_FRACTION * 2);
  const windowHalfWidth = Math.min(
    CLUSTER_MAX_HALF_WIDTH_DEG,
    Math.max(CLUSTER_MIN_HALF_WIDTH_DEG, (usableWidth / 2) * CLUSTER_WINDOW_FILL),
  );
  const centerSlack = Math.max(0, usableWidth - windowHalfWidth * 2);

  groups.forEach((group, groupIndex) => {
    const groupKey = group.map((t) => t.id).join(",");
    const groupRandom = mulberry32(hashSeed(`constellation-group:${attempt}:${groupIndex}:${groupKey}`));
    const slotStart = groupIndex * slotWidth;
    const windowCenter =
      slotStart + slotWidth * CLUSTER_SLOT_MARGIN_FRACTION + windowHalfWidth + groupRandom() * centerSlack;
    const mirror = groupRandom() < 0.5;

    // Seeded Fisher-Yates shuffle of sub-interval indices, so which member lands in which
    // sub-interval isn't tied to completion order.
    const n = group.length;
    const subIntervalOf = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(groupRandom() * (i + 1));
      [subIntervalOf[i], subIntervalOf[j]] = [subIntervalOf[j], subIntervalOf[i]];
    }

    group.forEach((task, memberIndex) => {
      const starRandom = mulberry32(
        hashSeed(`constellation-group:${attempt}:${groupIndex}:${groupKey}:star:${task.id}`),
      );
      // Center of this member's sub-interval within [-1, 1], plus a seeded jitter inside it.
      const subCenter = -1 + (2 * subIntervalOf[memberIndex] + 1) / n;
      const angleFrac = subCenter + (starRandom() * 2 - 1) * (CLUSTER_STRATA_JITTER / n);
      const radiusFrac = starRandom() * 2 - 1; // independent draw, [-1, 1)
      const signedAngleFrac = mirror ? -angleFrac : angleFrac;
      const angleDeg = (((windowCenter + signedAngleFrac * windowHalfWidth) % 360) + 360) % 360;
      placements.set(task.id, { angleDeg, radiusJitter: radiusFrac * CLUSTER_RADIUS_JITTER_MAX });
    });
  });

  return placements;
}

/**
 * Prim's algorithm over full pairwise Euclidean distance -- more than fast enough for the
 * small group sizes (<= MAX_CONSTELLATION_GROUP_SIZE) this ever runs on. Connects every star
 * in `points` using their actual on-screen coordinates, so nearby stars link up instead of
 * whichever order they happen to be listed in. A true Euclidean MST never contains two
 * crossing edges of its own -- if two edges crossed, swapping which pairs they connect would
 * always produce a shorter tree, contradicting minimality -- so crossings *within* a group
 * can't happen; lines from different groups, and lines grazing an unrelated star, are what
 * countLayoutViolations guards against. Deterministic: point order and tie-breaks (lowest
 * index wins) are fully determined by `points`, which callers pass in a stable order.
 */
function computeEuclideanMst(points: ConstellationStar[]): ConstellationConnection[] {
  if (points.length < 2) return [];

  const n = points.length;
  const inTree = new Array<boolean>(n).fill(false);
  const minDist = new Array<number>(n).fill(Infinity);
  const parent = new Array<number>(n).fill(-1);
  minDist[0] = 0;

  const dist2 = (a: ConstellationStar, b: ConstellationStar) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

  for (let iter = 0; iter < n; iter++) {
    let u = -1;
    for (let i = 0; i < n; i++) {
      if (!inTree[i] && (u === -1 || minDist[i] < minDist[u])) u = i;
    }
    inTree[u] = true;
    for (let v = 0; v < n; v++) {
      if (!inTree[v]) {
        const d = dist2(points[u], points[v]);
        if (d < minDist[v]) {
          minDist[v] = d;
          parent[v] = u;
        }
      }
    }
  }

  const edges: ConstellationConnection[] = [];
  for (let v = 0; v < n; v++) {
    if (parent[v] !== -1) edges.push({ from: points[parent[v]], to: points[v] });
  }
  return edges;
}

type LayoutAttemptInput = {
  tasks: ConstellationTaskInput[];
  planStartDate: string;
  planEndDate: string;
  todaySeoul: string;
  minEst: number;
  maxEst: number;
  /** DONE tasks in completion order, split into connection groups (see groupCompletedStarsForConnections). */
  clusterGroups: ConstellationTaskInput[][];
};

/** One complete, deterministic placement of every star plus each group's MST connections,
 * for a given `attempt` seed (see buildClusterPlacements). */
function layoutAttempt(
  { tasks, planStartDate, planEndDate, todaySeoul, minEst, maxEst, clusterGroups }: LayoutAttemptInput,
  attempt: number,
): { stars: ConstellationStar[]; connections: ConstellationConnection[]; connectedGroups: ConstellationStar[][] } {
  const clusterPlacementByTaskId = buildClusterPlacements(clusterGroups, attempt);

  const raw = tasks
    .map((task) => {
      const placement = clusterPlacementByTaskId.get(task.id);
      // TODO stars keep the original golden-angle-by-id spread (never clustered); a DONE
      // task's angle instead comes from its constellation group's bounded wedge.
      const angleDeg = placement ? placement.angleDeg : (task.id * GOLDEN_ANGLE_DEG) % 360;
      const orbit = orbitForDueDate(task.dueDate, planStartDate, planEndDate);
      const radius = radiusForEstimate(task.estimatedMinutes, minEst, maxEst);
      const radiusJitter = placement?.radiusJitter ?? 0;
      return { task, angleDeg, orbit, radius, radiusJitter };
    })
    // stable sort by angle, id as final tiebreaker -- required for deterministic overlap resolution
    .sort((a, b) => (a.angleDeg !== b.angleDeg ? a.angleDeg - b.angleDeg : a.task.id - b.task.id));

  const byOrbit: Record<0 | 1 | 2, typeof raw> = { 0: [], 1: [], 2: [] };
  for (const item of raw) byOrbit[item.orbit].push(item);

  const stars: ConstellationStar[] = [];
  ([0, 1, 2] as const).forEach((orbitKey) => {
    // orbitRadius is the ring's nominal distance from center -- it alone encodes which
    // due-date third a star belongs to, and is never touched by clustering. Only
    // radiusJitter (small, DONE-only) nudges a star's actual plotted distance from it.
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

      const positionRadius = orbitRadius + item.radiusJitter;
      const rad = (angle * Math.PI) / 180;
      const x = positionRadius * Math.cos(rad);
      const y = positionRadius * Math.sin(rad);

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

  // Connections: a Euclidean MST within each constellation group's *actual screen
  // coordinates* (never between groups, and MST never closes a loop back to a "first"
  // star -- see computeEuclideanMst). clusterGroups is the same grouping used to place the
  // stars above, so group membership and eligibility (>= MIN_CONSTELLATION_GROUP_SIZE) stay
  // in sync with buildClusterPlacements.
  const starById = new Map(stars.map((s) => [s.id, s]));
  const connections: ConstellationConnection[] = [];
  const connectedGroups: ConstellationStar[][] = [];
  for (const group of clusterGroups) {
    if (group.length < MIN_CONSTELLATION_GROUP_SIZE) continue;
    const groupStars = group.map((task) => starById.get(task.id)).filter((s): s is ConstellationStar => s != null);
    connectedGroups.push(groupStars);
    connections.push(...computeEuclideanMst(groupStars));
  }

  return { stars, connections, connectedGroups };
}

/** Extra clearance, beyond a star's own glyph radius, that a line must keep from a star it
 * isn't attached to. */
const EDGE_STAR_CLEARANCE = 2;
/** Extra gap, beyond the two glyph radii, kept between two stars' centers. */
const STAR_GAP = 1;
/** A single connecting line longer than this reads as two stars that don't belong together
 * (typical lines run ~20-35 units; the outer orbit's radius is 90). */
const MAX_EDGE_LENGTH = 48;
/** A connected group whose stars are spread this much thinner across than along -- the
 * ratio of the two principal standard deviations -- reads as a straight row, not a figure. */
const MIN_GROUP_ROUNDNESS = 0.28;
/** How many seeded arrangements computeConstellationLayout will try before settling for the
 * best one seen. Cheap: a layout is a handful of stars and lines. */
const MAX_LAYOUT_ATTEMPTS = 32;

type Point = { x: number; y: number };

function segmentCross(o: Point, a: Point, b: Point): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/** True only for a proper crossing -- segments that merely share an endpoint don't count. */
function segmentsProperlyCross(a: Point, b: Point, c: Point, d: Point): boolean {
  const d1 = segmentCross(a, b, c);
  const d2 = segmentCross(a, b, d);
  const d3 = segmentCross(c, d, a);
  const d4 = segmentCross(c, d, b);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

function distancePointToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Ratio of the smaller to the larger principal standard deviation of a point set (PCA on the
 * 2x2 covariance): 1 for a round scatter, near 0 for points lying along a line. */
function pointSetRoundness(points: Point[]): number {
  const n = points.length;
  const meanX = points.reduce((sum, p) => sum + p.x, 0) / n;
  const meanY = points.reduce((sum, p) => sum + p.y, 0) / n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const p of points) {
    sxx += (p.x - meanX) ** 2;
    syy += (p.y - meanY) ** 2;
    sxy += (p.x - meanX) * (p.y - meanY);
  }
  const trace = sxx + syy;
  const det = sxx * syy - sxy * sxy;
  const spread = Math.sqrt(Math.max(0, (trace * trace) / 4 - det));
  const largest = trace / 2 + spread;
  const smallest = Math.max(0, trace / 2 - spread);
  return largest === 0 ? 1 : Math.sqrt(smallest / largest);
}

/**
 * Scores how many things are wrong with a candidate layout, lower being better: a line
 * crossing another line, a line running over a star it isn't attached to (within that star's
 * glyph radius plus EDGE_STAR_CLEARANCE), or two stars whose glyphs would touch -- the last
 * only counted when at least one of the two is DONE, since a TODO/TODO pair's spacing doesn't
 * depend on the attempt seed -- each weigh heavily; a line longer than MAX_EDGE_LENGTH or a
 * connected group laid out as a near-straight row weigh lightly. Zero means the layout is
 * clean.
 *
 * Within one group a Euclidean MST can't cross itself, and groups sit in disjoint wedges, so
 * crossings are rare; this is the safety net for the rare case the min-gap pass pushes a star
 * out of its wedge, and it is what catches a line grazing a star, an overlong line, or a
 * straight row -- none of which MST alone prevents.
 */
function countLayoutViolations(
  stars: ConstellationStar[],
  connections: ConstellationConnection[],
  connectedGroups: ConstellationStar[][],
): number {
  // Crossing lines, a line over a star, and touching stars are outright defects and weigh far
  // more than the two softer "reads badly" checks (overlong line, straight row), so a retry
  // never trades a defect for a nicer shape.
  const DEFECT = 10;
  const SOFT = 1;
  let violations = 0;

  for (const group of connectedGroups) {
    if (pointSetRoundness(group) < MIN_GROUP_ROUNDNESS) violations += SOFT;
  }

  for (let i = 0; i < connections.length; i++) {
    const a = connections[i];
    if (Math.hypot(a.to.x - a.from.x, a.to.y - a.from.y) > MAX_EDGE_LENGTH) violations += SOFT;
    for (let j = i + 1; j < connections.length; j++) {
      if (segmentsProperlyCross(a.from, a.to, connections[j].from, connections[j].to)) violations += DEFECT;
    }
    for (const star of stars) {
      if (star.id === a.from.id || star.id === a.to.id) continue;
      if (distancePointToSegment(star, a.from, a.to) < star.radius + EDGE_STAR_CLEARANCE) violations += DEFECT;
    }
  }

  for (let i = 0; i < stars.length; i++) {
    for (let j = i + 1; j < stars.length; j++) {
      if (stars[i].status !== "DONE" && stars[j].status !== "DONE") continue;
      const minDistance = stars[i].radius + stars[j].radius + STAR_GAP;
      if (Math.hypot(stars[i].x - stars[j].x, stars[i].y - stars[j].y) < minDistance) violations += DEFECT;
    }
  }

  return violations;
}

/**
 * Deterministic layout: every value is derived purely from task id/dueDate/
 * estimatedMinutes and the plan's date range -- never from Math.random or
 * array index/order -- so the same data always produces the same picture,
 * and adding/removing an unrelated task never moves existing stars.
 *
 * TODO stars keep their original spread. DONE stars are clustered per constellation group
 * and joined by a per-group Euclidean MST (see buildClusterPlacements / computeEuclideanMst).
 * If the first arrangement leaves a line crossing another or running over a star, further
 * seeded arrangements (attempt 1, 2, ...) are tried in order and the first clean one wins --
 * or, failing that, the one with the fewest violations -- so the result is still a pure
 * function of the input.
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

  // Completed tasks' connection groups (same rule as groupCompletedStarsForConnections
  // applies anywhere) are computed here, on the raw tasks, before any coordinate exists --
  // grouping only needs id/completedAt, and cluster placement needs to know group membership
  // before it can assign each DONE task an angle.
  const completedTasksInOrder = tasks
    .filter((t) => t.status === "DONE")
    .sort((a, b) => {
      const at = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const bt = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      return at !== bt ? at - bt : a.id - b.id;
    });
  const clusterGroups = groupCompletedStarsForConnections(completedTasksInOrder);
  const input: LayoutAttemptInput = { tasks, planStartDate, planEndDate, todaySeoul, minEst, maxEst, clusterGroups };

  let best = layoutAttempt(input, 0);
  let bestViolations = clusterGroups.length > 0 ? countLayoutViolations(best.stars, best.connections, best.connectedGroups) : 0;
  for (let attempt = 1; attempt < MAX_LAYOUT_ATTEMPTS && bestViolations > 0; attempt++) {
    const candidate = layoutAttempt(input, attempt);
    const violations = countLayoutViolations(candidate.stars, candidate.connections, candidate.connectedGroups);
    if (violations < bestViolations) {
      best = candidate;
      bestViolations = violations;
    }
  }

  const { stars, connections } = best;
  const isComplete = stars.length > 0 && stars.every((s) => s.status === "DONE");

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
