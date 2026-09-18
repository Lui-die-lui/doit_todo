function getErrorCode(err: unknown): unknown {
  return typeof err === "object" && err !== null && "code" in err
    ? (err as { code?: unknown }).code
    : undefined;
}

/**
 * Postgres unique_violation error code (SQLSTATE 23505).
 *
 * drizzle-orm wraps the underlying postgres-js error in a DrizzleQueryError,
 * so the SQLSTATE code lives on `err.cause.code`, not `err.code` -- this
 * checks both so the completion-dedup backstop actually catches the
 * unique-constraint violation instead of rethrowing it as a 500.
 */
export function isUniqueViolation(err: unknown): boolean {
  if (getErrorCode(err) === "23505") return true;
  const cause = typeof err === "object" && err !== null ? (err as { cause?: unknown }).cause : undefined;
  return getErrorCode(cause) === "23505";
}

/** Generic message shown to users; never leaks the raw DB error. */
export const GENERIC_SAVE_ERROR =
  "저장 중 오류가 발생했습니다. 네트워크 상태를 확인하고 잠시 후 다시 시도해주세요.";

/** Shown by every Server Action when there's no session at all -- distinct from the
 * per-entity "존재하지 않거나..." message used for an authenticated user's own-someone-
 * else's-data case, so the two are distinguishable in the T07 evidence log. */
export const AUTH_REQUIRED_ERROR = "로그인이 필요합니다.";
