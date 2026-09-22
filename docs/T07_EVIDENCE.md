# T07 증거 기록 (비밀 제거됨)

이 문서는 세 부분으로 구성된다: **1부** 실제 5일 사용 기록의 Git 이력 대조, **2부** 5일 합계/평균 손계산 대조, **3부** 인증/소유권 자동 증거(`scripts/t07-auth-evidence.ts`). 모든 값은 실제 코드·DB·Git 이력에서 그대로 읽었으며, 날짜/시각은 Asia/Seoul(KST, UTC+9)로 환산했다.

---

## 1부. 실제 5일 사용 기록 ↔ Git 이력 대조

### 1-1. 날짜 확정 근거

`doit_work_logs.start_at`(실행 기록의 실제 활동 시각)을 Asia/Seoul로 변환한 서로 다른 날짜는 정확히 5개다.

```
2026-09-18, 2026-09-19, 2026-09-20, 2026-09-21, 2026-09-22
```

(변환은 `src/lib/date.ts`의 `seoulTodayDateString`과 동일한 `Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" })` 방식으로 직접 재계산해 대조함.)

### 1-2. 사용일 × commit × 기록 대조표

| 사용일 | 실제 날짜(KST) | 관련 commit (7자리) | 주요 변경 | 실제 사용 기록 |
|---|---|---|---|---|
| 1일차 | 2026-09-18 | `18ddddf`, `e1a2e3e`, `41e96d7`, `82bce2e`(T06 최종), `b6e423d`(T07 인증 뼈대), `4818fe7`, `3407152`, `77ff83b` | 별자리/성능 개편, 내보내기·불러오기, 파비콘, **T07 인증·사용자 격리 도입**, DB 인덱스/일괄조회 | plan 3 생성(11:14), planRevision #2 "시작일을 잘못 잡았다"(13:07), task 10·21·22·23·24·25 생성(11:15~13:19), workLog 4·5(18:30~21:00 KST), completion×2, reflection #1(23:49) |
| 2일차 | 2026-09-19 | `80ce1a9`, `27c028b`, `966ec97` | 별자리 상호작용 통일/내비, Vercel 함수 리전(icn1), 옵저버토리 DO/SEE 패널 리팩터 | workLog 7(14:30 KST), workLog 6(21:30 KST), completion×2(task24, task23) |
| 3일차 | 2026-09-20 | `72f95ae`, `53be0fc`, `aff8f33`, `dc134918`, `07df7d5` | 비로그인 첫 화면 분리(`/`→`/login`), 글라스 캐러셀/홈 목록 정리, 계획 순서 드래그, **DateTimePicker/Select, "하루 총 투입 시간" 입력**, 사이트 타이틀 문구 | workLog 8(13:40 KST), workLog 9(19:10 KST), completion×5, reflection #2(21:52, 기간 09-19~09-20) |
| 4일차 | 2026-09-21 | `09fd093` | 계획 상세에 돌아보기 요약 표시 | task 118·119 생성, workLog 31(16:00 KST), workLog 32(20:10 KST), completion×3 |
| 5일차 | 2026-09-22 | *(없음 — 아래 §1-4 참고)* | — | task 173 생성(09:16), completion(09:15, 09:52), workLog 53(09:00~10:00 KST) |

commit hash 전체값과 GitHub URL:

