/** Most plans one reorder request may carry -- far above any real plan list, just a bound
 * so a forged request can't make the server loop over an arbitrary amount of ids. */
export const MAX_REORDER_IDS = 200;

/**
 * Validates the id list a reorder request carries: a non-empty array of distinct positive
 * integers, no longer than MAX_REORDER_IDS. Returns null for anything else -- the caller
 * treats that as a bad request without ever touching the database.
 */
export function parseOrderedPlanIds(input: unknown): number[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > MAX_REORDER_IDS) return null;
  const ids: number[] = [];
  const seen = new Set<number>();
  for (const value of input) {
    if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) return null;
    if (seen.has(value)) return null;
    seen.add(value);
    ids.push(value);
  }
  return ids;
}

/**
 * The complete order to store after a reorder: the ids the user arranged, in that order,
 * followed by any of the user's other active plans in their current order. The tail covers a
 * plan created in another tab between page load and drop -- it isn't lost or reshuffled, it
 * just lands after everything the user explicitly placed.
 */
export function mergePlanOrder(submitted: number[], currentActiveOrder: number[]): number[] {
  const placed = new Set(submitted);
  return [...submitted, ...currentActiveOrder.filter((id) => !placed.has(id))];
}
