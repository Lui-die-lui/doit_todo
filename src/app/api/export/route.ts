import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { completionEvents, planRevisions, plans, reflections, tasks, workLogs } from "@/db/schema";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const SCHEMA_VERSION = "2.0.0";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    // Every other table is scoped from the caller's own plan ids -- never the whole table.
    const planRows = await db.select().from(plans).where(eq(plans.userId, userId));
    const planIds = planRows.map((p) => p.id);

    const [revisionRows, taskRows, reflectionRows] = await Promise.all([
      planIds.length ? db.select().from(planRevisions).where(inArray(planRevisions.planId, planIds)) : [],
      planIds.length ? db.select().from(tasks).where(inArray(tasks.planId, planIds)) : [],
      planIds.length ? db.select().from(reflections).where(inArray(reflections.planId, planIds)) : [],
    ]);

    const taskIds = taskRows.map((t) => t.id);
    const [workLogRows, completionRows] = await Promise.all([
      taskIds.length ? db.select().from(workLogs).where(inArray(workLogs.taskId, taskIds)) : [],
      taskIds.length ? db.select().from(completionEvents).where(inArray(completionEvents.taskId, taskIds)) : [],
    ]);

    const payload = {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      // Only id/name/email -- never password hash, session token, or OAuth tokens.
      user: { id: session.user.id, name: session.user.name, email: session.user.email },
      plans: planRows,
      planRevisions: revisionRows,
      tasks: taskRows,
      workLogs: workLogRows,
      completionEvents: completionRows,
      reflections: reflectionRows,
    };

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="doit-export-${Date.now()}.json"`,
      },
    });
  } catch (err) {
    console.error("export failed", err);
    return NextResponse.json(
      { error: "내보내기에 실패했습니다. 잠시 후 다시 시도해주세요." },
      { status: 500 },
    );
  }
}