| 7자리 | 전체 hash | URL |
|---|---|---|
| `18ddddf` | `18ddddf73a17bfc079eabdf82c582ca2ba692f25` | https://github.com/Lui-die-lui/doit_todo/commit/18ddddf73a17bfc079eabdf82c582ca2ba692f25 |
| `e1a2e3e` | `e1a2e3eba43279dbd9080dc67a9def00c975364e` | https://github.com/Lui-die-lui/doit_todo/commit/e1a2e3eba43279dbd9080dc67a9def00c975364e |
| `41e96d7` | `41e96d7ab84f08b919d51f102f8a220ddb5d4a73` | https://github.com/Lui-die-lui/doit_todo/commit/41e96d7ab84f08b919d51f102f8a220ddb5d4a73 |
| `82bce2e` | `82bce2e9f456602e3694877842111d2ebd6b15e8` | https://github.com/Lui-die-lui/doit_todo/commit/82bce2e9f456602e3694877842111d2ebd6b15e8 |
| `b6e423d` | `b6e423da610862e3984e7b7f082242e90144b7b3` | https://github.com/Lui-die-lui/doit_todo/commit/b6e423da610862e3984e7b7f082242e90144b7b3 |
| `4818fe7` | `4818fe72a474eba53c9682565f00354f67dcc0bf` | https://github.com/Lui-die-lui/doit_todo/commit/4818fe72a474eba53c9682565f00354f67dcc0bf |
| `3407152` | `34071522898dbdd659252d93b0d767c665cfc885` | https://github.com/Lui-die-lui/doit_todo/commit/34071522898dbdd659252d93b0d767c665cfc885 |
| `77ff83b` | `77ff83bc61c5794f787cfd8b3c58782ab0d5f4eb` | https://github.com/Lui-die-lui/doit_todo/commit/77ff83bc61c5794f787cfd8b3c58782ab0d5f4eb |
| `80ce1a9` | `80ce1a95b74d6a0ff868848acd3b280611c9b2f7` | https://github.com/Lui-die-lui/doit_todo/commit/80ce1a95b74d6a0ff868848acd3b280611c9b2f7 |
| `27c028b` | `27c028b15b346a63a052bcfb0fe4c651dbd6fdf7` | https://github.com/Lui-die-lui/doit_todo/commit/27c028b15b346a63a052bcfb0fe4c651dbd6fdf7 |
| `966ec97` | `966ec97d69287b599f05869bd6f84ece55fbd5f3` | https://github.com/Lui-die-lui/doit_todo/commit/966ec97d69287b599f05869bd6f84ece55fbd5f3 |
| `72f95ae` | `72f95ae962e11b53d4fb594a27d2dcf7b425f36b` | https://github.com/Lui-die-lui/doit_todo/commit/72f95ae962e11b53d4fb594a27d2dcf7b425f36b |
| `53be0fc` | `53be0fc08cc64e65c3674b5b4a594851127ff08c` | https://github.com/Lui-die-lui/doit_todo/commit/53be0fc08cc64e65c3674b5b4a594851127ff08c |
| `aff8f33` | `aff8f33dfaf9b07cc6b73e1facc2dc01db57e56d` | https://github.com/Lui-die-lui/doit_todo/commit/aff8f33dfaf9b07cc6b73e1facc2dc01db57e56d |
| `dc13491` | `dc1349180ac5e1a2c94058bd9199b927b0e59d77` | https://github.com/Lui-die-lui/doit_todo/commit/dc1349180ac5e1a2c94058bd9199b927b0e59d77 |
| `07df7d5` | `07df7d59195bd536306f38df54106360d5d77ab8` | https://github.com/Lui-die-lui/doit_todo/commit/07df7d59195bd536306f38df54106360d5d77ab8 |
| `09fd093` | `09fd0938f97da3b85f37d5c59c61f8b092cbf6f4` | https://github.com/Lui-die-lui/doit_todo/commit/09fd0938f97da3b85f37d5c59c61f8b092cbf6f4 |

확인 명령:
```
$ git log --all --date=iso-strict --format="%H|%ad|%s"
```
(전체 17개 commit, 브랜치 분기 없이 `main` 하나. 출력은 위 표에 그대로 반영했다.)

### 1-3. 결론: 서로 다른 실제 날짜 5개 — **통과**

work log 기준 Asia/Seoul 날짜 5개(09-18~09-22)가 각각 최소 1개 이상의 commit이 있는 날(4·5일차는 commit 없음, 아래 참고)과 겹치며, 모든 날짜에 plan/task/workLog/completion 중 최소 1개 이상의 실제 DB 레코드가 존재한다.

### 1-4. 5일차(09-22)에 commit이 없는 이유

5일차 실행 기록(workLog 53)은 있으나, 이 문서를 작성하는 이번 세션(T07 제출 문서 정리) 자체가 오늘(09-22)의 첫 commit이 된다. "매일 의도적으로 commit·push를 남겼다"는 전제와 완전히 일치시키려면, 이 문서화 작업을 커밋·push하는 것이 5일차의 commit 증거가 된다 — 날짜를 소급하지 않고 오늘 실제로 커밋하는 방식으로 처리했다(§작업 원칙 참고, 최종 커밋 hash는 이 문서의 최신 버전을 push한 뒤 SUBMISSION.md에 반영).

---

## 2부. 1일차 지표 고정 / 2~3일차 규칙 변경 / 5일 계산 검산

