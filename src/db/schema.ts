import {
  pgEnum,
  pgTable,
  serial,
  integer,
  varchar,
  text,
  date,
  timestamp,
  unique,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export const priorityEnum = pgEnum("doit_priority", ["HIGH", "MEDIUM", "LOW"]);
export const taskStatusEnum = pgEnum("doit_task_status", ["TODO", "DONE"]);

/**
 * A Plan is the top-level "Plan" unit of the Plan -> Do -> See cycle.
 * sourceReflectionId points back to the reflection whose improvement was
 * carried forward into this plan (nullable circular reference to reflections).
 */
export const plans = pgTable("doit_plans", {
  id: serial("id").primaryKey(),
  // Ownership root for the whole Plan/Task/WorkLog tree -- tasks are owned via
  // plan_id, work logs via task_id. Locked NOT NULL as of migration 0002, once
  // every plan in the DB was confirmed to belong to a real account (there was no
  // actual T06 legacy data left to backfill -- see docs/T07_AUTH_IMPLEMENTATION.md).
  // onDelete: cascade so deleting an auth user deletes their plans (and, via the
  // existing plan_id/task_id cascades below, everything under them).
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description").notNull().default(""),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  priority: priorityEnum("priority").notNull(),
  successCriteria: text("success_criteria").notNull(),
  estimatedMinutes: integer("estimated_minutes").notNull(),
  carriedImprovement: text("carried_improvement"),
  sourceReflectionId: integer("source_reflection_id").references(
    (): AnyPgColumn => reflections.id,
    { onDelete: "set null" },
  ),
  // The owner's manual display order (smaller = earlier), shared by the /plans list and
  // the home carousel. Nullable on purpose: NULL means "never reordered", and those sort
  // after every explicit value, newest first (see PLAN_ORDER in lib/queries.ts).
  sortOrder: integer("sort_order"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

/**
 * Stores the pre-edit snapshot of a plan every time it is revised.
 * The plan's own id never changes across revisions.
 */
export const planRevisions = pgTable(
  "doit_plan_revisions",
  {
    id: serial("id").primaryKey(),
    planId: integer("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    prevTitle: varchar("prev_title", { length: 200 }).notNull(),
    prevDescription: text("prev_description").notNull(),
    prevStartDate: date("prev_start_date").notNull(),
    prevEndDate: date("prev_end_date").notNull(),
    prevPriority: priorityEnum("prev_priority").notNull(),
    prevSuccessCriteria: text("prev_success_criteria").notNull(),
    prevEstimatedMinutes: integer("prev_estimated_minutes").notNull(),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("doit_plan_revisions_plan_version_unique").on(table.planId, table.version)],
);

export const tasks = pgTable("doit_tasks", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id")
    .notNull()
    .references(() => plans.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description").notNull().default(""),
  dueDate: date("due_date").notNull(),
  priority: priorityEnum("priority").notNull(),
  tag: varchar("tag", { length: 50 }).notNull().default(""),
  estimatedMinutes: integer("estimated_minutes").notNull(),
  status: taskStatusEnum("status").notNull().default("TODO"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  completionCycle: integer("completion_cycle").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

/**
 * Execution records ("Do"). Never mutates plan/task estimates.
 * actualMinutes is derived from startAt/endAt but persisted as an integer
 * so aggregation queries don't need to recompute date math in SQL.
 */
export const workLogs = pgTable("doit_work_logs", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  startAt: timestamp("start_at", { withTimezone: true }).notNull(),
  endAt: timestamp("end_at", { withTimezone: true }).notNull(),
  actualMinutes: integer("actual_minutes").notNull(),
  blockerReason: text("blocker_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * One row per successful completion of a task's current completion cycle.
 * The two unique constraints are what actually prevent duplicate completion
 * under concurrent/duplicate button clicks -- not UI disabling.
 */
export const completionEvents = pgTable(
  "doit_completion_events",
  {
    id: serial("id").primaryKey(),
    taskId: integer("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    completionCycle: integer("completion_cycle").notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 100 }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("doit_completion_events_idempotency_key_unique").on(table.idempotencyKey),
    unique("doit_completion_events_task_cycle_unique").on(table.taskId, table.completionCycle),
  ],
);

/**
 * "See" retrospectives over a plan/period. carriedPlanId records which new
 * plan this reflection's improvement was carried forward into.
 */
export const reflections = pgTable("doit_reflections", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id")
    .notNull()
    .references(() => plans.id, { onDelete: "cascade" }),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  summary: text("summary").notNull(),
  improvement: text("improvement").notNull(),
  carriedPlanId: integer("carried_plan_id").references((): AnyPgColumn => plans.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Plan = typeof plans.$inferSelect;
export type NewPlan = typeof plans.$inferInsert;
export type PlanRevision = typeof planRevisions.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type WorkLog = typeof workLogs.$inferSelect;
export type NewWorkLog = typeof workLogs.$inferInsert;
export type CompletionEvent = typeof completionEvents.$inferSelect;
export type Reflection = typeof reflections.$inferSelect;
export type NewReflection = typeof reflections.$inferInsert;
