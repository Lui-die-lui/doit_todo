# DO:IT — Plan → Do → See 다이어리

로그인 없이 링크만 알면 누구나 보고 사용할 수 있는 공개 Plan → Do → See 다이어리입니다.
계획(Plan) → 실행 기록(Do) → 돌아보기(See) → 개선점을 다음 계획으로 이어가는 흐름이 서버 DB(Postgres/Supabase)에서 이어집니다.

이번 과제 범위에는 로그인, 회원가입, OAuth, 비밀번호, 관리자 인증, 사용자별 데이터 분리가 포함되지 않습니다.

## 기술 스택

- Next.js App Router (TypeScript)
- Drizzle ORM + PostgreSQL (Supabase)
- Tailwind CSS
- 모든 DB 읽기/쓰기는 Server Action 또는 Route Handler를 통해서만 수행

## 폴더 구조 요약

- `src/db/schema.ts` — Drizzle 스키마 (테이블은 모두 `doit_` 접두사를 사용합니다. 하나의 Supabase 프로젝트를 여러 과제가 공유하기 때문입니다)
- `drizzle/` — 생성된 SQL 마이그레이션
- `src/lib/` — 검증(zod), 날짜/서울 시간대 규칙, 집계, 완료 중복 방지 로직, 서버 액션
- `src/app/` — 화면 (홈, 계획, 할 일, 실행 기록, 돌아보기)
- `contracts/pds-schema-v2.json` — 최종 DB 구조와 데이터 규칙 계약 문서
- `tests/` — 집계/지연 계산/완료 중복 방지에 대한 자동 테스트 (vitest)
- `scripts/migrate.ts`, `scripts/seed.ts` — 마이그레이션 적용, 실제 계획 시드

## 환경변수

`.env.example`을 참고해 `.env` 파일을 만드세요. `.env`는 git에 커밋되지 않습니다.

```
SUPABASE_URL=                 # (참고용, 이 앱의 DB 접근에는 사용하지 않음)
SUPABASE_SECRET_KEY=          # (참고용, 이 앱의 DB 접근에는 사용하지 않음)
SUPABASE_CONNECTION_KEY=      # Drizzle이 사용하는 Postgres 연결 문자열 (서버 전용, 필수)
```

`SUPABASE_CONNECTION_KEY`는 Supabase 대시보드 → Project Settings → Database → Connection String → URI에서 복사합니다.
Vercel 배포 시에는 "Transaction pooler"(포트 6543) 연결 문자열을 권장합니다.

이 값은 서버 전용 환경변수입니다. `NEXT_PUBLIC_` 접두사를 붙이지 마세요.

## 로컬 실행

```bash
npm install
npm run db:migrate   # 마이그레이션 적용 (SUPABASE_CONNECTION_KEY 필요)
npm run db:seed      # 실제 계획 1건 + 할 일 6건 시드 (이미 있으면 건너뜀)
npm run dev
```

## 검증 명령

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## 제출 전 체크리스트 (README 상의 필수 확인 사항)

- [ ] **실제 실행 기록 3건 이상을 직접 입력했는가** — 시드 데이터에는 실행 기록이 포함되어 있지 않습니다(가짜 실행 기록을 넣지 않기 위함). `/do` 화면에서 실제로 공부/작업한 시작·종료 시각을 최소 3건 입력한 뒤 제출하세요.
- [ ] 계획 1개 이상, 해당 계획의 할 일 5개 이상 존재 (시드 스크립트로 충족됨)
- [ ] 돌아보기(`/see`) 숫자가 모두 0이 아님 (실행 기록을 입력하고 할 일을 최소 1건 완료 처리하면 충족됩니다)
- [ ] 새로고침 후에도 동일한 값이 유지되는지 확인 (서버 DB 기반이므로 자동으로 충족)
- [ ] 시크릿(비공개) 브라우저 창에서 로그인 없이 배포 주소 접근 확인
- [ ] `/api/export`로 전체 데이터 JSON 내보내기 확인

## XSS 안전성 테스트 방법

1. 계획 설명, 할 일 설명, 실행 기록의 "막힌 이유", 돌아보기 요약/개선점 등 아무 텍스트 입력란에 다음 문자열을 그대로 입력하고 저장합니다.

   ```
   <script>alert('xss')</script>
   ```

2. 저장 후 해당 화면(계획 상세, 할 일 상세, 돌아보기 등)을 새로고침해서 다시 엽니다.
3. **통과 기준**: 화면에 문자 그대로 `<script>alert('xss')</script>` 텍스트가 보여야 하고, alert 팝업이 뜨면 안 됩니다.
   - 이 앱은 React의 기본 텍스트 렌더링만 사용하며 `dangerouslySetInnerHTML`을 어디에도 사용하지 않으므로, 입력값은 항상 이스케이프되어 문자 그대로 출력됩니다.

## 비밀값 노출 점검 방법

- 배포된 페이지에서 브라우저 개발자 도구 → Network 탭으로 아무 요청의 응답 본문을 확인해도 `SUPABASE_CONNECTION_KEY`, `SUPABASE_SECRET_KEY` 값이 보이지 않아야 합니다.
- 페이지 소스 보기(View Source) 및 번들된 JS 파일에서 위 값들을 검색해도 나오지 않아야 합니다.
- `git log -p -- .env` 등으로 `.env` 파일이 커밋 이력에 없는지 확인하세요 (`.gitignore`에 등록되어 있습니다).
- `/api/export` 응답 JSON에도 위 값들이 포함되지 않습니다 (plans/tasks/workLogs 등 데이터 테이블만 포함).

## 기본 정렬 규칙 (할 일 화면)

화면에도 동일하게 표시됩니다.

> 기본 정렬: 미완료 먼저 → 우선순위(높음→보통→낮음) → 마감일 빠른 순 → 등록 빠른 순 → ID 오름차순

## 서울 시간대 규칙

- 모든 시각(timestamptz)은 DB에 UTC로 저장되고, 화면에는 `Asia/Seoul` 기준으로 변환되어 표시됩니다.
- 지연 여부는 `삭제되지 않음 AND status != DONE AND dueDate < 서울 기준 오늘`로 계산합니다. 완료된 할 일은 마감일이 지났어도 지연으로 집계되지 않습니다.

## 완료 중복 방지

완료 버튼을 연속으로 눌러도 `completion_events` 테이블의 UNIQUE 제약(`idempotency_key`, `task_id`+`completion_cycle`)과 트랜잭션 내 행 잠금(`SELECT ... FOR UPDATE`)에 의해 완료 이벤트와 완료 집계가 정확히 한 번만 증가합니다. 자세한 내용은 `contracts/pds-schema-v2.json`의 `completionDedupRule`과 `src/lib/actions/completion.ts`, `tests/completion-logic.test.ts`를 참고하세요.