### 2-1. 1일차 질문·지표·단위·계산 규칙 — **미충족 (사전 고정 기록 없음)**

1일차(09-18) 코드·commit·plan 3의 `description`/`success_criteria`, 회고 2건, `docs/` 전체를 조사했으나 "질문 한 문장 / 지표 / 단위 / 계산 규칙 / 누락·중복·이상치·반올림·주 시작 요일" 을 1일차 이전에 고정 선언한 기록은 **어디에도 없다**.

- plan 3 `description`: `"정처기 감자와 함께하는 정보처리기사 실기 재도전"`
- plan 3 `success_criteria`: `"매일 모의고사 1개씩, 정처기 감자 일정 잊지 않기"`
- 위 두 문장은 계획의 목표 서술일 뿐, CLAUDE.md 8장이 요구하는 형식(질문/지표/단위/계산식/처리 규칙)이 아니다.

다만 **코드에는 처음부터(T06부터) 일관된 계산식이 존재**하며, 5일 내내 변경 없이 그대로 쓰였다 — `computeRetroAggregation`, [src/lib/aggregations.ts](../src/lib/aggregations.ts):

```
estimatedMinutesTotal = 활성 task의 estimatedMinutes 합
actualMinutesTotal    = 그 task들에 속한 workLog의 actualMinutes 합
diffMinutes           = actualMinutesTotal - estimatedMinutesTotal
```

이걸 역으로 "질문/지표"로 정리하면:

- 질문: 계획한 시간과 실제로 투입한 시간이 5일 동안 얼마나 차이 나는가?
- 지표: 예상 대비 실제 투입 시간 차이(diff)
- 단위: 분
- 계산식: `actualMinutesTotal - estimatedMinutesTotal` (`computeRetroAggregation`, [src/lib/aggregations.ts:43](../src/lib/aggregations.ts))

이 계산식 자체는 5일 내내(commit 이력상 이 함수는 T06 이후 한 번도 수정되지 않음) 동일하게 적용됐다는 것은 코드로 확인되지만, **"1일차 시작 전에 사람이 명시적으로 고정·선언"한 기록은 없다** — 앱이 원래 그렇게 계산하도록 짜여 있었을 뿐이다. 그래서 이 항목은 "코드 계산식은 일관됨(사실)"과 "사전 고정 선언 절차는 없었음(미충족)"을 함께 보고한다.

**처리 규칙(코드 기준, 사후 확인)**:
| 규칙 | 실제 코드 동작 | 근거 |
|---|---|---|
| 누락값 | 구조적으로 불가능 — `estimated_minutes`/`actual_minutes` 모두 `NOT NULL` | [src/db/schema.ts:40,90,111](../src/db/schema.ts) |
| 중복값 | 한 task에 여러 workLog가 있으면 actualMinutes를 모두 합산(제외하지 않음); 완료는 task.status 한 값이라 완료 이벤트가 여러 번 찍혀도 doneCount는 1로 집계 | [src/lib/aggregations.ts](../src/lib/aggregations.ts) |
| 이상치 | 별도 상한/제외 로직 없음 — 원본 값 그대로 합산 | 위와 동일 |
| 반올림 | 정수 분 단위, `Math.round` (반올림) | [src/lib/date.ts:53,109,114,125,136](../src/lib/date.ts) |
| 주 시작 요일 | 해당 없음 — 이 앱에는 주간(weekly) 집계 기능 자체가 없음(계획 단위/기간 단위 집계만 존재) | 코드 전체 검색 결과, `weekStart`류 로직 없음 |

### 2-2. 2~3일차 사이 규칙 변경 — **미충족 (해당 조건을 만족하는 commit 없음)**

**조사 방법**: 2일차(09-19) 마지막 실제 기록 시각(workLog 7 `created_at` 22:34 KST)부터 3일차(09-20) 첫 실제 기록 시각(completion 이벤트 16:09 KST) 사이의 모든 commit을 찾고, 각각의 실제 diff를 대조했다.

