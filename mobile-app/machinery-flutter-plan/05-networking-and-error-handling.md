# 05 — Networking & Error Handling

> Match the project's existing HTTP client and error type. This describes a Dio-based setup and the
> behaviours that must exist regardless of the client.

## Client setup

```dart
// core/network/api_client.dart
Dio buildDio(AppConfig config) => Dio(BaseOptions(
  baseUrl: config.apiBaseUrl,               // .../api/v1
  connectTimeout: const Duration(seconds: 15),
  receiveTimeout: const Duration(seconds: 30),
  sendTimeout:    const Duration(seconds: 60),   // photo uploads
  headers: {'Accept': 'application/json'},
  validateStatus: (s) => s != null && s < 500,
))..interceptors.addAll([
  LocaleInterceptor(),
  AuthInterceptor(),
  IdempotencyInterceptor(),
  RetryInterceptor(),
  if (kDebugMode) LoggingInterceptor(),
]);
```

## Interceptors

### `LocaleInterceptor`
Adds `Accept-Language` from the current locale, plus `X-Client-Version` and `X-Device-Id`.

### `AuthInterceptor`
Attaches `Authorization: Bearer <token>`. On `401`:
1. pauses the queue,
2. calls `/auth/refresh` **once** (guard with a `Completer` so ten parallel 401s trigger one refresh),
3. retries the failed requests with the new token,
4. if refresh fails → clear the session, emit a global `SessionExpired` event, route to login.

Never let two refreshes race — that is how users get logged out randomly.

### `IdempotencyInterceptor`
For every `POST`/`PATCH`/`PUT`, attaches `Idempotency-Key`. The key comes from the request's
`clientUuid` when there is one, otherwise a fresh UUID v4 **generated once and reused across
retries** of the same logical operation. Generating a new key per retry defeats the whole purpose.

### `RetryInterceptor`
Retries only on: connection timeout, connection error, `502`/`503`/`504`. Exponential backoff
(1s, 2s, 4s), max 3 attempts. **Never** retries `4xx` — those are the client's fault and retrying
just wastes a bad connection.

## Result type

Match the project. If it has none, use a sealed result — not exceptions crossing layer boundaries:

```dart
sealed class ApiResult<T> {
  const ApiResult();
}
final class Success<T> extends ApiResult<T> {
  final T data;
  const Success(this.data);
}
final class Failure<T> extends ApiResult<T> {
  final AppFailure failure;
  const Failure(this.failure);
}
```

```dart
sealed class AppFailure {
  final String code;
  final String? serverMessage;
  const AppFailure(this.code, this.serverMessage);
}

final class NetworkFailure   extends AppFailure { … }  // no connection / timeout
final class ServerFailure    extends AppFailure { … }  // 5xx
final class ValidationFailure extends AppFailure {     // 400 with details
  final Map<String, String> fieldErrors;
}
final class AuthFailure      extends AppFailure { … }  // 401/403
final class ConflictFailure  extends AppFailure { … }  // 409
final class BusinessFailure  extends AppFailure { … }  // 422
final class NotFoundFailure  extends AppFailure { … }  // 404
final class OfflineFailure   extends AppFailure { … }  // no connection, op queued
```

The distinction between `ConflictFailure` and `BusinessFailure` drives UI behaviour:

| Failure | UI response |
|---|---|
| `ConflictFailure` (409) | "الوضع اتغير — حدّث الصفحة" + a refresh action |
| `BusinessFailure` (422) | explain what is wrong and what to change; no retry button |
| `NetworkFailure` | "مافيش اتصال" + retry, and for mutations: "اتحفظ محليًا وهيترفع لما النت يرجع" |
| `ValidationFailure` | map `fieldErrors` onto the form fields inline |

## Parsing the envelope

```dart
// success
{ "success": true, "data": {...}, "meta": {...} }
// error
{ "success": false, "error": { "code": "...", "message": "...", "details": [...], "requestId": "..." } }
```

A single `ResponseParser` handles both so no feature ever touches `response.data['data']` directly.

## Pagination

```dart
class PaginatedResponse<T> {
  final List<T> items;
  final int page, limit, total, totalPages;
  final bool hasNext;
  final String? nextCursor;    // keyset endpoints
}
```

Shared `PaginatedListView` widget in `core/widgets/` handles: initial load, pull-to-refresh, infinite
scroll at 80% scroll extent, an inline loader at the bottom, empty state and error state. Every list
screen uses it — do not reimplement pagination per feature.

## Timeouts and uploads

Photo and signature uploads use presigned URLs straight to storage (backend `19`), **not** the API
Dio instance. Use a separate bare Dio without the auth interceptor for those PUTs, with a long
`sendTimeout` and progress callbacks so the user sees movement on a slow connection.

## Logging

`LoggingInterceptor` in debug only. **Never log** `Authorization` headers, passwords, tokens, or
national IDs — redact them. Log the `requestId` from error responses so a user's screenshot can be
traced to a server log line.

## Rules

1. Repositories return `ApiResult`; cubits switch on it. **Exceptions never escape the data layer.**
2. Every mutating repository method checks connectivity first and, when offline, enqueues to the
   sync queue and returns an optimistic `Success` (see `07`).
3. No `BuildContext` in any networking or repository code.
4. Base URL comes from `AppConfig` via flavors — never a string literal in a datasource.
