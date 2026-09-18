# DB 성능 개선 및 무중단 적용 가이드

## 목적과 안전 경계

이번 변경은 화면 결과와 권한 경계를 유지하면서 반복 DB 왕복을 줄이는 것이 목적이다.

- `/plans`: 계획 수를 `N`이라고 할 때 데이터 쿼리를 기존 `1 + 4N`에서 최대 5회로 제한한다.
- `/dashboard`: 기존 `1 + 3N` 데이터 쿼리를 최대 4회로 제한한다.
- `/see`: 기본 진입 시 활성 계획을 두 번 조회하던 중복을 제거한다.
- 같은 서버 렌더 요청 안에서 레이아웃과 페이지가 수행하는 세션 조회를 한 번으로 메모이제이션한다.
- 사용자 소유권 필터, 정렬, 집계 결과와 화면 구조는 변경하지 않는다.

현재 빌드 산출물은 소스 수정만으로 바뀌지 않는다. 새 코드가 실제 서비스에 반영되는 시점은 재빌드·배포 이후이며, 인덱스는 별도 명령에 `--apply`를 명시했을 때만 DB에 생성된다.

DB 작업에는 CPU, I/O와 짧은 카탈로그 락이 발생할 수 있으므로 “영향 0”을 보장할 수는 없다. 아래 절차의 목표는 무중단, 결과 불변, 즉시 코드 롤백, DB 영향 최소화다.

## 변경 구성

### 쿼리 일괄 처리

`src/lib/queries.ts`에 다중 계획용 조회를 추가했다.

- `getActiveTasksForPlanIds`
- `getPlanRevisionCounts`
- `getCarriedNextPlans`
- `getCarriedPlanIdsForPlans`

모든 함수는 기존과 동일하게 검증된 `userId`로 소유권을 제한한다. 조회 결과는 `src/lib/batch-grouping.ts`에서 계획별로 다시 묶으며 입력 배열 순서를 보존한다.

### 요청 단위 세션 중복 제거

`getSession`을 React `cache()`로 감쌌다. 캐시는 서버 프로세스 전체나 사용자 사이에 공유되는 영속 캐시가 아니라 동일 서버 렌더 요청 안에서 같은 호출을 재사용하는 용도다.

### 추가형 인덱스

`scripts/create-performance-indexes.ts`는 다음 인덱스를 한 번에 하나씩 `CREATE INDEX CONCURRENTLY IF NOT EXISTS`로 생성한다.

| 인덱스 | 대상 |
| --- | --- |
| `doit_plans_user_active_start_idx` | 사용자별 활성 계획 및 시작일 정렬 |
| `doit_plans_user_created_idx` | 사용자별 전체 계획 및 생성일 정렬 |
| `doit_tasks_plan_active_idx` | 계획별 활성 할 일 |
| `doit_work_logs_task_start_idx` | 할 일별 작업 기록 및 시간 정렬 |
| `doit_reflections_plan_period_idx` | 계획별 회고 기간 정렬 |
| `doit_reflections_plan_created_idx` | 계획별 최근 이어가기 조회 |

이 작업은 Drizzle의 일반 migration과 의도적으로 분리했다. 현재 Drizzle PostgreSQL migrator는 migration을 트랜잭션으로 감싸지만 PostgreSQL의 `CREATE INDEX CONCURRENTLY`는 트랜잭션 블록 안에서 실행할 수 없기 때문이다. 따라서 이 인덱스 작업에 `npm run db:migrate`를 사용하면 안 된다.

## 배포 전 검증

1. 운영과 유사한 스테이징 데이터로 새 빌드를 실행한다.
2. 다음 화면의 기존/신규 결과를 ID와 순서까지 비교한다.
   - 계획이 없는 계정
   - 활성 및 보관 계획이 함께 있는 계정
   - 삭제된 할 일이 있는 계획
   - 회고가 여러 개이고 다음 계획으로 이어진 경우
   - 작업 기록이 없는 경우와 많은 경우
3. `npm run typecheck`, `npm run lint`, 단위 테스트를 통과시킨다.
4. 요청별 쿼리 수와 p50/p95 응답시간을 기록한다.
5. 운영 DB의 여유 저장 공간, CPU/I/O, 장기 실행 트랜잭션을 확인한다.