| 항목 | 내용 |
|---|---|
| 조사 window | 2026-09-19 22:34 KST ~ 2026-09-20 16:09 KST |
| window 안의 commit | `72f95ae`(02:15:45), `53be0fc`(02:15:46) — 둘뿐 |
| `72f95ae` 판정 | **제외** — "비로그인 첫 화면을 `/`→`/login`으로 분리"는 사용자가 명시한 제외 목록의 "로그인 화면 변경"/"인증 구현"에 정확히 해당 |
| `53be0fc` 판정 | **제외** — commit 메시지·diff 모두 "글라스 캐러셀 화살표 스타일, 홈 화면 할 일 목록에서 완료 항목/검색·상태 필터 제거, 최근 실행기록 패널 전체 표시" — `src/components/observatory/HomeTaskList.tsx`의 검색창·상태 드롭다운을 지우고 정렬만 남긴 **홈 화면 위젯의 표시 방식** 변경이며, 계획을 세우거나 작업을 배분하는 규칙(하루 개수 제한/우선순위 배치/미완료 처리/작업 분할/계획-실행 일치 기준)이 아니라 사용자가 명시한 제외 목록의 "단순 UI 변경"에 더 가깝다고 판단 |

**window 밖에서 발견한 근접 후보**: `dc13491`(2026-09-20 23:53:35 KST)은 계획 폼의 "총 예상 투입 시간" 직접 입력을 "하루 총 투입 시간 × 기간"으로 바꾼 진짜 계획 규칙 변경이지만(`src/components/PlanForm.tsx`), 시각이 3일차 마지막 기록(task41 completion, 23:29 KST)보다 **24분 뒤**라 "3일차 기록이 만들어지기 이전"이 아니다. 또한 이 변경 이후 plan이 새로 생성된 적이 없어(실제 사용된 plan 3·48은 모두 이 commit 이전에 생성됨) 실제 데이터로 전후 비교도 불가능하다.

**결론**: 이 문서 작성 시점 기준, CLAUDE.md 8장/사용자 지시가 요구하는 "2일차 뒤·3일차 전, 계획 규칙 하나 변경, 1·2일차 근거로 설명 가능"을 모두 만족하는 commit은 **존재하지 않는다**. 없는 사실을 만들지 않기 위해 미충족으로 기록한다. (§작업 원칙에 따라 이후 해결 방법은 판정만 하고 임의로 되돌리거나 새로 만들지 않았다 — 사용자 결정 대기.)

### 2-3. 5일 합계·평균 검산 — **통과 (코드·손계산 일치)**

`computeRetroAggregation`을 실제 DB 값(plan 3, task 13건, workLog 9건)으로 직접 호출해 나온 값과, 원시 DB 값을 사람이 손으로 합산한 값을 대조했다.

**날짜별 실행 기록(work log) 실제/반영 값**:

| 날짜(KST) | 원본 workLog(분) | 계산 반영 값(합, 분) | 계산 과정 |
|---|---|---|---|
| 09-18 | 130, 150 | 280 | 130+150 |
| 09-19 | 140, 60 | 200 | 140+60 |
| 09-20 | 149, 159 | 308 | 149+159 |
| 09-21 | 110, 140 | 250 | 110+140 |
| 09-22 | 60 | 60 | 60 |
| **5일 합계** | | **1098** | 280+200+308+250+60 |
| **5일 평균(반올림 전)** | | 219.6 | 1098 ÷ 5 |
| **5일 평균(반올림 후, `Math.round`)** | | **220** | — |

**plan 3 전체 스냅샷(활성 task 13건 기준, `computeRetroAggregation` 실행 결과)**:

```json
{
  "plannedCount": 13, "doneCount": 13, "overdueCount": 0, "blockedCount": 4,
  "estimatedMinutesTotal": 1650, "actualMinutesTotal": 1098, "diffMinutes": -552
}
```

| 값 | 손계산 | 코드(`computeRetroAggregation`) 결과 | 일치 |
|---|---|---|---|
| estimatedMinutesTotal | 180+120+60+150+180+150+120+60+180+30+180+60+180 = **1650** | 1650 | ✅ |
| actualMinutesTotal | 130+150+140+60+149+159+110+140+60 = **1098** | 1098 | ✅ |
| diffMinutes | 1098-1650 = **-552** | -552 | ✅ |
| blockedCount | blockerReason 있는 workLog가 속한 task: 10, 23, 25, 41 → **4개** | 4 | ✅ |

화면(브라우저) 값과의 대조는 실제 사용자 계정 로그인 자격 증명이 없어 수행하지 못했다 — 대신 **SEE 화면이 호출하는 것과 동일한 함수를 동일한 DB 값으로 직접 실행**해 코드 결과와 손계산을 대조했다(위 표). 코드와 손계산이 완전히 일치하므로, 집계 로직 자체에는 오차가 없음을 확인했다.

