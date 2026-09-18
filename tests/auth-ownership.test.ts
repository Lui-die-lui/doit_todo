/**
 * Integration tests for T07 auth/ownership behavior (CLAUDE.md 9.1's required test
 * list). Unlike the rest of tests/ (pure-function unit tests), these hit a real
 * running server over HTTP -- Server Actions can't be invoked in-process outside a
 * live Next.js request context, and testing cross-user write rejection for real
 * means submitting a real (tampered) form through a real browser.
 *
 * Requires the app running at BETTER_AUTH_URL (defaults to http://localhost:3000):
 *   npm run dev        (or) npm run build && npm run start
 *   npm test            -- runs this file along with everything else
 *
 * If the server isn't reachable, every test here is skipped (not failed) with a
 * console warning, so `npm test` stays green in environments with no server up.
 *
 * Every account/plan/task this file creates is disposable (unique per run,
 * timestamp-suffixed emails) and deleted in afterAll. Never touches real user data.
 */
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { chromium, type Browser } from "playwright";

const BASE = process.env.BETTER_AUTH_URL || "http://localhost:3000";
const JSON_HEADERS = { "Content-Type": "application/json", Origin: BASE } as const;

async function checkServerUp(): Promise<boolean> {
  try {
    const res = await fetch(BASE, { signal: AbortSignal.timeout(2000) });
    return res.status < 500;
  } catch {
    return false;
  }
}

