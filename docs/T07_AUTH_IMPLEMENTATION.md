# T07 인증 구현 문서

Doit(플랜두씨 다이어리) T07 — 이메일/비밀번호 + Google OAuth 인증, 사용자별 자료 격리.

## ① 무엇으로 붙였나

- 인증 라이브러리: **Better Auth `1.7.5`** (`npm ls better-auth` 실측 고정 버전, `package.json`/lockfile 동일)
- 로그인 방식: 이메일/비밀번호 (`emailAndPassword.enabled = true`) + Google OAuth (`socialProviders.google`)
- 비밀번호 저장: Better Auth 기본 **scrypt** (별도 설정 없이 기본값 사용)
- 세션: DB 저장 불투명 토큰, `HttpOnly` 쿠키. **만료 7일**(`expiresIn = 60*60*24*7`), **갱신 주기 1일**(`updateAge = 60*60*24`) — [src/lib/auth.ts](../src/lib/auth.ts)에 상수로 명시
- DB/ORM: 기존 Drizzle ORM + Supabase Postgres 재사용, `drizzleAdapter(db, { provider: "pg", schema: authSchema })`
- Google OAuth scope: provider 기본값(`email`, `profile`, `openid`)만 사용. Drive/Gmail/Calendar 등 추가 scope 없음

## ② 왜 그걸 골랐나

- 현재 스택(Next.js App Router + Drizzle + Postgres)에 어댑터로 바로 연결되어 별도 인증 서버나 스키마 재설계가 필요 없다.
- 이메일/비밀번호와 Google OAuth를 같은 인증 계층에서 함께 제공하며, DB 세션이라 로그아웃/비밀번호 변경 시 서버에서 즉시 세션을 폐기할 수 있다(JWT stateless 세션이었다면 폐기 시점 증명이 어려웠을 것).
- 기본 해시가 과제 허용 방식인 scrypt이고 salt가 포함되어 동일 비밀번호도 계정마다 다른 저장값이 된다 (`docs/T07_EVIDENCE.md` §8에서 직접 확인).
- **검토했지만 채택하지 않음 — Supabase Auth**: 현재 DB에 가장 가깝지만, 채택 시 기존 Drizzle 기반 서버 로직과 RLS/세션 책임을 동시에 재설계해야 하고, 비밀번호 해시·세션 폐기 증거를 앱 코드·DB 기준으로 설명하기가 Better Auth보다 복잡해진다고 판단해 제외했다.
- **검토했지만 채택하지 않음 — 완전 직접 구현**: 비밀번호 해시, 쿠키 서명, 세션 회전, OAuth state/PKCE를 직접 다루는 구현 위험이 이 과제 범위에서 불필요하게 크다.

## ③ 어디를 어떻게 고쳤나

### 회원가입 흐름
- UI: [src/components/auth/SignupForm.tsx](../src/components/auth/SignupForm.tsx) — `authClient.signUp.email({ name, email, password })`
- 비밀번호 확인란 불일치는 클라이언트에서 요청 전 차단(`PASSWORD_MISMATCH_ERROR`)
- 서버 오류 코드 매핑: 비밀번호 길이 관련 코드만 구체적 메시지, 이메일 관련 코드(중복 포함)는 전부 동일한 일반 문구(`GENERIC_EMAIL_ERROR`)로 응답 — 사용자 열거 방지
- 핸들러: `/api/auth/sign-up/email` (Better Auth 기본 handler, [src/app/api/auth/[...all]/route.ts](../src/app/api/auth/%5B...all%5D/route.ts))

### 로그인 흐름
- 화면: 로그인/회원가입 폼은 `/login`([src/app/login/page.tsx](../src/app/login/page.tsx), 로그인/가입 폼 전환은 [src/components/auth/AuthScreen.tsx](../src/components/auth/AuthScreen.tsx))에 있고, 비로그인 첫 화면 `/`([src/app/page.tsx](../src/app/page.tsx))의 "로그인하고 궤도 열기"/"처음이라면 회원가입" 링크로 진입한다. 로그인 상태로 `/`나 `/login`에 오면 `/dashboard`로 redirect
- UI: [src/components/auth/LoginForm.tsx](../src/components/auth/LoginForm.tsx) — `authClient.signIn.email(...)`
- 존재하지 않는 이메일과 틀린 비밀번호에 동일 문구(`GENERIC_LOGIN_ERROR = "이메일 또는 비밀번호가 올바르지 않습니다."`) 사용
- Google 로그인: [src/components/auth/GoogleContinueButton.tsx](../src/components/auth/GoogleContinueButton.tsx) — `authClient.signIn.social({ provider: "google" })`
- 로그인 성공 후 `/dashboard`로 이동