재현 명령(비밀값 없이 실행 가능, tsx로 `computeRetroAggregation`을 직접 호출):
```
npx tsx -e '
import { computeRetroAggregation } from "./src/lib/aggregations";
import { seoulTodayDateString } from "./src/lib/date";
// ...DB에서 읽은 tasks/workLogs 배열을 그대로 전달
'
```

---

## 3부. 인증 / 소유권 자동 증거

`scripts/t07-auth-evidence.ts` (`npm run t07:evidence`) 실행 원본 로그. 계정 A/B는 스크립트가 실행 시점에 생성한 임시 계정이며, 스크립트 종료 시 자동 삭제된다. 비밀번호 원문은 어떤 줄에도 남기지 않는다. 쿠키는 앞 6자만 보이고 나머지는 `…생략`으로 마스킹된다.

**가장 최근 실행 시각(UTC): `2026-09-22T01:33:50.836Z` / BASE: `http://localhost:3000`** — T07 제출 문서 정리 시점에 현재 코드로 재실행해 09-18 최초 실행과 동일한 결과를 재확인함.

## 실행 요약

```
계정 A: t07-evidence-a-1790040807143@example.com (이번 실행용 임시 생성)
계정 B: t07-evidence-b-1790040807143@example.com (이번 실행용 임시 생성)
비밀번호는 어떤 로그·출력에도 원문으로 남기지 않습니다.
```

## 8) 같은 비밀번호를 쓴 두 계정의 해시가 다른지

```
A 해시 일부: 8270f39b8f4e6074ae2f8d8e…
B 해시 일부: 5cbc52df8e303e456533618e…
서로 다름: true
```

## 5) A/B 목록에 상대 자료 0건

```
A의 export에 B 계획 포함: false
B의 export에 A 계획 포함: false
```

## 3/4/7) B→A 읽기·수정 화면 거절, 거절 전후 A 자료 건수

```
/plans/150 응답 status: 200 (스트리밍 특성상 200이어도 무방 -- 아래 내용 검사가 실제 판정)
응답 본문에 A 계획 제목 포함 여부: false (false여야 정상)
/plans/150/edit 응답 status: 200
시도 전 A 계획 수: 1, 시도 후: 1, 변화 없음: true
```

Next.js App Router는 중첩 서버 컴포넌트에서 `notFound()`를 호출해도 스트리밍 셸이 이미 시작된 뒤라 HTTP status는 200으로 남고, 실제 404 신호는 RSC payload/메타 리프레시로 클라이언트에서 처리된다. 이 때문에 status 코드가 아니라 응답 본문에 상대방 계획 제목이 포함되는지로 판정했다.

## 6) 조작된 헤더의 다른 사용자 id 무시

```
응답 user.id가 여전히 B: true
```
`X-User-Id: <A의 id>` 헤더를 위조해 `/api/export`를 호출해도, 서버는 세션 쿠키에서 얻은 `userId`만 사용하므로 응답 속 `user.id`는 여전히 B였다.

## 원시 요청/응답 로그 (비밀 제거됨)

