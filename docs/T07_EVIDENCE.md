# T07 증거 기록 (비밀 제거됨)

`scripts/t07-auth-evidence.ts` (`npm run t07:evidence`) 실행 원본 로그. 계정 A/B는 스크립트가 실행 시점에 생성한 임시 계정이며, 스크립트 종료 시 자동 삭제된다. 비밀번호 원문은 어떤 줄에도 남기지 않는다. 쿠키는 앞 6자만 보이고 나머지는 `…생략`으로 마스킹된다.

가장 최근 실행 시각(UTC): `2026-09-18T12:52:41.517Z` / BASE: `http://localhost:3000`

## 실행 요약

```
계정 A: t07-evidence-a-1789735958741@example.com (이번 실행용 임시 생성)
계정 B: t07-evidence-b-1789735958741@example.com (이번 실행용 임시 생성)
비밀번호는 어떤 로그·출력에도 원문으로 남기지 않습니다.
```

## 8) 같은 비밀번호를 쓴 두 계정의 해시가 다른지

```
A 해시 일부: 3e460e8ddc56cfab92dc33dc…
B 해시 일부: 8a2ec59dcf45a2ce6b0e9a66…
서로 다름: true
```

## 5) A/B 목록에 상대 자료 0건

```
A의 export에 B 계획 포함: false
B의 export에 A 계획 포함: false
```

## 3/4/7) B→A 읽기·수정 화면 거절, 거절 전후 A 자료 건수

```
/plans/34 응답 status: 200 (스트리밍 특성상 200이어도 무방 -- 아래 내용 검사가 실제 판정)
응답 본문에 A 계획 제목 포함 여부: false (false여야 정상)
/plans/34/edit 응답 status: 200
시도 전 A 계획 수: 1, 시도 후: 1, 변화 없음: true
```

Next.js App Router는 중첩 서버 컴포넌트에서 `notFound()`를 호출해도 스트리밍 셸이 이미 시작된 뒤라 HTTP status는 200으로 남고, 실제 404 신호는 RSC payload/메타 리프레시로 클라이언트에서 처리된다. 이 때문에 status 코드가 아니라 응답 본문에 상대방 계획 제목이 포함되는지로 판정했다(위 "응답 본문에 A 계획 제목 포함 여부: false"가 실제 판정 결과).

## 6) 조작된 헤더의 다른 사용자 id 무시

```
응답 user.id가 여전히 B: true
```
`X-User-Id: <A의 id>` 헤더를 위조해 `/api/export`를 호출해도, 서버는 세션 쿠키에서 얻은 `userId`만 사용하므로 응답 속 `user.id`는 여전히 B였다.

## 원시 요청/응답 로그 (비밀 제거됨)

