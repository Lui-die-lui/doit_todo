import { NextResponse } from "next/server";
import { db } from "@/db";
import { completionEvents, planRevisions, plans, reflections, tasks, workLogs } from "@/db/schema";

export const dynamic = "force-dynamic";

const SCHEMA_VERSION = "2.0.0";

export async function GET() {
  try {
    const [planRows, revisionRows, taskRows, workLogRows, completionRows, reflectionRows] =
      await Promise.all([
        db.select().from(plans),
        db.select().from(planRevisions),
        db.select().from(tasks),
        db.select().from(workLogs),
        db.select().from(completionEvents),
        db.select().from(reflections),
      ]);

    const payload = {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
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