```
[A · 미인증] POST /api/auth/sign-up/email -> 200
  응답: {"token":"…생략","user":{"name":"T07 Evidence A","email":"t07-evidence-a-1790040807143@example.com","emailVerified":false,"image":null,"createdAt":"2026-09-22T01:33:30.345Z","updatedAt":"2026-09-22T01:33:30.345Z","id":"OFxZooYOwAoDphsMS0lMEKHypHFdoRZT"}}

[B · 미인증] POST /api/auth/sign-up/email -> 200
  응답: {"token":"…생략","user":{"name":"T07 Evidence B","email":"t07-evidence-b-1790040807143@example.com","emailVerified":false,"image":null,"createdAt":"2026-09-22T01:33:30.862Z","updatedAt":"2026-09-22T01:33:30.862Z","id":"OBoGxxUMzPK3SZZn4rbiDWWyZr0rb2ff"}}

[A · 미인증] POST /api/auth/sign-in/email -> 200
[B · 미인증] POST /api/auth/sign-in/email -> 200

[(none) · 미인증] GET /api/export -> 401
  응답: {"error":"Unauthorized"}

[A · 로그인] GET /api/export -> 200
  응답: {"schemaVersion":"2.0.0","exportedAt":"2026-09-22T01:33:33.629Z","user":{"id":"OFxZooYOwAoDphsMS0lMEKHypHFdoRZT","name":"T07 Evidence A","email":"t07-evidence-a-1790040807143@example.com"},"plans":[{"id":150,"userId":"OFxZooYOwAoDphsMS0lMEKHypHFdoRZT","title":"T07 evidence plan A","description":"","startDate":"2026-01-01","endDate":"2026-01-31","priority":"MEDIUM","successCriteria":"evidence","estimatedMinutes":60,"carriedImprovement":null,"sourceReflectionId":null,"sortOrder":null,"createdAt":"2026-09-22T01:33:31.932Z","updatedAt":"2026-09-22T01:33:31.932Z","deletedAt":null}],"planRevisions":[],"tasks":[],"workLogs":[],"completionEvents":[],"reflections":[]}

[A · 로그인] POST /api/auth/sign-out -> 200
  응답: {"success":true}

[A · 미인증] GET /api/export (이전 세션 쿠키 재사용) -> 401
  응답: {"note":"로그아웃 전 세션 쿠키로 재요청"}

[A · 미인증] POST /api/auth/sign-in/email -> 200
[A · 로그인] GET /api/export -> 200 (재로그인 후 정상 재조회)

[B · 로그인] GET /api/export -> 200
  응답: {"schemaVersion":"2.0.0","exportedAt":"2026-09-22T01:33:34.767Z","user":{"id":"OBoGxxUMzPK3SZZn4rbiDWWyZr0rb2ff","name":"T07 Evidence B","email":"t07-evidence-b-1790040807143@example.com"},"plans":[{"id":151,"userId":"OBoGxxUMzPK3SZZn4rbiDWWyZr0rb2ff","title":"T07 evidence plan B","description":"","startDate":"2026-01-01","endDate":"2026-01-31","priority":"MEDIUM","successCriteria":"evidence","estimatedMinutes":60,"carriedImprovement":null,"sourceReflectionId":null,"sortOrder":null,"createdAt":"2026-09-22T01:33:31.974Z","updatedAt":"2026-09-22T01:33:31.974Z","deletedAt":null}],"planRevisions":[],"tasks":[],"workLogs":[],"completionEvents":[],"reflections":[]}

[B · 로그인] GET /plans/150 -> 200
  응답: {"_html":"34974 bytes"}  (본문에 "T07 evidence plan A" 미포함)

[B · 로그인] GET /plans/150/edit -> 200
  응답: {"_html":"37670 bytes"}  (본문에 "T07 evidence plan A" 미포함)

[B · 로그인] GET /api/export (X-User-Id 조작) -> 200
  응답: {"schemaVersion":"2.0.0","exportedAt":"2026-09-22T01:33:50.831Z","user":{"id":"OBoGxxUMzPK3SZZn4rbiDWWyZr0rb2ff", ...},"plans":[{"id":151, "userId":"OBoGxxUMzPK3SZZn4rbiDWWyZr0rb2ff", "title":"T07 evidence plan B", ...}], ...}
```

## 쿠키(마스킹)

```
A: better-auth.session_token=EsmRFv…생략; better-auth.session_data=; better-auth.dont_remember=
B: better-auth.session_token=noSev9…생략
```

## Playwright 기반 write-경로 증거 (hidden form field 조작)

HTTP `fetch`로는 Next.js Server Action(`<form action={fn}>`)을 직접 호출할 수 없어(React가 클라이언트에서만 실제 액션 참조를 해석), 이 경로는 자동 테스트에서 실제 Chrome(Playwright)으로 검증했다 — [tests/auth-ownership.test.ts](../tests/auth-ownership.test.ts)의 "6b" 케이스.

- B로 로그인한 브라우저에서 B 자신의 계획 페이지를 연다.
- `page.evaluate()`로 보관(archive) 폼의 hidden `planId` input 값을 A 소유 plan의 id로 DOM 조작한다.
- "보관" 버튼을 클릭해 제출한다.
- 제출 후 DB에서 A 계획의 `deletedAt`을 직접 조회 — 여전히 `null`(보관되지 않음)임을 확인.

결과: Server Action이 제출된 hidden field 값이 아니라 **세션에서 읽은 userId 기준으로 소유권을 재검증**하므로, 클라이언트에서 폼 필드를 조작해도 다른 사용자의 자료를 수정할 수 없었다.

