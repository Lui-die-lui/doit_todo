import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import { plans, tasks } from "../src/db/schema";
import { user } from "../src/db/auth-schema";

const envConnectionString = process.env.SUPABASE_CONNECTION_KEY;
if (!envConnectionString) {
  throw new Error(
    "SUPABASE_CONNECTION_KEY is not set. Add the Postgres connection string to .env before seeding.",
  );
}
const connectionString: string = envConnectionString;

// doit_plans.user_id is NOT NULL (T07) -- this dev-only seed script needs a real,
// already-signed-up account to own the sample plan/tasks it inserts.
const envSeedUserEmail = process.env.SEED_USER_EMAIL;
if (!envSeedUserEmail) {
  throw new Error(
    "SEED_USER_EMAIL is not set. Sign up a real account first (email/password or Google), then set SEED_USER_EMAIL=<that email> before seeding.",
  );
}
const seedUserEmail: string = envSeedUserEmail;

const PLAN_TITLE = "정보처리기사 실기 재도전 준비";

async function main() {
  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);

  const [owner] = await db.select({ id: user.id }).from(user).where(eq(user.email, seedUserEmail));
  if (!owner) {
    console.error(`시드 실패: ${seedUserEmail} 계정을 찾을 수 없습니다. 먼저 그 이메일로 회원가입하세요.`);
    await client.end();
    process.exit(1);
  }

  const existing = await db
    .select({ id: plans.id })
    .from(plans)
    .where(eq(plans.title, PLAN_TITLE));
  if (existing.length > 0) {
    console.log(`시드 건너뜀: "${PLAN_TITLE}" 계획이 이미 존재합니다 (id=${existing[0].id}).`);
    await client.end();
    return;
  }

  await db.transaction(async (tx) => {
    const [plan] = await tx
      .insert(plans)
      .values({
        userId: owner.id,
        title: PLAN_TITLE,
        description: "정보처리기사 실기 시험을 다시 준비하며 취약 영역을 집중적으로 보완한다.",
        startDate: "2026-09-17",
        endDate: "2026-10-31",
        priority: "HIGH",
        successCriteria:
          "실전 모의고사 3회 평균 70점 이상, 취약 영역 오답 재풀이 정답률 80% 이상",
        estimatedMinutes: 1200,
      })
      .returning();

    await tx.insert(tasks).values([
      {
        planId: plan.id,
        title: "지난 시험 오답과 취약 영역 분류",
        description: "직전 회차 기출 오답을 정리하고 취약 영역을 분류한다.",
        dueDate: "2026-09-22",
        priority: "HIGH",
        tag: "복습",
        estimatedMinutes: 120,
      },
      {
        planId: plan.id,
        title: "C 포인터·배열·비트 연산 문제 복습",
        description: "포인터 연산, 배열 인덱싱, 비트 연산 실행 결과 문제를 반복 학습한다.",
        dueDate: "2026-09-30",
        priority: "HIGH",
        tag: "C",
        estimatedMinutes: 240,
      },
      {
        planId: plan.id,
        title: "Java 실행 결과 문제 복습",
        description: "Java 클래스, 상속, 예외 처리 실행 결과 문제를 반복 학습한다.",
        dueDate: "2026-10-07",
        priority: "MEDIUM",
        tag: "Java",
        estimatedMinutes: 200,
      },
      {
        planId: plan.id,
        title: "SQL·데이터베이스 기출 복습",
        description: "SQL 질의문 작성, 정규화, 트랜잭션 기출 문제를 복습한다.",
        dueDate: "2026-10-14",
        priority: "MEDIUM",
        tag: "SQL",
        estimatedMinutes: 180,
      },
      {
        planId: plan.id,
        title: "네트워크·보안 개념 정리",
        description: "OSI 7계층, 프로토콜, 보안 기본 개념을 정리한다.",
        dueDate: "2026-10-21",
        priority: "MEDIUM",
        tag: "이론",
        estimatedMinutes: 160,
      },
      {
        planId: plan.id,
        title: "실전 모의고사 3회 진행",
        description: "실전과 동일한 조건으로 모의고사 3회를 풀고 채점한다.",
        dueDate: "2026-10-29",
        priority: "HIGH",
        tag: "모의고사",
        estimatedMinutes: 300,
      },
    ]);
  });

  console.log(`시드 완료: "${PLAN_TITLE}" 계획과 할 일 6건을 생성했습니다.`);
  await client.end();
}

main().catch((err) => {
  console.error("시드 실패:", err);
  process.exit(1);
});
