# Doit / 플랜두씨 다이어리 2 — T07 인증 구현 지침

## 0. 역할과 최우선 원칙

이 저장소는 T06에서 만든 Doit(플랜두씨 다이어리)에 인증과 사용자별 데이터 격리를 추가하는 T07 작업이다.

작업 시작 직후 코드를 수정하지 말고 먼저 저장소 전체를 조사한다. 실제 파일 구조, `package.json`, lockfile, Drizzle 스키마와 마이그레이션, API/Server Action, 배포 환경을 확인한 뒤 아래 계획을 현재 코드에 맞게 조정한다. 문서에 적힌 예시 경로를 실제 존재하는 경로처럼 가정하지 않는다.

반드시 지킬 원칙:

- 기존 T06 기능과 디자인을 보존한다.
- T06 최종 커밋을 확인하고 T07 브랜치의 조상인지 검증한다.
- 인증 여부는 UI가 아니라 서버에서 검사한다.
- 사용자 ID는 요청의 URL, 헤더, 본문에서 믿지 않고 검증된 서버 세션에서만 얻는다.
- 모든 읽기·수정·삭제·목록·내보내기·계정 삭제는 서버에서 소유권을 확인한다.
- 비밀번호, 세션 토큰, OAuth 토큰, client secret, DB 비밀키를 출력·로그·문서·Git에 남기지 않는다.
- `.env*`와 실제 증거 파일을 커밋하지 않는다. `.env.example`에는 키 이름과 설명만 둔다.
- 실제 5일 기록을 임의 생성하거나 과거 날짜로 꾸미지 않는다. 기능과 양식은 만들되 실제 기록은 사용자가 직접 쌓는다.
- 큰 변경 전에 현재 동작을 확인하고, 변경 후 lint/typecheck/test/build를 실행한다.
- 모호하거나 위험한 마이그레이션은 추측해 실행하지 말고 사용자에게 확인한다.

## 1. 목표

다음을 모두 만족하는 것이 목표다.

1. 이메일/비밀번호 회원가입, 로그인, 로그아웃
2. Google OAuth 로그인
3. 첫 화면 `/`은 공개 로그인 화면
4. 로그인하지 않은 사용자가 자료 화면 또는 자료 API를 열면 자료가 노출되지 않음
5. T06 기존 자료를 지정한 실제 사용자 계정으로 이전
6. 사용자별 자료 완전 격리
7. DB 기반 세션과 로그아웃/비밀번호 변경 후 세션 폐기
8. 자료 전체 JSON 내보내기
9. 계정 삭제 및 소유 자료의 연쇄 삭제 또는 명확한 삭제 정책
10. 재현 가능한 보안 확인 기록과 T07 제출 문서
11. Asia/Seoul 기준 실제 5일 기록과 2일차 뒤·3일차 전 규칙 변경 기록

## 2. 기술 선택

### 채택

- 인증 라이브러리: Better Auth `1.7.5`를 우선 사용한다. 설치 후 lockfile에 고정된 실제 버전을 `npm ls better-auth` 등으로 확인하고 제출 문서에는 그 실제 버전을 기록한다.
- DB 연결: 기존 Drizzle ORM과 기존 PostgreSQL/Supabase DB를 재사용한다.
- 어댑터: Better Auth Drizzle adapter
- 로그인 방식: 이메일/비밀번호 + Google OAuth
- 비밀번호 저장: Better Auth 기본 `scrypt`
- 로그인 상태: DB에 저장되는 불투명 세션 토큰을 `HttpOnly`, `Secure`(production), `SameSite` 쿠키로 전달
- 세션 만료: 명시적으로 설정하고 제출 문서에 정확한 시간을 기록한다. 기본안은 7일이며, 실제 설정값을 문서화한다.

### 선택 이유