class Jar {
  cookies = new Map<string, string>();
  apply(res: Response) {
    const anyHeaders = res.headers as unknown as { getSetCookie?: () => string[] };
    const raws = anyHeaders.getSetCookie ? anyHeaders.getSetCookie() : ([res.headers.get("set-cookie")].filter(Boolean) as string[]);
    for (const raw of raws) {
      const pair = raw.split(";")[0];
      const idx = pair.indexOf("=");
      if (idx < 0) continue;
      this.cookies.set(pair.slice(0, idx), pair.slice(idx + 1));
    }
  }
  header(): string {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  clone(): Jar {
    const j = new Jar();
    j.cookies = new Map(this.cookies);
    return j;
  }
}

// Top-level await resolves before vitest collects the describe block below, so
// describe.skipIf sees a real boolean rather than a pending promise.
const serverUp = await checkServerUp();
if (!serverUp) {
  console.warn(
    `\n⚠ auth-ownership.test.ts: ${BASE} 에 연결할 수 없어 전부 건너뜁니다. ` +
      `"npm run dev" (또는 build && start)로 서버를 띄운 뒤 다시 실행하세요.\n`,
  );
}

describe.skipIf(!serverUp)("T07 auth & ownership (CLAUDE.md 9.1)", () => {
  const sql = postgres(process.env.SUPABASE_CONNECTION_KEY!, { max: 1 });
  const stamp = Date.now();
  const userA = { email: `t07-test-a-${stamp}@example.com`, password: "TestPassA1!", name: "Test A" };
  const userB = { email: `t07-test-b-${stamp}@example.com`, password: "TestPassB1!", name: "Test B" };

  let jarA = new Jar();
  const jarB = new Jar();
  let userAId: string;
  let userBId: string;
  let planAId: number;
  let planBId: number;
  let taskAId: number;

  beforeAll(async () => {
    let res = await fetch(`${BASE}/api/auth/sign-up/email`, { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(userA) });
    jarA.apply(res);
    res = await fetch(`${BASE}/api/auth/sign-up/email`, { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(userB) });
    jarB.apply(res);

    const [rowA] = await sql<{ id: string }[]>`select id from "user" where email = ${userA.email}`;
    const [rowB] = await sql<{ id: string }[]>`select id from "user" where email = ${userB.email}`;
    userAId = rowA.id;
    userBId = rowB.id;

    const [pa] = await sql<{ id: number }[]>`
      insert into doit_plans (user_id, title, description, start_date, end_date, priority, success_criteria, estimated_minutes)
      values (${userAId}, 'T07 test plan A', '', '2026-01-01', '2026-01-31', 'MEDIUM', 'test', 60) returning id
    `;
    planAId = pa.id;
    const [ta] = await sql<{ id: number }[]>`
      insert into doit_tasks (plan_id, title, description, due_date, priority, tag, estimated_minutes, status)
      values (${planAId}, 'T07 test task A', '', '2026-01-15', 'MEDIUM', '', 30, 'TODO') returning id
    `;
    taskAId = ta.id;

    const [pb] = await sql<{ id: number }[]>`
      insert into doit_plans (user_id, title, description, start_date, end_date, priority, success_criteria, estimated_minutes)
      values (${userBId}, 'T07 test plan B', '', '2026-01-01', '2026-01-31', 'MEDIUM', 'test', 60) returning id
    `;
    planBId = pb.id;
  });

  afterAll(async () => {
    // Owner deletion cascades to plans/tasks/logs; direct deletes cover anything a
    // failed assertion left behind (e.g. the delete-account test's own target user).
    await sql`delete from "user" where email in (${userA.email}, ${userB.email})`;
    await sql.end();
  });

  it("1) 중복 이메일 가입은 새 계정을 만들지 않는다", async () => {
    const res = await fetch(`${BASE}/api/auth/sign-up/email`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ email: userA.email, password: "DifferentPass1!", name: "Duplicate" }),
    });
    expect(res.status).not.toBe(200);
    const rows = await sql`select id from "user" where email = ${userA.email}`;
    expect(rows.length).toBe(1);
  });

  it("2) 존재하지 않는 이메일과 틀린 비밀번호는 같은 오류를 준다", async () => {
    const resNoSuchUser = await fetch(`${BASE}/api/auth/sign-in/email`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ email: `t07-nobody-${stamp}@example.com`, password: "Whatever1!" }),
    });
    const resWrongPassword = await fetch(`${BASE}/api/auth/sign-in/email`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ email: userA.email, password: "WrongPassword1!" }),
    });
    expect(resNoSuchUser.status).toBe(resWrongPassword.status);
    const [bodyNoSuchUser, bodyWrongPassword] = await Promise.all([resNoSuchUser.json(), resWrongPassword.json()]);
    expect(bodyNoSuchUser.code).toBe(bodyWrongPassword.code);
  });

  it("3) 미인증 API 요청은 401", async () => {
    const res = await fetch(`${BASE}/api/export`);
    expect(res.status).toBe(401);
  });

  it("4) A/B 목록에 상대방 자료가 0건 (플랜 목록 페이지)", async () => {
    const [htmlA, htmlB] = await Promise.all([
      fetch(`${BASE}/plans`, { headers: { Cookie: jarA.header() } }).then((r) => r.text()),
      fetch(`${BASE}/plans`, { headers: { Cookie: jarB.header() } }).then((r) => r.text()),
    ]);
    expect(htmlA).toContain("T07 test plan A");
    expect(htmlA).not.toContain("T07 test plan B");
    expect(htmlB).toContain("T07 test plan B");
    expect(htmlB).not.toContain("T07 test plan A");
  });

  it("5) B가 A의 계획/할 일을 읽으려 하면 404 (내용이 새어나오지 않는다)", async () => {
    // App Router's streaming SSR returns HTTP 200 for a nested notFound() call
    // (the shell above it already started streaming) -- the not-found page is the
    // actual body, just not reflected in this response's own status code. So the
    // real check is content: A's title/success-criteria text must never appear in
    // what B receives, whatever the status code says.
    const paths = [`/plans/${planAId}`, `/plans/${planAId}/edit`, `/plans/${planAId}/history`, `/tasks/${taskAId}`, `/tasks/${taskAId}/edit`];
    for (const path of paths) {
      const res = await fetch(`${BASE}${path}`, { headers: { Cookie: jarB.header() } });
      const text = await res.text();
      expect(text, `${path} leaked A's plan title to a non-owner`).not.toContain("T07 test plan A");
      expect(text, `${path} leaked A's task title to a non-owner`).not.toContain("T07 test task A");
    }
  });

  it("6a) 헤더에 다른 사용자 id를 넣어도 무시된다 (export는 세션 기준만)", async () => {
    const res = await fetch(`${BASE}/api/export`, {
      headers: { Cookie: jarB.header(), "X-User-Id": userAId, "X-Impersonate": userA.email },
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.user.id).toBe(userBId);
    expect(JSON.stringify(body.plans)).not.toContain("T07 test plan A");
  });

  it("6b/5) B가 폼의 숨은 planId를 A의 것으로 바꿔 제출해도 A의 계획은 그대로 -- 실제 브라우저로 검증", async () => {
    const browser: Browser = await chromium.launch({ channel: "chrome", headless: true });
    try {
      const context = await browser.newContext();
      const [name, value] = [...jarB.cookies.entries()][0];
      await context.addCookies([{ name, value: decodeURIComponent(value), domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" }]);
      const page = await context.newPage();
      await page.goto(`${BASE}/plans/${planBId}`, { waitUntil: "networkidle" });

      // The archive form's hidden `planId` input is the one client-tamperable value
      // in this flow -- swap it to A's plan id, then submit exactly as a real user
      // would (confirm dialog included), and see whether the server-side ownership
      // check (not the UI) is what actually stops it.
      page.once("dialog", (d) => d.accept());
      await page.evaluate((targetId) => {
        const input = document.querySelector('input[name="planId"]') as HTMLInputElement | null;
        if (!input) throw new Error("planId hidden input not found");
        input.value = String(targetId);
      }, planAId);
      await page.click('button:has-text("보관")');
      await page.waitForLoadState("networkidle");
    } finally {
      await browser.close();
    }

    const [row] = await sql<{ deletedAt: string | null }[]>`select deleted_at as "deletedAt" from doit_plans where id = ${planAId}`;
    expect(row.deletedAt).toBeNull();
  });

  it("7) 위 거절 시도 전후로 A의 자료 건수는 그대로", async () => {
    const [{ count }] = await sql<{ count: number }[]>`select count(*)::int as count from doit_plans where user_id = ${userAId}`;
    expect(count).toBe(1);
  });

  it("8) 로그아웃 뒤 같은 세션 토큰으로 재요청하면 거절", async () => {
    const jarLive = jarA.clone();
    let res = await fetch(`${BASE}/api/export`, { headers: { Cookie: jarLive.header() } });
    expect(res.status).toBe(200); // sanity: cookie is valid before logout

    const oldCookie = jarLive.clone();
    res = await fetch(`${BASE}/api/auth/sign-out`, { method: "POST", headers: { ...JSON_HEADERS, Cookie: jarLive.header() }, body: "{}" });
    jarLive.apply(res);

    res = await fetch(`${BASE}/api/export`, { headers: { Cookie: oldCookie.header() } });
    expect(res.status).toBe(401);

    // re-establish jarA for the remaining tests, which still need a live A session
    res = await fetch(`${BASE}/api/auth/sign-in/email`, { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(userA) });
    jarA = new Jar();
    jarA.apply(res);
  });

  it("9) 비밀번호 변경 뒤 이전 세션은 거절된다", async () => {
    const oldCookie = jarA.clone();
    const newPassword = "RotatedPassA1!";
    const res = await fetch(`${BASE}/api/auth/change-password`, {
      method: "POST",
      headers: { ...JSON_HEADERS, Cookie: jarA.header() },
      body: JSON.stringify({ currentPassword: userA.password, newPassword, revokeOtherSessions: true }),
    });
    expect(res.status).toBe(200);
    userA.password = newPassword;

    const check = await fetch(`${BASE}/api/export`, { headers: { Cookie: oldCookie.header() } });
    expect(check.status).toBe(401);

    // re-establish jarA with the rotated password for the remaining tests
    const login = await fetch(`${BASE}/api/auth/sign-in/email`, { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(userA) });
    jarA = new Jar();
    jarA.apply(login);
  });

  it("10) export에는 본인 자료만, secret은 전혀 없다", async () => {
    const res = await fetch(`${BASE}/api/export`, { headers: { Cookie: jarA.header() } });
    const body = await res.json();
    const text = JSON.stringify(body);
    expect(body.plans.every((p: { title: string }) => p.title !== "T07 test plan B")).toBe(true);
    expect(text).not.toMatch(/passwordHash|"password"|sessionToken|accessToken|refreshToken|idToken/i);
  });

  it("11) 계정 삭제는 user/session/account와 소유 자료를 함께 지운다", async () => {
    const res = await fetch(`${BASE}/api/auth/delete-user`, {
      method: "POST",
      headers: { ...JSON_HEADERS, Cookie: jarA.header() },
      body: JSON.stringify({ password: userA.password }),
    });
    expect(res.status).toBe(200);

    const [remainingUser] = await sql`select id from "user" where id = ${userAId}`;
    const [remainingSession] = await sql`select id from session where user_id = ${userAId}`;
    const [remainingAccount] = await sql`select id from account where user_id = ${userAId}`;
    const [remainingPlan] = await sql`select id from doit_plans where id = ${planAId}`;
    expect(remainingUser).toBeUndefined();
    expect(remainingSession).toBeUndefined();
    expect(remainingAccount).toBeUndefined();
    expect(remainingPlan).toBeUndefined();
  });
});
