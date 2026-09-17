export type CompletionDecision =
  | { action: "already_done" }
  | { action: "complete"; nextCycle: number };

export type CompletionTaskState = {
  status: "TODO" | "DONE";
  completionCycle: number;
};

/**
 * Pure decision function used inside the DB transaction in
 * lib/actions/completion.ts. Given the row read with `SELECT ... FOR UPDATE`,
 * decides whether a completion event should be inserted.
 *
 * This function alone cannot prevent a duplicate: two callers reading the
 * same TODO/cycle=N state concurrently both compute nextCycle = N + 1. That
 * race is why the actual insert also relies on the DB-level UNIQUE
 * constraints on completion_events (idempotency_key, and task_id+cycle) --
 * the second insert fails at the database and is caught as "already done"
 * rather than producing a duplicate row. See the accompanying test for a
 * simulation of this race.
 */
export function decideCompletion(task: CompletionTaskState): CompletionDecision {
  if (task.status === "DONE") {
    return { action: "already_done" };
  }
  return { action: "complete", nextCycle: task.completionCycle + 1 };
}

export type UncompletionResult = {
  status: "TODO";
  completedAt: null;
};

/** Reverting completion never touches completionCycle or past events. */
export function decideUncompletion(): UncompletionResult {
  return { status: "TODO", completedAt: null };
}