- 현재 Next.js + Drizzle + PostgreSQL 구조에 직접 연결할 수 있다.
- 이메일/비밀번호와 Google OAuth를 한 인증 계층에서 함께 제공한다.
- 기본 비밀번호 해시가 과제 허용 방식인 scrypt이며 salt가 포함되어 같은 비밀번호도 다른 저장값이 된다.
- 서버 DB 세션을 사용하므로 로그아웃 시 세션을 서버에서 폐기하고 동일 세션 값의 재사용을 거절하는 증거를 만들 수 있다.
- 직접 JWT/비밀번호 인증을 만드는 것보다 구현 실수와 검증 범위를 줄일 수 있다.

### 검토했지만 채택하지 않은 방법

- Auth.js Credentials + Google: Google OAuth는 편하지만 Credentials 계정 저장과 비밀번호 정책을 직접 구현해야 하고, JWT 세션을 선택하면 로그아웃 후 탈취된 예전 토큰의 즉시 폐기를 증명하기 까다롭다.
- Supabase Auth: 현재 DB와 가깝지만 기존 Drizzle 서버 로직과 RLS/세션 책임을 동시에 재설계해야 하며, 과제에서 요구하는 비밀번호 해시와 세션 폐기 증거를 앱 코드·DB 기준으로 설명하기가 더 복잡하다.
- 완전 직접 구현: 교육적이지만 비밀번호, 쿠키, 세션 회전, OAuth state/PKCE를 직접 다루는 위험이 불필요하게 크다.

현재 저장소에 이미 정상 동작하는 인증 기반이 있다면 무조건 교체하지 말고, 요구사항 충족 여부와 교체 비용을 먼저 보고한다.

## 3. 작업 시작 시 조사할 내용

아래를 읽고 결과를 짧게 보고한 뒤 구현 계획을 제시한다.

- `package.json`과 lockfile: Next.js, React, Drizzle, DB 드라이버, 기존 인증 패키지 버전
- 디렉터리 구조: App Router/Pages Router 여부, route handler, server action, middleware/proxy
- DB 연결 모듈과 Drizzle schema/migrations
- `doit_plans`, `doit_tasks`, `doit_work_logs`의 관계, FK, 삭제 정책
- 모든 자료 조회/생성/수정/삭제 경로
- 현재 첫 화면과 자료 화면 경로
- 현재 환경변수 이름과 배포 대상(Vercel 등)
- T06 최종 커밋 SHA와 현재 브랜치에서의 조상 여부
- 기존 데이터 수와 고아 레코드 여부

조사 뒤 반드시 `현재 구조 요약 → 변경할 파일 → DB 마이그레이션 → 테스트 계획 → 위험 요소` 순서로 계획을 제시한다.

## 4. 인증 구현 요구사항

### 4.1 Better Auth 서버

실제 구조에 맞는 서버 전용 파일에 Better Auth 인스턴스를 둔다.

- 기존 Drizzle DB 인스턴스를 사용한다.
- PostgreSQL provider를 사용한다.
- `emailAndPassword.enabled = true`
- Google social provider를 환경변수로 구성한다.
- DB-backed session을 유지한다. stateless session으로 바꾸지 않는다.
- 세션 만료와 갱신 시간을 코드에서 명시한다.
- 비밀번호 재설정 기능을 구현한다면 `revokeSessionsOnPasswordReset: true`를 사용한다.
- 비밀번호 변경 UI/API는 다른 세션을 폐기하도록 `revokeOtherSessions: true`를 사용한다.
- production에서 secure cookie가 적용되는지 확인한다.
- OAuth scope는 로그인에 필요한 최소 범위만 요청한다. Drive/Gmail/Calendar 권한은 요청하지 않는다.

Next.js App Router라면 기본 인증 handler는 `/api/auth/[...all]` 계열을 사용하되, 현재 구조에 맞춰 실제 경로를 결정한다.

### 4.2 인증 화면