```
[A · 미인증] POST /api/auth/sign-up/email -> 200
  응답: {"token":"…생략","user":{"name":"T07 Evidence A","email":"t07-evidence-a-1789735958741@example.com","emailVerified":false,"image":null,"createdAt":"2026-09-18T12:52:38.931Z","updatedAt":"2026-09-18T12:52:38.931Z","id":"AQxttWynICyjkbmYAbKbUHY6tfOhskOM"}}

[B · 미인증] POST /api/auth/sign-up/email -> 200
  응답: {"token":"…생략","user":{"name":"T07 Evidence B","email":"t07-evidence-b-1789735958741@example.com","emailVerified":false,"image":null,"createdAt":"2026-09-18T12:52:39.173Z","updatedAt":"2026-09-18T12:52:39.173Z","id":"WXPmuHq2eYpQQYwa8fVUi7ZM6Lu4At7C"}}

[A · 미인증] POST /api/auth/sign-in/email -> 200
  응답: {"redirect":false,"token":"…생략","user":{"name":"T07 Evidence A","email":"t07-evidence-a-1789735958741@example.com","emailVerified":false,"image":null,"createdAt":"2026-09-18T12:52:38.931Z","updatedAt":"2026-09-18T12:52:38.931Z","id":"AQxttWynICyjkbmYAbKbUHY6tfOhskOM"}}

[B · 미인증] POST /api/auth/sign-in/email -> 200
  응답: {"redirect":false,"token":"…생략","user":{"name":"T07 Evidence B","email":"t07-evidence-b-1789735958741@example.com","emailVerified":false,"image":null,"createdAt":"2026-09-18T12:52:39.173Z","updatedAt":"2026-09-18T12:52:39.173Z","id":"WXPmuHq2eYpQQYwa8fVUi7ZM6Lu4At7C"}}

[(none) · 미인증] GET /api/export -> 401
  응답: {"error":"Unauthorized"}

[A · 로그인] GET /api/export -> 200
  응답: {"schemaVersion":"2.0.0","exportedAt":"2026-09-18T12:52:40.113Z","user":{"id":"AQxttWynICyjkbmYAbKbUHY6tfOhskOM","name":"T07 Evidence A","email":"t07-evidence-a-1789735958741@example.com"},"plans":[{"id":34,"userId":"AQxttWynICyjkbmYAbKbUHY6tfOhskOM","title":"T07 evidence plan A","description":"","startDate":"2026-01-01","endDate":"2026-01-31","priority":"MEDIUM","successCriteria":"evidence","estimatedMinutes":60,"carriedImprovement":null,"sourceReflectionId":null,"createdAt":"2026-09-18T12:52:39.910Z","updatedAt":"2026-09-18T12:52:39.910Z","deletedAt":null}],"planRevisions":[],"tasks":[],"workLogs":[],"completionEvents":[],"reflections":[]}

[A · 로그인] POST /api/auth/sign-out -> 200
  응답: {"success":true}

[A · 미인증] GET /api/export (이전 세션 쿠키 재사용) -> 401
  응답: {"note":"로그아웃 전 세션 쿠키로 재요청"}

[A · 미인증] POST /api/auth/sign-in/email -> 200
  응답: {"redirect":false,"token":"…생략","user":{"name":"T07 Evidence A","email":"t07-evidence-a-1789735958741@example.com","emailVerified":false,"image":null,"createdAt":"2026-09-18T12:52:38.931Z","updatedAt":"2026-09-18T12:52:38.931Z","id":"AQxttWynICyjkbmYAbKbUHY6tfOhskOM"}}

[A · 로그인] GET /api/export -> 200
  응답: {"schemaVersion":"2.0.0","exportedAt":"2026-09-18T12:52:40.665Z","user":{"id":"AQxttWynICyjkbmYAbKbUHY6tfOhskOM","name":"T07 Evidence A","email":"t07-evidence-a-1789735958741@example.com"},"plans":[{"id":34,"userId":"AQxttWynICyjkbmYAbKbUHY6tfOhskOM","title":"T07 evidence plan A","description":"","startDate":"2026-01-01","endDate":"2026-01-31","priority":"MEDIUM","successCriteria":"evidence","estimatedMinutes":60,"carriedImprovement":null,"sourceReflectionId":null,"createdAt":"2026-09-18T12:52:39.910Z","updatedAt":"2026-09-18T12:52:39.910Z","deletedAt":null}],"planRevisions":[],"tasks":[],"workLogs":[],"completionEvents":[],"reflections":[]}

[B · 로그인] GET /api/export -> 200
  응답: {"schemaVersion":"2.0.0","exportedAt":"2026-09-18T12:52:40.795Z","user":{"id":"WXPmuHq2eYpQQYwa8fVUi7ZM6Lu4At7C","name":"T07 Evidence B","email":"t07-evidence-b-1789735958741@example.com"},"plans":[{"id":35,"userId":"WXPmuHq2eYpQQYwa8fVUi7ZM6Lu4At7C","title":"T07 evidence plan B","description":"","startDate":"2026-01-01","endDate":"2026-01-31","priority":"MEDIUM","successCriteria":"evidence","estimatedMinutes":60,"carriedImprovement":null,"sourceReflectionId":null,"createdAt":"2026-09-18T12:52:39.939Z","updatedAt":"2026-09-18T12:52:39.939Z","deletedAt":null}],"planRevisions":[],"tasks":[],"workLogs":[],"completionEvents":[],"reflections":[]}

[B · 로그인] GET /plans/34 -> 200
  응답: {"_html":"36721 bytes"}

[B · 로그인] GET /plans/34/edit -> 200
  응답: {"_html":"39405 bytes"}

[B · 로그인] GET /api/export (X-User-Id 조작) -> 200
  응답: {"schemaVersion":"2.0.0","exportedAt":"2026-09-18T12:52:41.515Z","user":{"id":"WXPmuHq2eYpQQYwa8fVUi7ZM6Lu4At7C","name":"T07 Evidence B","email":"t07-evidence-b-1789735958741@example.com"},"plans":[{"id":35,"userId":"WXPmuHq2eYpQQYwa8fVUi7ZM6Lu4At7C","title":"T07 evidence plan B","description":"","startDate":"2026-01-01","endDate":"2026-01-31","priority":"MEDIUM","successCriteria":"evidence","estimatedMinutes":60,"carriedImprovement":null,"sourceReflectionId":null,"createdAt":"2026-09-18T12:52:39.939Z","updatedAt":"2026-09-18T12:52:39.939Z","deletedAt":null}],"planRevisions":[],"tasks":[],"workLogs":[],"completionEvents":[],"reflections":[]}
```

