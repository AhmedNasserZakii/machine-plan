# 09 — Feature: Auth

Mobile counterpart: `mobile-app/lib/feature/auth/` (`login_screen`, `change_password_screen`).
Full mechanism is in `06`; this file is the screen spec.

## Endpoints

| Method | Path | Used by |
|---|---|---|
| POST | `auth/login` | login (via `/api/bff/login`) |
| POST | `auth/refresh` | BFF only, never the UI |
| POST | `auth/logout` | user menu |
| GET | `auth/me` | `(app)` layout; the session source of truth |
| POST | `auth/change-password` | forced + voluntary change |

`auth/biometric/enroll` and `auth/devices` are **mobile-only** and are not called from the web.

## `/login`

Layout: centred card on `--color-background`, brand mark, no marketing copy. Arabic by default.

Fields: phone (`dir="ltr"`, `inputMode="tel"`, `autoComplete="username"`), password
(`autoComplete="current-password"`, reveal toggle), locale switcher in the corner.

States:

| Outcome | UI |
|---|---|
| success | redirect to `?next` or `/`; `mustChangePassword` → `/change-password` |
| `INVALID_CREDENTIALS` | inline error under the fields, deliberately not saying which one was wrong |
| `ACCOUNT_INACTIVE` | full-card message: contact your director |
| `ACCOUNT_LOCKED` | message plus when it unlocks |
| 429 | disabled submit with a countdown (10 attempts / 15 min per phone+IP) |
| network | offline banner + retry |

No sign-up link. No forgot-password link — say "contact your director to reset a password"
instead of linking to a route that does not exist (`06`).

Autofocus the phone field. Submit on Enter from either field.

## `/change-password`

Two modes (`06`): **forced** (no shell, no escape) and **voluntary** (from `/settings/security`).

Fields: current, new, confirm. Live rules checklist (≥8 chars, reuse
`shared.password_min_eight`), strength hint, `autoComplete="new-password"`.

On success: invalidate `['session']`, toast, and route to `/` (forced) or stay (voluntary).
Handle `INVALID_CREDENTIALS` on the current-password field specifically.

## Session lifecycle in the UI

- `(app)/layout.tsx` fetches `/auth/me` once and provides it. A failure there renders the login
  redirect, not a broken shell.
- The BFF refreshes silently (`06`); the UI never sees a transient 401.
- A hard 401 (refresh token revoked or expired) clears cookies and redirects to
  `/login?next=<path>&reason=expired`, which shows "your session expired, sign in again".
- Logout clears cookies, clears the **entire** query cache (`queryClient.clear()`), and redirects.
  Not clearing the cache leaks the previous user's data into the next login on a shared machine —
  which in a warehouse office is a realistic scenario.

## Acceptance

- [ ] Tokens are never readable from `document.cookie` or any JS value.
- [ ] `mustChangePassword` cannot be bypassed by typing any other URL.
- [ ] Rate-limit response shows a countdown, not a generic error.
- [ ] Logout clears the query cache.
- [ ] Both screens verified in `ar` and `en`.