- `/`는 로그인 화면이어야 하며 시크릿 창에서도 공개되어야 한다.
- 이메일/비밀번호 로그인 폼
- 회원가입 화면 또는 명확한 회원가입 전환
- Google로 계속하기 버튼
- 로그인 실패 시 존재하지 않는 이메일과 틀린 비밀번호 모두 같은 일반 문구를 표시한다. 예: `이메일 또는 비밀번호가 올바르지 않습니다.`
- 중복 이메일 가입은 새 계정을 만들지 않는다. 사용자 열거 위험을 고려해 화면 문구는 과도한 정보를 노출하지 않는다.
- 비밀번호 input은 `type="password"`; 비밀번호 값은 오류 메시지, URL, 로그에 넣지 않는다.
- 로그아웃 후 `/`로 이동한다.

### 4.3 보호 경로

- 자료 화면의 server component/layout에서 세션을 검사한다.
- 미인증 브라우저 페이지 요청은 로그인 화면으로 redirect한다.
- API는 redirect HTML 대신 일관된 JSON `401 Unauthorized`를 반환한다.
- 인증 화면만 막고 API를 열어두는 실수를 하지 않는다.
- middleware만 믿지 않는다. 실제 자료 접근 함수/route/server action 안에서도 세션을 확인한다.

## 5. 사용자별 데이터 격리

### 5.1 소유권 모델

정규화된 기본안은 `doit_plans.user_id -> auth user.id`를 소유권의 기준으로 두는 것이다. `doit_tasks`는 `plan_id`, `doit_work_logs`는 `task_id`를 통해 소유자를 확인한다. 현재 API 구조 때문에 각 테이블에 `user_id`를 중복 저장하려면, 불일치 방지 제약과 이유를 먼저 제시하고 승인받는다.

- 계획: 항상 `plan.user_id = session.user.id`
- 작업: task와 plan을 join해 `plan.user_id = session.user.id`
- 작업 로그: work_log → task → plan을 join해 같은 소유권 확인
- 생성 시 request body의 `userId`, `ownerId`, `email`은 무시하거나 validation에서 거절한다.
- 목록 조회에도 소유자 조건을 반드시 넣는다.
- 한 건 조회·수정·삭제는 다른 사용자의 존재를 숨기기 위해 `404`를 우선 사용한다. 프로젝트 전반에서 일관되게 적용하고 문서에 적는다.
- 소유권 확인 전에 update/delete를 수행하지 않는다.
- 트랜잭션이 필요한 변경은 한 트랜잭션에서 검증 후 처리한다.
- FK와 cascade 정책을 명시한다.

가능하면 DB 레벨 방어도 추가한다. Supabase RLS를 사용할 경우 서버의 실제 접속 역할이 RLS를 우회하는지 확인하고, RLS가 있다고 애플리케이션 소유권 검사를 생략하지 않는다.

### 5.2 기존 T06 자료 이전

기존 자료를 임의 사용자에게 연결하지 않는다.

1. auth schema를 먼저 적용한다.
2. 사용자가 실제 계정을 만든다.
3. DB에서 해당 계정의 정확한 user ID를 확인한다.
4. 기존 T06 plan 개수와 연결된 task/log 개수를 출력한다.
5. 사용자에게 대상 이메일과 건수를 보여주고 확인받는다.
6. 한 번만 실행되는 명시적 migration/backfill로 기존 plan의 `user_id`를 채운다.
7. 고아 레코드가 없음을 확인한다.
8. 가능하면 `user_id`를 NOT NULL로 바꾼다.
9. 이전 전후 건수와 migration 파일 위치를 기록한다.

실행 전 백업 또는 되돌리기 SQL을 준비한다. 계정 생성 전 임시 ID를 만들거나 이메일 문자열을 소유권 키로 사용하지 않는다.

## 6. Google OAuth 준비와 구현

필요 환경변수 예시:

```dotenv
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
DATABASE_URL=
```

`.env.example`에는 빈 값만 둔다. 실제 값은 로컬 `.env.local`과 배포 서비스의 암호화된 환경변수에만 저장한다.

Google Cloud Console 설정:

1. 프로젝트 생성 또는 기존 프로젝트 선택
2. Google Auth Platform/OAuth 동의 화면 구성
3. 앱 이름, 지원 이메일, 개발자 연락처 설정
4. 테스트 상태라면 실제 로그인할 Google 계정을 Test users에 추가
5. OAuth Client ID 생성 → Application type: Web application
6. Authorized JavaScript origins 등록
   - `http://localhost:3000`
   - 실제 production origin, 예: `https://your-domain.vercel.app`