### 로그아웃 흐름
- [src/components/auth/LogoutButton.tsx](../src/components/auth/LogoutButton.tsx) — `authClient.signOut()` 호출 후 `/login`(로그인 화면)으로 이동. 서버는 해당 세션 행을 DB에서 삭제(Better Auth 내부 동작)하므로 이전 쿠키 재사용 시 거절됨(`docs/T07_EVIDENCE.md` §1)

### 자료 조회 흐름 / 소유권 검사
- 소유권 모델: `doit_plans.user_id`를 기준으로, `doit_tasks`는 plan 조인, `doit_work_logs`/`reflections`/`completion_events`는 task→plan 조인으로 확인 — [src/lib/queries.ts](../src/lib/queries.ts), [src/lib/see-scope.ts](../src/lib/see-scope.ts) 전 함수가 첫 인자로 `userId`를 받아 WHERE 절에 강제 포함
- 세션 검사 지점 (3중 방어):
  1. **middleware** ([src/middleware.ts](../src/middleware.ts)): `/plans`, `/tasks`, `/do`, `/see`, `/mypage`에서 세션 쿠키 존재만 확인 후 없으면 `/login`으로 redirect. `/dashboard`는 로그인 없이도 빈 데모 화면을 보여줘야 해서 의도적으로 제외(아래 "범위 결정" 참고)
  2. **페이지 레벨** ([src/lib/session.ts](../src/lib/session.ts)의 `requireSessionOrRedirect()`): 모든 자료 화면의 서버 컴포넌트 최상단에서 실제 세션을 재검증 후 없으면 redirect. 사용처: `dashboard/page.tsx`, `do/page.tsx`, `mypage/page.tsx`, `plans/*`, `see/*`, `tasks/*` 전 페이지
  3. **Server Action 레벨** ([src/lib/actions/*.ts](../src/lib/actions/)): `getSessionUserId()`로 매 액션마다 세션을 직접 읽고, 얻은 `userId`만 쿼리에 사용. 요청 body/hidden field로 들어온 `planId` 등은 **소유권 검사 없이는 절대 update/delete에 쓰지 않음**
  4. **API route** ([src/app/api/export/route.ts](../src/app/api/export/route.ts)): 세션 없으면 JSON `401`, 있으면 `session.user.id`만 사용
- 다른 사용자 자료 접근 시 응답: 목록/조회는 조건절에서 자동으로 빠지고, 단건 접근은 owner 조건이 포함된 WHERE로 0행 → 페이지는 Next.js `notFound()`(HTML 404), API는 빈 결과/무시. 프로젝트 전체에서 "존재 은폐" 원칙을 owner-scoped 쿼리로 일관 적용(응답 자체가 대상이 없는 것처럼 동작)
- Server Action에서 클라이언트가 보낸 `userId`/`ownerId`/`email` 필드는 애초에 읽지 않음(타입에도 없음) — 세션에서 얻은 `userId`만 사용

### DB schema / migration
- `drizzle/0001_t07_auth_and_plan_owner.sql`: Better Auth 4테이블(`user`/`session`/`account`/`verification`) 생성 + `doit_plans.user_id` 컬럼 추가(nullable, FK `ON DELETE CASCADE` → `user.id`)
- `drizzle/0002_t07_plans_user_id_not_null.sql`: `ALTER TABLE "doit_plans" ALTER COLUMN "user_id" SET NOT NULL` — 고아 레코드 0건 확인 후 적용, `information_schema.columns`에서 `is_nullable: NO` 재확인 완료
- Cascade 정책: `user` 삭제 → `session`/`account`(Better Auth 자체 FK) 및 `doit_plans.user_id`(우리 FK) 모두 `ON DELETE CASCADE`. `doit_tasks`/`doit_work_logs`/`reflections`/`completion_events`는 기존 T06 스키마의 plan/task 체인 cascade를 그대로 재사용 — 계정 삭제 시 단일 `DELETE FROM user` 한 문장으로 전체 소유 자료가 DB 레벨에서 연쇄 삭제됨

### T06 데이터 이전 (CLAUDE.md 5.2)
- 조사 결과 **해당 사항 없음**: 실사용자 계정을 만든 시점에 기존 T06 plan 데이터가 존재하지 않았다(사용자가 T07 작업 직전 DB를 직접 비움). `user_id IS NULL`인 leftover plan 1건이 발견되었으나, 확인 결과 실제 T06 자료가 아니라 본 작업 중 실패한 검증 스크립트가 남긴 테스트 debris(`"T07 cascade test plan"`, 연결 레코드 0건)였음을 제목·건수 대조로 확인 → 사용자 승인 하에 삭제, migration 대상 아님
- 이후 실제 사용자(`lsg960528@gmail.com`)는 본인 계정으로 화면에서 직접 계획을 생성해 현재 1건 보유 — 이전(backfill)이 아닌 정상 생성 경로

### 계정 삭제 / 비밀번호 변경
- [src/components/mypage/ChangePasswordForm.tsx](../src/components/mypage/ChangePasswordForm.tsx): `authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true })` 호출 후 호출 기기 세션도 명시적으로 `signOut()` — "다른 기기만 로그아웃"이 아니라 완전 재로그인 요구로 통일
- [src/components/mypage/DeleteAccountSection.tsx](../src/components/mypage/DeleteAccountSection.tsx): 확인 문구(`"탈퇴합니다"`) 직접 입력 + credential 계정은 현재 비밀번호 재확인 후 `authClient.deleteUser(...)` 호출. 삭제 전 화면에 삭제 대상(계정/계획/할 일/실행 기록/회고/완료 기록) 명시, Google 계정 자체는 삭제되지 않는다는 안내 포함
- `user.deleteUser.enabled = true`를 auth.ts에 명시 설정(기본값 off) — [src/lib/auth.ts](../src/lib/auth.ts)

### Google 계정 자동 연결 정책
- `account.accountLinking.enabled = false`로 명시 비활성화. 같은 이메일이어도 credential 계정과 Google 계정을 자동으로 합치지 않음(검증되지 않은 이메일 기반 강제 연결 금지 원칙)

### 범위 결정: 비로그인 첫 화면(`/`)과 `/dashboard`를 공개
- 사용자 요청에 따라 비로그인 첫 화면 `/`는 로그인 폼이 아니라 비로그인 메인(`DemoConstellationGate`)을 보여주고, 로그인/회원가입 폼은 `/login`으로 분리했다(CLAUDE.md 4.2의 "`/`는 로그인 화면" 기본안에서 의도적으로 벗어난 결정). `/dashboard`도 비로그인 상태에서 접근 가능하다. 두 화면 모두 `DemoConstellationGate`라는 순수 장식용 컴포넌트만 렌더링하며 `getActivePlans()` 등 소유자 스코프 쿼리를 전혀 호출하지 않음 — 자료 노출 없이 화면만 공개
- `/plans`, `/tasks`, `/do`, `/see`, `/mypage`는 기존 원칙대로 미인증 시 무조건 redirect

## ④ 안 열리는 것을 확인한 기록

자동 테스트: [tests/auth-ownership.test.ts](../tests/auth-ownership.test.ts) — CLAUDE.md 9.1의 11개 시나리오 전부를 12개 `it()` 블록으로 커버, 2026-09-22 재실행 12/12 통과(`npm run test:auth`, 실서버 warm 상태). 전체 테스트(`npm run test`)는 11 파일 131개 전부 통과. 증거 스크립트: [scripts/t07-auth-evidence.ts](../scripts/t07-auth-evidence.ts)(`npm run t07:evidence`) 를 2026-09-22 현재 코드로 재실행해 09-18 최초 실행과 동일한 결과를 재확인했다 — 원본은 [docs/T07_EVIDENCE.md](./T07_EVIDENCE.md) 3부 참고. 아래는 그 실행에서 나온 성공/거절 쌍 요약표.

| # | 항목 | method/path | 계정 별칭 | status | 판정 |
|---|---|---|---|---|---|
| 1 | 회원가입 | `POST /api/auth/sign-up/email` | A, B | 200 | 각자 독립 계정 생성 확인 |
| 2 | 로그인 | `POST /api/auth/sign-in/email` | A, B | 200 | 정상 로그인 |
| 3 | 미인증 API 거절 | `GET /api/export` | (none) | **401** | `{"error":"Unauthorized"}` |
| 4 | 인증 후 자기 자료 조회 | `GET /api/export` | A · 로그인 | 200 | 본인 plan만 포함 |
| 5 | 로그아웃 | `POST /api/auth/sign-out` | A · 로그인 | 200 | 세션 삭제 |
| 6 | 로그아웃 뒤 이전 쿠키 재사용 | `GET /api/export` | A · 미인증(이전 쿠키) | **401** | 거절 확인 |
| 7 | 재로그인 후 재조회 | `GET /api/export` | A · 로그인 | 200 | 정상 재발급 세션으로 재조회 가능 |
| 8 | B 목록에 A 자료 포함 여부 | `GET /api/export` | B · 로그인 | 200 | B의 export에 plan id 35(B 소유)만, A의 34는 없음 |
| 9 | B→A 단건 읽기(페이지) | `GET /plans/34` | B · 로그인 | 200(바디 검사) | 응답 본문에 A 계획 제목 미포함 — Next.js 스트리밍 특성상 status는 200이지만 실제 A 데이터는 렌더되지 않음(본문 내용으로 판정) |
| 10 | B→A 단건 수정 화면 접근 | `GET /plans/34/edit` | B · 로그인 | 200(바디 검사) | 동일하게 본문에 A 데이터 없음 |
| 11 | 거절 전후 A 자료 건수 | (내부 DB count) | — | — | 시도 전 1건, 시도 후 1건, 변화 없음 |
| 12 | 조작된 헤더의 사용자 id 무시 | `GET /api/export` (`X-User-Id: <A의 id>` 헤더 위조) | B · 로그인 | 200 | 응답 `user.id`는 여전히 B — 헤더 값이 세션을 덮어쓰지 못함 |
| 13 | 조작된 hidden form field 무시 (Playwright) | plan 보관 폼 제출, `planId` hidden input을 A의 값으로 DOM 조작 후 제출 | B · 로그인(실브라우저) | — | 제출 후 A plan의 `deletedAt`이 여전히 null — Server Action이 제출된 값이 아니라 세션 기준 소유권으로 재검증함을 확인 (`tests/auth-ownership.test.ts` 6b) |
| 14 | 동일 비밀번호 해시 비교 | (DB 직접 조회) | A, B | — | 두 계정 모두 같은 원문 비밀번호를 썼지만 저장된 scrypt 해시가 서로 다름(salt 포함) |

- **비밀번호 원문**: 위 표의 모든 요청/응답 로그와 콘솔 출력 어디에도 원문 비밀번호가 등장하지 않음(`scripts/t07-auth-evidence.ts`는 비밀번호를 변수에만 보관하고 로그에는 절대 쓰지 않음; 값은 `T07_TEST_PASSWORD_A/B` 환경변수 또는 스크립트 자체 생성 임의값)
- **secret scan**: `git grep`로 API 키/시크릿 패턴(`sk-…`, `AIza…`, PEM 키 헤더 등) 검색 결과 tracked 파일에서 0건. `.env`/`.env.local`은 `.gitignore`로 커밋 제외, `.env.example`은 키 이름만 존재(값 없음)
- **`git diff --check`**: 공백/개행 오류 0건 (CRLF 관련 경고만 출력, 실제 오류 아님)

## ⑤ AI와 나

- **AI(Claude Code)에게 맡긴 일**: Better Auth 통합 코드 작성(`auth.ts`, `auth-schema.ts`, middleware, session 헬퍼), owner-scoped 쿼리 리팩터링, migration SQL 생성, 자동 테스트/증거 스크립트 작성, 문서 초안
- **사용자가 직접 판단한 일**: 브랜치/태그 전략, `/dashboard`를 공개 빈 화면으로 둘지 여부, Google/credential 계정 자동 연결 금지 여부, `user_id` NOT NULL 잠금을 마이그레이션 실행 이후로 미룰지, 실제 DB migration 실행 승인, 발견된 orphan 레코드를 "이전 대상 T06 데이터"로 볼지 "테스트 debris로 보고 삭제"할지의 최종 승인, Playwright를 실제 devDependency로 추가할지 승인
- **AI 제안을 따르지 않은 일**: 없음. 다만 AI가 최초에 orphan plan 1건을 T06 레거시 데이터로 잘못 보고했던 것을, 사용자가 "정확한 건수와 제목을 먼저 보여달라"고 요구해 재조사한 결과 테스트 debris임이 드러났고, 사용자는 그 정정된 분석(삭제 승인)을 그대로 채택함 — AI의 최초 오판을 사용자 요구로 잡아낸 사례

## ⑥ 아직 못 막은 것

- **로그인 무차별 대입 rate limit 미구현**: Better Auth 자체 rate limit 설정을 켜지 않음. 다음 조치: `betterAuth({ rateLimit: { enabled: true, ... } })` 옵션 또는 리버스 프록시/Vercel Edge Config 단에서 IP 기준 제한 추가 필요. 위험: 무차별 대입으로 약한 비밀번호 계정이 뚫릴 수 있음
- **이메일 인증/비밀번호 재설정 미구현**: 가입 시 이메일 소유권을 확인하지 않으며, "비밀번호를 잊었어요" 플로우가 없음(사용자와 협의 후 이번 범위에서 의도적으로 제외). 다음 조치: 이메일 발송 서비스(예: Resend) 연동 후 Better Auth의 `sendVerificationEmail`/`sendResetPassword` 콜백 구현. 위험: 실소유자가 아닌 사람이 오타 이메일로 가입 가능, 비밀번호 분실 시 계정 영구 접근 불가
- **2FA 미구현**: Better Auth의 2FA 플러그인을 사용하지 않음. 다음 조치: `twoFactor()` 플러그인 추가 및 UI 연동. 위험: 비밀번호 유출 시 단일 요인만으로 계정 탈취 가능
- **세션 이상 탐지/보안 감사 로그 미구현**: 비정상 IP/기기에서의 로그인, 반복 실패 등을 기록·경고하는 로직 없음. 다음 조치: 로그인 성공/실패 이벤트를 별도 audit 테이블에 적재하고 관리자 알림 연동. 위험: 계정 탈취 시도를 사후에도 추적하기 어려움

---

### 결과물 URL
- https://doitdiary.vercel.app/ (2026-09-22 확인: 200 응답, 비로그인 상태에서 "로그인하고 궤도 열기" 게이트만 노출되고 실제 사용자 자료는 응답 HTML에 없음, `/api/export`는 401)

### 소스 URL
- https://github.com/Lui-die-lui/doit_todo

### T06 → T07 조상 관계 확인
```
$ git merge-base --is-ancestor 82bce2e HEAD && echo IS_ANCESTOR_TRUE
IS_ANCESTOR_TRUE
$ git branch --show-current
main
$ git rev-parse HEAD
09fd0938f97da3b85f37d5c59c61f8b092cbf6f4
```
T06 최종 커밋: `82bce2e`(`82bce2e9f456602e3694877842111d2ebd6b15e8`, "Swap favicon for the rounded-square artwork") — 별도 브랜치가 아니라 `main` 브랜치 HEAD(`09fd093`)의 조상임을 확인함. `origin/main`도 동일 커밋을 가리켜(push 완료 상태) 로컬/원격 이력이 일치한다.

### 4줄 확인 방법
1. 제출 URL로 이동하면 비로그인 메인(`/`, 자료가 없는 장식용 별자리 + "로그인하고 궤도 열기" 버튼)이 시크릿 창에서도 바로 보인다.
2. "로그인하고 궤도 열기"를 눌러 `/login`으로 간 뒤 이메일/비밀번호를 입력하고 "로그인" 또는 "회원가입" → "로그인"을 누른다(3단계 이내: 버튼 클릭 → 폼 입력 → 제출).
3. **통과**: `/dashboard`로 이동하며 본인 계획/할 일이 보이고, 로그인 없이 `/plans`·`/tasks`·`/do`·`/see`·`/mypage`에 직접 접근하면 `/login`으로 돌아온다.
4. **실패**: 로그인 후에도 `/`나 `/login`에 머물거나 오류가 뜨는 경우, 또는 로그인 없이 위 자료 화면들이 그대로 보이는 경우.

### AI와 내 판단 3줄
1. 인증 라이브러리 선정과 소유권 검사 설계는 AI가 CLAUDE.md 원칙에 맞춰 제안했고, 최종 채택 여부(NOT NULL 잠금 시점, `/dashboard` 공개 범위, 비로그인 첫 화면을 `/login`과 분리할지 등)는 사용자가 결정했다.
2. 실제 DB에 영향을 주는 모든 작업(마이그레이션 실행, orphan 데이터 삭제, Playwright 의존성 추가)은 AI가 먼저 조사 결과를 보고하고 사용자 승인을 받은 뒤에만 실행했다. 5일간의 실제 사용(계획 작성, 할 일 실행, 회고)과 계획 규칙 변경 여부는 전적으로 사용자가 직접 수행했다.
3. AI가 최초 보고에서 orphan 데이터의 정체를 잘못 판단했던 것을 사용자가 재확인을 요구해 바로잡았다. 이번 제출 문서 정리 과정에서도 AI는 "2~3일차 사이 계획 규칙 변경"을 찾기 위해 Git 이력을 직접 대조했고, 그럴듯한 후보(`dc13491`의 "하루 총 투입 시간" 변경)가 있었지만 시각·실사용 반영 여부를 엄격히 따진 끝에 조건을 만족하지 않는다고 결론 내렸다 — 있었으면 하는 사실을 만들어내지 않고 실제 상태를 그대로 보고한 사례다.

### 5일 실제 기록 표와 규칙 변경 전후 비교
- **실제 5일 사용 기록: 통과.** Asia/Seoul 기준 서로 다른 실제 날짜 5개(2026-09-18~09-22)에 각각 실행 기록(work log)이 존재하며, 각 날짜와 Git commit 이력을 대조한 전체 표는 [docs/T07_EVIDENCE.md](./T07_EVIDENCE.md) 1부에 있다.
- **1일차 지표 사전 고정: 미충족.** 질문/지표/단위/계산 규칙을 1일차 이전에 명시적으로 고정 선언한 기록이 없다(코드의 계산식 자체는 5일 내내 동일하게 쓰였다는 것은 확인됨). 자세한 내용은 [docs/T07_EVIDENCE.md](./T07_EVIDENCE.md) 2-1.
- **2~3일차 사이 규칙 변경: 미충족.** 해당 시간대(2일차 마지막 기록~3일차 첫 기록)의 commit을 전수 조사했으나, 조건(계획 규칙 변경 + 그 시간대 + 1·2일차 근거)을 모두 만족하는 commit을 찾지 못했다. 조사 과정과 후보 commit 전체는 [docs/T07_EVIDENCE.md](./T07_EVIDENCE.md) 2-2 참고.

### 화면 합계·평균과 손계산 대조
- **통과.** 실제 SEE 화면 스크린샷 대조는 실사용자 로그인 자격 증명이 없어 수행하지 못했지만, 그 화면이 호출하는 것과 동일한 함수(`computeRetroAggregation`)를 동일한 DB 값으로 직접 실행한 결과와 순수 손계산이 정확히 일치함을 확인했다(estimated 1650분 / actual 1098분 / diff -552분, blockedCount 4건 — 전부 일치). 5일 실행 기록의 날짜별 합계·평균(합계 1098분, 평균 220분/일, 반올림 전 219.6)도 함께 검산했다. 표와 계산 과정 전체는 [docs/T07_EVIDENCE.md](./T07_EVIDENCE.md) 2-3.

### 내보내기 파일 예시(비밀정보 없음)
```json
{
  "schemaVersion": "2.0.0",
  "exportedAt": "2026-09-22T01:33:33.629Z",
  "user": { "id": "OFxZooYOwAoDphsMS0lMEKHypHFdoRZT", "name": "T07 Evidence A", "email": "t07-evidence-a-…@example.com" },
  "plans": [ { "id": 150, "userId": "OFxZooYOwAoDphsMS0lMEKHypHFdoRZT", "title": "T07 evidence plan A", "...": "..." } ],
  "planRevisions": [],
  "tasks": [],
  "workLogs": [],
  "completionEvents": [],
  "reflections": []
}
```
(위는 `scripts/t07-auth-evidence.ts`를 2026-09-22 현재 코드로 재실행해 생성된 임시 증거 계정의 실제 export 응답이며, 해당 계정/자료는 스크립트 종료 시 자동 정리됨. password hash, session token, OAuth token 등 secret 필드는 export 스키마 자체에 존재하지 않음.)
