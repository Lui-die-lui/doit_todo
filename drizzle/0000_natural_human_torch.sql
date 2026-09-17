CREATE TYPE "public"."doit_priority" AS ENUM('HIGH', 'MEDIUM', 'LOW');--> statement-breakpoint
CREATE TYPE "public"."doit_task_status" AS ENUM('TODO', 'DONE');--> statement-breakpoint
CREATE TABLE "doit_completion_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer NOT NULL,
	"completion_cycle" integer NOT NULL,
	"idempotency_key" varchar(100) NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "doit_completion_events_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "doit_completion_events_task_cycle_unique" UNIQUE("task_id","completion_cycle")
);
--> statement-breakpoint
CREATE TABLE "doit_plan_revisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"plan_id" integer NOT NULL,
	"version" integer NOT NULL,
	"prev_title" varchar(200) NOT NULL,
	"prev_description" text NOT NULL,
	"prev_start_date" date NOT NULL,
	"prev_end_date" date NOT NULL,
	"prev_priority" "doit_priority" NOT NULL,
	"prev_success_criteria" text NOT NULL,
	"prev_estimated_minutes" integer NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "doit_plan_revisions_plan_version_unique" UNIQUE("plan_id","version")
);
--> statement-breakpoint
CREATE TABLE "doit_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"priority" "doit_priority" NOT NULL,
	"success_criteria" text NOT NULL,
	"estimated_minutes" integer NOT NULL,
	"carried_improvement" text,
	"source_reflection_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "doit_reflections" (
	"id" serial PRIMARY KEY NOT NULL,
	"plan_id" integer NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"summary" text NOT NULL,
	"improvement" text NOT NULL,
	"carried_plan_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "doit_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"plan_id" integer NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"due_date" date NOT NULL,
	"priority" "doit_priority" NOT NULL,
	"tag" varchar(50) DEFAULT '' NOT NULL,
	"estimated_minutes" integer NOT NULL,
	"status" "doit_task_status" DEFAULT 'TODO' NOT NULL,
	"completed_at" timestamp with time zone,
	"completion_cycle" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "doit_work_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"actual_minutes" integer NOT NULL,
	"blocker_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "doit_completion_events" ADD CONSTRAINT "doit_completion_events_task_id_doit_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."doit_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doit_plan_revisions" ADD CONSTRAINT "doit_plan_revisions_plan_id_doit_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."doit_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doit_plans" ADD CONSTRAINT "doit_plans_source_reflection_id_doit_reflections_id_fk" FOREIGN KEY ("source_reflection_id") REFERENCES "public"."doit_reflections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doit_reflections" ADD CONSTRAINT "doit_reflections_plan_id_doit_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."doit_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doit_reflections" ADD CONSTRAINT "doit_reflections_carried_plan_id_doit_plans_id_fk" FOREIGN KEY ("carried_plan_id") REFERENCES "public"."doit_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doit_tasks" ADD CONSTRAINT "doit_tasks_plan_id_doit_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."doit_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doit_work_logs" ADD CONSTRAINT "doit_work_logs_task_id_doit_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."doit_tasks"("id") ON DELETE cascade ON UPDATE no action;