7. Authorized redirect URIs 등록
   - `http://localhost:3000/api/auth/callback/google`
   - `https://your-domain.vercel.app/api/auth/callback/google`
8. Client ID/Secret을 환경변수에 저장
9. production의 `BETTER_AUTH_URL`은 정확한 production origin으로 설정

Vercel preview URL은 매 배포마다 달라질 수 있으므로 Google redirect URI에 무작정 와일드카드를 기대하지 않는다. 제출용 고정 production 도메인을 기준으로 설정한다.

같은 이메일의 credential 계정과 Google 계정을 자동 연결할지 여부는 Better Auth 공식 동작과 보안 조건을 확인한 뒤 결정한다. 검증되지 않은 이메일 기반 강제 연결은 금지한다. 결정과 이유를 제출 문서에 기록한다.

## 7. 내보내기와 계정 삭제

### 내보내기

- 인증된 사용자 자신의 user/profile, plans, tasks, work logs, 규칙 변경 기록만 JSON 파일 하나로 내보낸다.
- password hash, session token, OAuth access/refresh token, provider secret은 절대 포함하지 않는다.
- 파일에 schema version과 export timestamp(Asia/Seoul 또는 UTC를 명시)를 포함한다.

### 계정 삭제

- 최근 인증 또는 비밀번호 재확인 같은 안전장치를 가능한 범위에서 둔다.
- 삭제 전 어떤 자료가 지워지는지 화면에 명시한다.
- 사용자 소유 plan/task/log/규칙 변경 기록과 인증 account/session을 함께 삭제한다.
- FK cascade 또는 명시적 transaction 중 실제 선택을 문서화한다.
- Google 계정 자체를 삭제하는 것이 아니라 이 앱의 연결 및 앱 데이터를 삭제한다는 점을 표시한다.

## 8. 5일 기록과 규칙 변경

실제 사용자 기록만 사용한다. 테스트/증거 계정의 데이터와 실제 사용 계정의 데이터를 섞지 않는다.

1일차 시작 전에 앱 안에 다음을 고정해 저장하거나 명확히 표시한다.

- 질문 한 문장
- 관찰 지표 한 개
- 단위
- 계산 규칙
- 누락값 처리
- 중복값 처리
- 이상치 처리
- 반올림 규칙
- 주 시작 요일
- 최초 계획 규칙

권장 예시:

- 질문: `하루 계획 시간을 현실적으로 줄이면 계획 대비 실제 수행률이 높아지는가?`
- 지표: 계획 대비 실제 수행률
- 단위: `%`
- 계산: `완료한 작업의 예상 시간 합 ÷ 그날 계획한 작업의 예상 시간 합 × 100`
- 누락: 예상 시간이 없는 작업은 지표 계산에서 제외하고 제외 건수를 따로 표시
- 중복: 같은 작업의 중복 로그는 task 기준 실제 수행시간을 합산하되 완료 작업은 한 번만 계산
- 이상치: 300% 초과 값도 원본은 유지하고 비교 화면에서 별도 표시
- 반올림: 소수 첫째 자리
- 주 시작: 월요일

2일차 기록 완료 뒤, 3일차 기록 시작 전에 규칙 하나만 바꾼다. 변경 시각(Asia/Seoul), 이유, 참조하는 1·2일차 기록 ID, 변경 전/후 문장을 저장한다. 예: `하루 계획 총량을 180분 이하로 제한한다.`

규칙 변경 전후 비교는 동일한 지표·단위·계산식으로 한다. 합계와 평균은 서버 계산값, 화면값, 손계산값이 일치해야 한다.

## 9. 자동 테스트와 수동 증거 수집

### 9.1 자동 테스트

현재 프로젝트의 테스트 도구를 우선 재사용한다. 없다면 최소 범위로 추가한다.

필수 테스트:

- 중복 이메일 가입 방지
- 존재하지 않는 이메일과 틀린 비밀번호의 사용자 표시 문구 동일
- 미인증 API 401
- A/B 계정 목록 격리
- A→B 및 B→A의 읽기·수정·삭제 404 또는 403
- 다른 사용자의 ID/email/userId를 URL·헤더·본문에 넣어도 권한 상승 불가
- 거절 전후 대상 계정 자료 건수 불변
- 로그아웃 뒤 같은 세션 토큰으로 같은 endpoint 요청 시 거절
- 비밀번호 변경 뒤 이전 세션 폐기
- export에 타 사용자 자료와 secret 없음
- 계정 삭제 시 소유 자료 삭제 정책 동작

### 9.2 증거 생성 스크립트

가능하면 `scripts/t07-auth-evidence.*`를 만든다.

- 테스트 계정 A/B의 이메일과 비밀번호는 환경변수에서만 읽는다.
- 스크립트/명령 기록에 실제 비밀번호를 쓰지 않는다.
- cookie jar는 임시 디렉터리에 만들고 커밋하지 않는다.
- 출력에는 시간, method, URL path, 로그인 상태/계정 별칭, status code, 비밀 제거된 response body만 남긴다.
- Cookie/Authorization 값은 `eyJhb…생략`, `session=abc…생략` 형태로 가린다.
- 성공 요청과 실패 요청을 같은 endpoint/method 기준으로 나란히 기록한다.
- 테스트가 끝나면 임시 계정/자료 정리 여부를 명확히 보고한다. 실제 사용자 자료는 건드리지 않는다.

필수 증거 묶음:

1. 로그인 상태 성공 vs 로그아웃 뒤 동일 요청 거절
2. 미인증 직접 자료 요청 거절
3. A→B 읽기·수정·삭제 거절
4. B→A 읽기·수정·삭제 거절
5. A/B 목록에 상대 자료 0건
6. 조작된 URL/헤더/본문의 사용자 값 무시
7. 거절 전후 대상 자료 건수 동일
8. 같은 비밀번호를 쓴 두 credential 계정의 hash 값이 서로 다름
9. 요청/응답/서버 로그에 비밀번호 원문 없음
10. Git tracked 파일과 production client bundle에 secret 없음

DB hash 증거는 test 계정 두 개만 사용하고 일부만 표시한다. 실제 비밀번호는 문서에 쓰지 않는다.

## 10. 제출 문서

`docs/T07_AUTH_IMPLEMENTATION.md`를 만들고 다음 여섯 항목을 정확히 분리한다.

### ① 무엇으로 붙였나

- 라이브러리/서비스 이름과 lockfile 기준 실제 버전
- 이메일/비밀번호, Google OAuth
- scrypt
- DB 세션과 만료 시간

### ② 왜 그걸 골랐나

- 현재 스택과의 적합성
- 직접 구현 대비 위험 감소
- 검토했지만 선택하지 않은 Auth.js/Supabase Auth/직접 구현 중 최소 하나와 이유

### ③ 어디를 어떻게 고쳤나

- 회원가입 흐름의 실제 파일/함수/route
- 로그인 흐름
- 로그아웃 흐름
- 자료 조회 흐름
- DB schema/migration
- 모든 자료 route별 세션·소유권 검사 위치
- T06 데이터 이전 위치와 결과

### ④ 안 열리는 것을 확인한 기록

- 위 증거 묶음의 요청과 응답을 성공/거절 쌍으로 표로 정리
- method, path, 계정 별칭, status, 비밀 제거 응답, 검증 결과
- 양방향 CRUD와 목록 격리
- 로그아웃 전후 동일 endpoint/method 비교
- 비밀번호 hash/salt 차이
- secret scan 결과

### ⑤ AI와 나

- AI에게 맡긴 일
- 사용자가 직접 판단한 일
- AI 제안을 따르지 않은 일과 이유. 없으면 왜 그대로 채택했는지 사실대로 기록

### ⑥ 아직 못 막은 것

비워 두지 않는다. 실제 미구현 항목만 쓴다. 우선 후보:

- 로그인 무차별 대입 rate limit 미구현
- 이메일 인증/비밀번호 재설정 미구현
- 2FA 미구현
- 세션 이상 탐지/보안 감사 로그 미구현

각 항목은 위험과 다음 조치를 함께 적는다. 구현한 것을 미구현이라고 쓰지 않는다.

문서 끝에 다음도 포함한다.

- 결과물 URL
- 소스 URL
- T06 최종 커밋 SHA와 T07 HEAD에서 조상임을 확인한 명령/결과
- 4줄 확인 방법: 어디로 가는지 / 3단계 이내 행동 / 통과 표시 / 실패 표시
- AI와 내 판단 3줄
- 5일 실제 기록 표와 규칙 변경 전후 비교
- 화면 합계·평균과 손계산 대조
- 내보내기 파일 예시(비밀정보 없음)

`docs/T07_EVIDENCE.md`에는 비밀이 제거된 원시 요청/응답 기록을 둔다. 실제 비밀번호·토큰·secret은 어떤 문서에도 넣지 않는다.

## 11. 상태 코드와 오류 정책

- 미인증: API `401`
- 인증됐지만 타인 자료: 존재 은폐 목적의 `404` 권장
- validation 실패: `400` 또는 `422`, 프로젝트 전반에서 통일
- 중복 가입: 계정은 생성하지 않는다. 응답 정책과 UI 문구를 문서화한다.
- 로그인 실패: 존재하지 않는 계정과 틀린 비밀번호를 동일 문구/유사 처리 시간으로 다룬다.
- 서버 오류 응답에 stack, SQL, 환경변수, provider token을 노출하지 않는다.

## 12. 완료 전 검사

다음이 모두 통과하기 전에는 완료라고 말하지 않는다.

- 회원가입/로그인/Google 로그인/로그아웃 수동 확인
- 미인증 화면 redirect 및 API 401
- 양방향 읽기·수정·삭제 거절
- 목록 격리
- 로그아웃 후 예전 세션 거절
- 비밀번호 변경 후 이전 세션 거절
- 동일 비밀번호의 서로 다른 scrypt hash 확인
- T06 데이터 이전 건수 확인
- export와 계정 삭제 확인
- lint
- typecheck
- test
- production build
- secret scan
- `git diff --check`
- 제출 URL을 시크릿 창에서 열어 로그인 화면까지 공개됨 확인
- Google production redirect 동작 확인

5일 실제 사용은 시간이 지나야 충족된다. 코드 구현이 끝났더라도 실제 5개 날짜와 규칙 변경 시점이 없으면 `구현 완료 / 과제 완주 대기`로 구분해 보고한다.

## 13. 작업 방식

1. 조사 결과와 계획을 먼저 보고한다.
2. 작은 단계로 구현한다: schema → auth server → auth UI → route protection → ownership → migration → export/delete → tests/evidence → docs.
3. 단계마다 관련 테스트를 실행한다.
4. 기존 사용자 변경과 충돌하면 덮어쓰지 않는다.
5. DB migration, 기존 자료 귀속, production 환경변수 입력처럼 사용자 결정/권한이 필요한 지점에서는 멈추고 정확히 필요한 행동만 요청한다.
6. 완료 보고에는 변경 파일, migration, 테스트 결과, 남은 수동 작업, 알려진 제한을 적는다.

## 14. 이번 작업에서 하지 않을 것

- 인증과 무관한 대규모 UI 재설계
- 기존 T06 자료 삭제/초기화
- 클라이언트 localStorage를 인증 또는 권한의 근거로 사용
- user ID를 클라이언트가 자유롭게 지정하게 두기
- 자체 암호화/해시 알고리즘 제작
- 토큰을 URL query string에 전달
- OAuth client secret에 `NEXT_PUBLIC_` 접두사 사용
- service role key를 브라우저 bundle에 포함
- 실제 5일 데이터를 AI가 대신 생성
- 증거를 만들기 위해 production 사용자 데이터를 위험하게 조작