## 쿠키(마스킹)

```
A: better-auth.session_token=kiM5yS…생략; better-auth.session_data=; better-auth.dont_remember=
B: better-auth.session_token=L5zS7j…생략
```

## Playwright 기반 write-경로 증거 (hidden form field 조작)

HTTP `fetch`로는 Next.js Server Action(`<form action={fn}>`)을 직접 호출할 수 없어(React가 클라이언트에서만 실제 액션 참조를 해석), 이 경로는 자동 테스트에서 실제 Chrome(Playwright)으로 검증했다 — [tests/auth-ownership.test.ts](../tests/auth-ownership.test.ts)의 "6b" 케이스.

- B로 로그인한 브라우저에서 B 자신의 계획 페이지를 연다.
- `page.evaluate()`로 보관(archive) 폼의 hidden `planId` input 값을 A 소유 plan의 id로 DOM 조작한다.
- "보관" 버튼을 클릭해 제출한다.
- 제출 후 DB에서 A 계획의 `deletedAt`을 직접 조회 — 여전히 `null`(보관되지 않음)임을 확인.

결과: Server Action이 제출된 hidden field 값이 아니라 **세션에서 읽은 userId 기준으로 소유권을 재검증**하므로, 클라이언트에서 폼 필드를 조작해도 다른 사용자의 자료를 수정할 수 없었다.

## 정리 확인

스크립트 실행마다 "이번 실행에서 생성한 임시 계정/자료를 정리했습니다" 출력과 함께 A/B 계정 및 관련 plan을 삭제한다. 실행 후 DB를 직접 조회해 재확인:

```
users: [ 'lsg960528@gmail.com' ]
plans: [ { id: 3, title: '정보처리기사 실기 공부' } ]
```

실제 사용자 계정(`lsg960528@gmail.com`)과 그 1건의 실제 계획만 남고, 임시 증거 계정/자료는 모두 제거됨을 확인했다. 실제 사용자 자료는 스크립트 실행 중 조회·수정되지 않는다(별도의 독립된 A/B 임시 계정으로만 테스트).

## 자동 테스트 전체 결과

```
$ npm run test:auth
 Test Files  1 passed (1)
      Tests  12 passed (12)
```

```
$ npx vitest run
 Test Files  8 passed (8)
      Tests  59 passed (59)
```

## Secret scan / git diff --check

```
$ git grep -nE "(sk-[a-zA-Z0-9]{20,}|AIza[0-9A-Za-z_-]{35}|BEGIN (RSA|EC) PRIVATE KEY)" -- .
(0 matches)

$ git diff --check
(CRLF 관련 경고만 존재, 실제 공백 오류 0건)
```

`.env`/`.env.local`은 `.gitignore`로 커밋 제외되어 있으며, `.env.example`에는 키 이름만 있고 값은 비어 있다.

### production client bundle 스캔

`npm run build` 후 `.next/static`에서 서버 전용 환경변수 이름을 검색한 결과, `BETTER_AUTH_SECRET`이라는 **문자열**이 한 청크에서 발견되었다. 내용을 확인한 결과 이는 실제 비밀값이 아니라 better-auth 라이브러리 자체가 여러 런타임(Node/Deno/Bun/브라우저)에서 공용으로 쓰는 env-lookup 유틸리티의 getter 이름 목록으로, `get BETTER_AUTH_SECRET(){return l("BETTER_AUTH_SECRET")}` 형태의 죽은 코드 경로다(브라우저에는 `process.env`가 없어 호출돼도 값을 얻지 못함). 실제 비밀값이 들어간 흔적은 없다. 서버 전용 파일 [src/lib/auth.ts](../src/lib/auth.ts)에는 `import "server-only"`가 선언되어 있어, 클라이언트 코드가 이를 import하면 즉시 빌드 오류가 나도록 되어 있고 — 실제로 빌드가 정상 성공했으므로 클라이언트 번들에 서버 전용 모듈이 섞여 들어가지 않았음을 확인했다. 클라이언트 인증 모듈([src/lib/auth-client.ts](../src/lib/auth-client.ts))은 `better-auth/react`의 `createAuthClient()`만 사용하며 `auth.ts`를 import하지 않는다.