## 정리 확인

스크립트 실행마다 "이번 실행에서 생성한 임시 계정/자료를 정리했습니다" 출력과 함께 A/B 계정 및 관련 plan을 삭제한다. 실행 후 DB를 직접 조회해 재확인(2026-09-22 실행분):

```
leftover evidence users: 0 []
leftover evidence plans: 0 []
users: [ 'lsg960528@gmail.com', 'pmy738170@gmail.com' ]
plans: [ { id: 3, title: '정보처리기사 실기 공부', userId: 'lsg960528 소유' },
         { id: 48, title: '동항중 연주회', userId: 'lsg960528 소유' } ]
```

실제 사용자 계정(`lsg960528@gmail.com`)과 그 2건의 실제 계획만 남고, 임시 증거 계정/자료는 모두 제거됨을 확인했다. `pmy738170@gmail.com` 계정은 실사용 자료가 0건이다(가입만 되어 있음). 실제 사용자 자료는 스크립트 실행 중 조회·수정되지 않는다(별도의 독립된 A/B 임시 계정으로만 테스트).

## 자동 테스트 전체 결과 (2026-09-22 재실행)

```
$ npm run typecheck
(오류 없음)

$ npm run lint
(오류 없음)

$ npm run test:auth   # 실서버(localhost:3000) 필요 -- 1회차는 dev 서버 콜드스타트로 1개 timeout(20s),
                        # warm 상태로 재실행 시 12/12 통과. 아래는 warm 재실행 결과.
 Test Files  1 passed (1)
      Tests  12 passed (12)

$ npm run test        # 전체 유닛 + 통합 테스트
 Test Files  11 passed (11)
      Tests  131 passed (131)

$ npm run build
✓ Compiled successfully, 20개 라우트 생성 완료 (Route (app) 표 생략 -- 빌드 오류 없음)
```

## Secret scan / git diff --check

```
$ git grep -InE "sk-[A-Za-z0-9]{20,}|AIza[A-Za-z0-9_-]{30,}|-----BEGIN (RSA |EC )?PRIVATE KEY-----|postgresql://[^ ]*:[^ ]*@" -- . ':!*.lock'
.env.example:8:# Example: postgresql://postgres.xxxx:PASSWORD@...  (문서 예시 문자열, 실제 값 아님)
drizzle.config.ts:11:    url: connectionString ?? "postgresql://placeholder:placeholder@localhost:5432/placeholder",  (연결 문자열 없을 때 쓰는 가짜 fallback)

$ git diff --check
(CRLF 관련 경고만 존재, 실제 공백/개행 오류 0건)
```

`.env`/`.env.local`은 `.gitignore`로 커밋 제외되어 있으며(`git ls-files`에도 없음), `.env.example`에는 키 이름만 있고 값은 비어 있다. `BETTER_AUTH_SECRET=`/`GOOGLE_CLIENT_SECRET=` 형태로 실제 값이 하드코딩된 곳은 tracked 파일 전체에서 0건.

### production client bundle 스캔

`npm run build` 후 `.next/static`에서 서버 전용 환경변수 이름을 검색한 결과, `BETTER_AUTH_SECRET`이라는 **문자열**이 한 청크(`613-78e22e614adbe68b.js`)에서 발견되었다. 내용을 확인한 결과 이는 실제 비밀값이 아니라 better-auth 라이브러리 자체가 여러 런타임(Node/Deno/Bun/브라우저)에서 공용으로 쓰는 env-lookup 유틸리티의 getter 이름 목록으로, `get BETTER_AUTH_SECRET(){return l("BETTER_AUTH_SECRET")}` 형태의 죽은 코드 경로다(브라우저에는 `process.env`가 없어 호출돼도 값을 얻지 못함). 실제 비밀값이 들어간 흔적은 없다(`GOOGLE_CLIENT_SECRET`/`SUPABASE_CONNECTION_KEY`/`SUPABASE_SECRET_KEY` 등 다른 이름은 이 청크에 아예 없음). 서버 전용 파일 [src/lib/auth.ts](../src/lib/auth.ts)에는 `import "server-only"`가 선언되어 있어 클라이언트 코드가 이를 import하면 즉시 빌드 오류가 나도록 되어 있고 — 실제로 빌드가 정상 성공했으므로 클라이언트 번들에 서버 전용 모듈이 섞여 들어가지 않았음을 확인했다.
