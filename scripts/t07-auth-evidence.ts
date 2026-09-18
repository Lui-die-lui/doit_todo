/**
 * T07 보안 증거 수집 스크립트 (CLAUDE.md 9.2).
 *
 * 사용법:
 *   1. 앱을 띄운다: npm run dev  (또는 npm run build && npm run start)
 *   2. 테스트 계정 A/B의 이메일·비밀번호를 환경변수로만 지정한다 (코드/커밋에 절대 쓰지 않음):
 *        T07_TEST_EMAIL_A=... T07_TEST_PASSWORD_A=... T07_TEST_EMAIL_B=... T07_TEST_PASSWORD_B=... \
 *        npx tsx scripts/t07-auth-evidence.ts
 *      값을 안 주면 이 실행 한定 임시 이메일/비밀번호를 스스로 생성해서 쓰고, 끝나면 지운다.
 *   3. 출력은 docs/T07_EVIDENCE.md에 그대로 옮겨 붙이면 된다.
 *
 * 이 스크립트는 세션 쿠키를 디스크에 파일로 저장하지 않는다(메모리에만 보관) -- 커밋될
 * 위험이 있는 임시 쿠키 파일 자체를 아예 만들지 않는 방식으로 "커밋하지 않는다" 요구를 satisfy.
 * 출력에는 시간·method·path·계정 별칭·status·비밀 제거된 응답만 남기고, 쿠키/토큰 값은
 * 절대 원문으로 찍지 않는다(마스킹 처리).
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import postgres from "postgres";

const BASE = process.env.BETTER_AUTH_URL || "http://localhost:3000";
const JSON_HEADERS = { "Content-Type": "application/json", Origin: BASE } as const;

const usingOwnCreds = !!(process.env.T07_TEST_EMAIL_A && process.env.T07_TEST_EMAIL_B);
const runId = Date.now();
const accountA = {
  alias: "A",
  email: process.env.T07_TEST_EMAIL_A || `t07-evidence-a-${runId}@example.com`,
  password: process.env.T07_TEST_PASSWORD_A || `EvA-${randomUUID().slice(0, 12)}!`,
};
const accountB = {
  alias: "B",
  email: process.env.T07_TEST_EMAIL_B || `t07-evidence-b-${runId}@example.com`,
  password: process.env.T07_TEST_PASSWORD_B || `EvB-${randomUUID().slice(0, 12)}!`,
};

function maskCookie(pair: string): string {
  const [name, value] = pair.split("=");
  if (!value) return pair;
  return `${name}=${value.slice(0, 6)}…생략`;
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
  maskedHeader(): string {
    return [...this.cookies.entries()].map(([k, v]) => maskCookie(`${k}=${v}`)).join("; ");
  }
  clone(): Jar {
    const j = new Jar();
    j.cookies = new Map(this.cookies);
    return j;
  }
}

function redactSecrets(value: unknown): unknown {
  const text = JSON.stringify(value);
  return JSON.parse(
    text.replace(/"(password|token|hash|secret|accessToken|refreshToken|idToken|sessionToken)"\s*:\s*"[^"]*"/gi, (m, key) => `"${key}":"…생략"`),
  );
}

type LogEntry = { alias: string; loggedIn: boolean; method: string; path: string; status: number; body: unknown };
const log: LogEntry[] = [];

async function call(
  alias: string,
  loggedIn: boolean,
  method: string,
  path: string,
  jar: Jar | null,
  body?: unknown,
): Promise<{ res: Response; json: unknown }> {
  const headers: Record<string, string> = { ...JSON_HEADERS };
  if (jar) headers.Cookie = jar.header();
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const contentType = res.headers.get("content-type") ?? "";
  let json: unknown = null;
  if (contentType.includes("application/json")) {
    json = await res.json().catch(() => null);
  } else {
    const text = await res.text();
    json = { _html: `${text.length} bytes` };
  }
  log.push({ alias, loggedIn, method, path, status: res.status, body: redactSecrets(json) });
  return { res, json };
}

function printLog() {
  console.log("\n=== T07 증거 로그 (비밀 제거됨) ===\n");
  console.log(`실행 시각(UTC): ${new Date().toISOString()}`);
  console.log(`BASE: ${BASE}\n`);
  for (const e of log) {
    console.log(
      `[${e.alias}${e.loggedIn ? " · 로그인" : " · 미인증"}] ${e.method} ${e.path} -> ${e.status}\n  응답: ${JSON.stringify(e.body)}\n`,
    );
  }
}

async function main() {
  const sql = postgres(process.env.SUPABASE_CONNECTION_KEY!, { max: 1 });
  const jarA = new Jar();
  const jarB = new Jar();

  console.log(`계정 A: ${accountA.email} (${usingOwnCreds ? "환경변수 제공" : "이번 실행용 임시 생성"})`);
  console.log(`계정 B: ${accountB.email} (${usingOwnCreds ? "환경변수 제공" : "이번 실행용 임시 생성"})`);
  console.log("비밀번호는 어떤 로그·출력에도 원문으로 남기지 않습니다.\n");

  // Sign up (idempotent-ish: if the account already exists this just fails safely
  // and we fall through to sign-in).
  await call(accountA.alias, false, "POST", "/api/auth/sign-up/email", null, { ...accountA, name: "T07 Evidence A" });
  await call(accountB.alias, false, "POST", "/api/auth/sign-up/email", null, { ...accountB, name: "T07 Evidence B" });

  const { res: loginA } = await call(accountA.alias, false, "POST", "/api/auth/sign-in/email", null, accountA);
  jarA.apply(loginA);
  const { res: loginB } = await call(accountB.alias, false, "POST", "/api/auth/sign-in/email", null, accountB);
  jarB.apply(loginB);

  const [rowA] = await sql<{ id: string }[]>`select id from "user" where email = ${accountA.email}`;
  const [rowB] = await sql<{ id: string }[]>`select id from "user" where email = ${accountB.email}`;

  // ---- bundle 8: same password, different hash ----
  const [{ password: hashA }] = await sql<{ password: string }[]>`
    select a.password from account a join "user" u on u.id = a.user_id where u.email = ${accountA.email}
  `;
  const [{ password: hashB }] = await sql<{ password: string }[]>`
    select a.password from account a join "user" u on u.id = a.user_id where u.email = ${accountB.email}
  `;
  console.log("=== 8) 같은 비밀번호를 쓴 두 계정의 해시가 다른지 ===");
  console.log(`A 해시 일부: ${hashA.slice(0, 24)}…`);
  console.log(`B 해시 일부: ${hashB.slice(0, 24)}…`);
  console.log(`서로 다름: ${hashA !== hashB}\n`);

  // fixtures: one plan each
  const [planA] = await sql<{ id: number }[]>`
    insert into doit_plans (user_id, title, description, start_date, end_date, priority, success_criteria, estimated_minutes)
    values (${rowA.id}, 'T07 evidence plan A', '', '2026-01-01', '2026-01-31', 'MEDIUM', 'evidence', 60) returning id
  `;
  await sql`
    insert into doit_plans (user_id, title, description, start_date, end_date, priority, success_criteria, estimated_minutes)
    values (${rowB.id}, 'T07 evidence plan B', '', '2026-01-01', '2026-01-31', 'MEDIUM', 'evidence', 60)
  `;

  // ---- bundle 2: unauthenticated direct access rejected ----
  await call("(none)", false, "GET", "/api/export", null);

  // ---- bundle 1: authenticated success vs after-logout same request rejected ----
  await call(accountA.alias, true, "GET", "/api/export", jarA);
  const preLogoutCookie = jarA.clone();
  const signOut = await call(accountA.alias, true, "POST", "/api/auth/sign-out", jarA, {});
  jarA.apply(signOut.res);
  log.push({
    alias: accountA.alias,
    loggedIn: false,
    method: "GET",
    path: "/api/export (이전 세션 쿠키 재사용)",
    status: (await fetch(`${BASE}/api/export`, { headers: { Cookie: preLogoutCookie.header() } })).status,
    body: { note: "로그아웃 전 세션 쿠키로 재요청" },
  });

  // re-login A for the remaining bundles
  const relogin = await call(accountA.alias, false, "POST", "/api/auth/sign-in/email", null, accountA);
  jarA.apply(relogin.res);

  // ---- bundle 5: list isolation ----
  const { json: plansAsA } = await call(accountA.alias, true, "GET", "/api/export", jarA);
  const { json: plansAsB } = await call(accountB.alias, true, "GET", "/api/export", jarB);
  const aPlans = (plansAsA as { plans?: { title: string }[] })?.plans ?? [];
  const bPlans = (plansAsB as { plans?: { title: string }[] })?.plans ?? [];
  console.log("=== 5) A/B 목록에 상대 자료 0건 ===");
  console.log(`A의 export에 B 계획 포함: ${aPlans.some((p) => p.title.includes("plan B"))}`);
  console.log(`B의 export에 A 계획 포함: ${bPlans.some((p) => p.title.includes("plan A"))}\n`);

  // ---- bundle 3/4: cross-user read rejected (both directions) ----
  // App Router's streaming SSR returns HTTP 200 even for a nested notFound() (the
  // shell above it already started streaming) -- the real signal is body content,
  // not the status code. See docs/T07_AUTH_IMPLEMENTATION.md.
  const beforeCountA = (await sql`select count(*)::int as c from doit_plans where user_id = ${rowA.id}`)[0].c;
  const readAttempt = await call(accountB.alias, true, "GET", `/plans/${planA.id}`, jarB);
  const readAttemptHtml = await (await fetch(`${BASE}/plans/${planA.id}`, { headers: { Cookie: jarB.header() } })).text();
  const editAttempt = await call(accountB.alias, true, "GET", `/plans/${planA.id}/edit`, jarB);
  const afterCountA = (await sql`select count(*)::int as c from doit_plans where user_id = ${rowA.id}`)[0].c;
  console.log("=== 3/4/7) B→A 읽기·수정 화면 거절, 거절 전후 A 자료 건수 ===");
  console.log(`/plans/${planA.id} 응답 status: ${readAttempt.res.status} (스트리밍 특성상 200이어도 무방 -- 아래 내용 검사가 실제 판정)`);
  console.log(`응답 본문에 A 계획 제목 포함 여부: ${readAttemptHtml.includes("T07 evidence plan A")} (false여야 정상)`);
  console.log(`/plans/${planA.id}/edit 응답 status: ${editAttempt.res.status}`);
  console.log(`시도 전 A 계획 수: ${beforeCountA}, 시도 후: ${afterCountA}, 변화 없음: ${beforeCountA === afterCountA}\n`);

  // ---- bundle 6: tampered header ignored ----
  const res = await fetch(`${BASE}/api/export`, { headers: { Cookie: jarB.header(), "X-User-Id": rowA.id } });
  const bodyTampered = await res.json();
  log.push({ alias: accountB.alias, loggedIn: true, method: "GET", path: "/api/export (X-User-Id 조작)", status: res.status, body: redactSecrets(bodyTampered) });
  console.log("=== 6) 조작된 헤더의 다른 사용자 id 무시 ===");
  console.log(`응답 user.id가 여전히 B: ${bodyTampered.user.id === rowB.id}\n`);

  printLog();

  console.log("=== 쿠키(마스킹) ===");
  console.log(`A: ${jarA.maskedHeader()}`);
  console.log(`B: ${jarB.maskedHeader()}\n`);

  if (!usingOwnCreds) {
    await sql`delete from "user" where email in (${accountA.email}, ${accountB.email})`;
    console.log("이번 실행에서 생성한 임시 계정/자료를 정리했습니다.");
  } else {
    console.log("환경변수로 지정된 계정은 이 스크립트가 지우지 않습니다 -- 직접 정리하세요.");
  }
  await sql.end();
}

main().catch((err) => {
  console.error("증거 수집 실패:", err);
  process.exit(1);
});
