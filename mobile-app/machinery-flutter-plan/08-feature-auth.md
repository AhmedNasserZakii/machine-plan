# 08 — Feature: Authentication

## Screens

| Page | Route |
|---|---|
| `SplashPage` | `/` |
| `LoginPage` | `/login` |
| `ChangePasswordPage` | `/change-password` |

## Structure

```
features/auth/
├── data/
│   ├── models/ (login_request_model.dart, auth_user_model.dart, auth_tokens_model.dart)
│   ├── datasources/auth_remote_datasource.dart
│   └── repositories/auth_repository.dart
└── presentation/
    ├── cubit/ (auth_cubit.dart, auth_state.dart, login_cubit.dart, login_state.dart)
    ├── pages/ (splash_page.dart, login_page.dart, change_password_page.dart)
    └── widgets/
        ├── login_form.dart
        ├── login_logo_header.dart
        ├── phone_field.dart
        ├── password_field.dart
        ├── login_submit_button.dart
        ├── language_toggle_button.dart
        ├── biometric_login_button.dart
        └── password_strength_indicator.dart
```

Note: `login_form.dart`, `phone_field.dart` etc. are separate files — not private classes inside
`login_page.dart` (see `01`).

## AuthCubit — singleton, app-wide

```dart
sealed class AuthState {}
final class AuthInitial      extends AuthState {}
final class AuthChecking     extends AuthState {}
final class Authenticated    extends AuthState {
  final AuthUser user;
  final List<String> permissions;
}
final class Unauthenticated  extends AuthState { final String? reason; }
final class AuthFailureState extends AuthState { final AppFailure failure; }
```

## Splash flow

1. Read tokens from secure storage.
2. No token → `Unauthenticated` → `/login`.
3. Token present → call `/auth/me`:
   - success → cache user + permissions locally → `Authenticated`;
   - `401` → try refresh once → retry, else `Unauthenticated`;
   - **network error → use the locally cached user and permissions and proceed.**
     This is essential: a rep opening the app with no signal must still get in.
4. `mustChangePassword` → `/change-password` (blocking, no back).
5. Otherwise → `/home` + trigger `SyncService.flush()`.

## Login

```dart
class LoginRequest {
  final String phone;      // Egyptian format, normalised
  final String password;
  final String deviceId;
  final String? fcmToken;
}
```

Validation: phone matches `^(\+20|0)?1[0125]\d{8}$`, normalised to a canonical form before sending.
Password minimum 8 characters.

On success: store tokens in **secure storage** (never `SharedPreferences`), cache the user and
permission list locally, register the FCM token, run `/sync/bootstrap`.

Error mapping:
| Code | Message |
|---|---|
| `INVALID_CREDENTIALS` | "رقم التليفون أو الباسورد غلط" |
| `ACCOUNT_INACTIVE` | "الحساب موقوف — كلّم الإدارة" |
| `ACCOUNT_LOCKED` | "الحساب اتقفل مؤقتًا، جرّب بعد ١٥ دقيقة" |
| network | "مافيش اتصال بالإنترنت — أول دخول محتاج نت" |

## Biometric login (convenience, not authorization)

After a successful password login, offer: "تحب تدخل بالبصمة المرة الجاية؟"

If accepted, store the refresh token behind the platform keystore/keychain with
`local_auth` gating access. On next launch, `BiometricLoginButton` triggers a local
biometric check and, if it passes, uses the stored refresh token.

**Be clear about what this is:** biometric here unlocks a stored credential on this device. It is
convenience. The security boundary is still the refresh token. This is a different thing from
biometric *hand-off confirmation* (`14`), which is evidence, not authentication.

## Change password

Required when `mustChangePassword` is true. No back button, no skip. Fields: current, new, confirm.
`PasswordStrengthIndicator` gives live feedback. On success, all other devices' sessions are revoked
server-side — tell the user that.

## Logout

Confirm dialog. **If the sync queue is not empty, warn explicitly:**

> عندك ٣ عمليات لسه مترفعتش. لو خرجت دلوقتي ممكن تضيع. تحب ترفعها الأول؟
> [ارفع الأول] [اخرج برضه] [إلغاء]

On logout: revoke the refresh token, unregister the FCM token, clear secure storage, clear cached
data — **but keep the sync queue** unless the user explicitly discards it.

## Session expiry

A global listener on `AuthCubit`: when refresh fails, show a non-dismissible dialog
("الجلسة انتهت، سجّل دخول تاني") and route to login, preserving the sync queue.

## Rules

1. Tokens live in `flutter_secure_storage` only.
2. The permission list is cached locally so the app works offline — refreshed on every successful
   `/auth/me`.
3. `AuthCubit` is the only singleton cubit.
4. Never log or display tokens, even in debug.