성능 합격 기준의 권장값은 다음과 같다.

- 결과 데이터 및 정렬 차이 0건
- `/plans` 데이터 쿼리 수 5회 이하
- `/dashboard` 데이터 쿼리 수 4회 이하
- 오류율이 기존 대비 증가하지 않음
- p95 응답시간이 악화되지 않음

## 인덱스 적용 절차

먼저 DB 연결 없이 생성 SQL만 확인한다. 이 명령은 `.env`도 로드하지 않는다.

```bash
npm run db:indexes:performance
```

실제 적용 전에는 다음을 확인한다.

- 최근 DB 백업 또는 복구 지점
- 인덱스 크기의 최소 2배 이상 여유 공간
- 장기 실행 트랜잭션과 스키마 변경 작업이 없음
- 대시보드에서 CPU, I/O, 연결 수, lock wait를 즉시 볼 수 있음
- 애플리케이션 코드 배포는 아직 시작하지 않음

트래픽이 낮은 시간에 다음 명령을 실행한다.

```bash
npm run db:indexes:performance -- --apply
```

연결 문자열이 Supabase transaction pooler(`:6543`)를 가리키면 도구는 파일을 수정하지 않고 해당 실행 프로세스에서만 같은 pooler의 session 모드(`:5432`)로 전환한다. `SET lock_timeout`과 advisory lock이 쿼리 사이에 유지되어야 하기 때문이다. Direct 또는 session 연결은 그대로 사용하며, TLS를 필수로 설정한다.

스크립트는 다음 안전장치를 사용한다.

- 전용 advisory lock으로 중복 실행 방지
- 연결 하나만 사용
- `lock_timeout = 2s`
- 읽기 전용 DB, DDL 권한 부족, 5분 초과 트랜잭션, 다른 인덱스 빌드 사전 차단
- 인덱스를 순차 생성
- 이미 존재하는 인덱스는 건너뜀
- 완료 후 invalid index 존재 여부 검사

실행 중 DB CPU/I/O 또는 응답시간이 허용 범위를 넘으면 프로세스를 정상 종료하고 원인을 확인한다. `CREATE INDEX CONCURRENTLY` 중단 후에는 invalid index가 남을 수 있으므로 재실행 전에 반드시 상태를 확인한다.

## 애플리케이션 배포

1. 인덱스가 모두 valid인지 확인한다.
2. 새 애플리케이션 빌드를 스테이징에서 검증한다.
3. 한 인스턴스 또는 최소 트래픽에 카나리 배포한다.
4. `/dashboard`, `/plans`, `/see`, `/do`를 실제 권한 계정으로 점검한다.
5. 오류율, p95, DB CPU/I/O, 연결 대기를 기존 기준과 비교한다.
6. 이상이 없을 때만 트래픽을 단계적으로 확대한다.

인덱스 생성과 애플리케이션 배포를 같은 작업 창에서 동시에 수행하지 않는다. 원인 분리와 롤백을 위해 인덱스를 먼저 안정화한다.

## 롤백

애플리케이션에 문제가 있으면 직전 빌드로 즉시 되돌린다. 신규 인덱스는 기존 쿼리 결과를 바꾸지 않으므로 긴급하게 삭제할 필요가 없다.

인덱스 자체가 문제라고 확인된 경우에만, 다른 스키마 작업이 없는 시간에 하나씩 다음 형식으로 제거한다.

```sql
DROP INDEX CONCURRENTLY IF EXISTS index_name;
```

첫 배포에서는 테이블, 컬럼, 기존 인덱스를 삭제하지 않는다. 신규 인덱스 제거도 애플리케이션 롤백과 동시에 실행하지 않는다.

## 후속 개선

이번 배포가 안정화된 뒤 별도 변경으로 진행한다.

- 대시보드의 첫 슬라이드 우선 로딩
- 작업 기록 페이지네이션
- 최근 5개 기록을 DB에서 직접 제한하는 계획별 조회
- 운영 쿼리 관측 도구와 slow-query 기준 설정

이 항목은 데이터 로딩 방식이나 UX가 달라질 수 있으므로 이번 결과 불변 최적화와 분리한다.
