# 03 — Theming & Design Tokens

> If the project already has a theme system, use it and skip to the RTL and status-colour sections.
> **Zero hardcoded `Color(0xFF…)` or inline `TextStyle` anywhere in feature code.**

## Token files

```
core/theme/
├── app_colors.dart
├── app_text_styles.dart
├── app_spacing.dart
├── app_radius.dart
├── app_shadows.dart
└── app_theme.dart
```

## Colours

Semantic names, not visual ones. `AppColors.danger`, never `AppColors.red`.

```dart
abstract final class AppColors {
  // brand
  static const primary       = Color(0xFF1B4965);
  static const primaryLight  = Color(0xFF3E7CA6);
  static const secondary     = Color(0xFF5FA8D3);

  // surfaces
  static const background    = Color(0xFFF7F9FB);
  static const surface       = Color(0xFFFFFFFF);
  static const surfaceAlt    = Color(0xFFEDF2F7);
  static const border        = Color(0xFFDDE3EA);

  // text
  static const textPrimary   = Color(0xFF1A202C);
  static const textSecondary = Color(0xFF4A5568);
  static const textDisabled  = Color(0xFFA0AEC0);
  static const textOnPrimary = Color(0xFFFFFFFF);

  // semantic
  static const success = Color(0xFF2F855A);
  static const warning = Color(0xFFD69E2E);
  static const danger  = Color(0xFFC53030);
  static const info    = Color(0xFF2B6CB0);
  static const neutral = Color(0xFF718096);
}
```

## Machine status colours — one source of truth

Status colours appear on cards, chips, filters, timelines and reports. Define them **once**:

```dart
// core/theme/status_colors.dart
abstract final class StatusColors {
  static Color forMachineStatus(MachineStatus s) => switch (s) {
    MachineStatus.inCompanyWarehouse => AppColors.neutral,
    MachineStatus.inBranchWarehouse  => AppColors.info,
    MachineStatus.withSupervisor     => AppColors.info,
    MachineStatus.withRepresentative => AppColors.primaryLight,
    MachineStatus.withMerchant       => AppColors.success,
    MachineStatus.inTransit          => AppColors.warning,
    MachineStatus.underMaintenance   => AppColors.warning,
    MachineStatus.atFactory          => AppColors.warning,
    MachineStatus.atServiceCenter    => AppColors.warning,
    MachineStatus.replaced           => AppColors.neutral,
    MachineStatus.decommissioned     => AppColors.danger,
  };

  static Color forTransferStatus(TransferStatus s) => switch (s) {
    TransferStatus.pending   => AppColors.warning,
    TransferStatus.confirmed => AppColors.success,
    TransferStatus.rejected  => AppColors.danger,
    TransferStatus.cancelled => AppColors.neutral,
  };

  static Color forViolationSeverity(Severity s) => switch (s) {
    Severity.low    => AppColors.info,
    Severity.medium => AppColors.warning,
    Severity.high   => AppColors.danger,
  };

  static Color forBudgetStatus(BudgetStatus s) => switch (s) {
    BudgetStatus.ok       => AppColors.success,
    BudgetStatus.warning  => AppColors.warning,
    BudgetStatus.exceeded => AppColors.danger,
  };
}
```

**Never** rely on colour alone to carry meaning — every status chip shows an icon and a label too.
Field staff use these phones in sunlight.

## Typography

Arabic needs a font with proper Arabic glyphs. **Cairo** or **Tajawal** work well and both have
Latin coverage, so one family serves both locales — which avoids jarring font switches.

```dart
abstract final class AppTextStyles {
  static const _family = 'Cairo';

  static const h1        = TextStyle(fontFamily: _family, fontSize: 24, fontWeight: FontWeight.w700, height: 1.4);
  static const h2        = TextStyle(fontFamily: _family, fontSize: 20, fontWeight: FontWeight.w700, height: 1.4);
  static const h3        = TextStyle(fontFamily: _family, fontSize: 17, fontWeight: FontWeight.w600, height: 1.4);
  static const bodyLarge = TextStyle(fontFamily: _family, fontSize: 16, fontWeight: FontWeight.w400, height: 1.6);
  static const body      = TextStyle(fontFamily: _family, fontSize: 14, fontWeight: FontWeight.w400, height: 1.6);
  static const caption   = TextStyle(fontFamily: _family, fontSize: 12, fontWeight: FontWeight.w400, height: 1.5);
  static const button    = TextStyle(fontFamily: _family, fontSize: 15, fontWeight: FontWeight.w600);

  /// Serial numbers, amounts, counts. Tabular figures keep columns aligned.
  static const mono      = TextStyle(fontFamily: 'RobotoMono', fontSize: 14,
                                     fontFeatures: [FontFeature.tabularFigures()]);
}
```

Arabic line height needs to be more generous than Latin — `height: 1.6` on body text is not optional,
it is what stops Arabic descenders colliding.

## Spacing & radius

```dart
abstract final class AppSpacing {
  static const xs = 4.0;  static const sm = 8.0;  static const md = 16.0;
  static const lg = 24.0; static const xl = 32.0; static const xxl = 48.0;
}

abstract final class AppRadius {
  static const sm = 8.0; static const md = 12.0; static const lg = 16.0; static const pill = 999.0;
}
```

## RTL — this app is Arabic-first

1. `MaterialApp.localizationsDelegates` includes `GlobalWidgetsLocalizations.delegate`; direction
   follows the locale automatically.
2. **Never** use `EdgeInsets.only(left:)` / `right:`. Always `EdgeInsetsDirectional.only(start:, end:)`.
3. **Never** `Alignment.centerLeft`. Always `AlignmentDirectional.centerStart`.
4. Directional icons (`arrow_back`, `chevron_right`) must flip. Use `Icons.arrow_back` with
   `Directionality`-aware widgets, or `Transform.scale(scaleX: isRtl ? -1 : 1)` for custom art.
5. Numbers, serials and amounts stay **LTR inside RTL text** — wrap them:
   ```dart
   Directionality(textDirection: TextDirection.ltr, child: Text(machine.serial))
   ```
   Without this, `SN-00341` renders as `341-00SN` inside an Arabic paragraph.
6. Test every screen in both locales. A screen that looks right in Arabic and broken in English is
   a bug, and vice versa.

## Touch targets

Minimum **48×48 dp** on every tappable element. Representatives use this app one-handed, standing,
sometimes wearing gloves. The signature "confirm" button should be large and unmissable.

## Dark mode

Out of scope for v1 — but structure the theme with `ThemeData.light()` and a token layer so adding
`ThemeData.dark()` later is a token swap, not a rewrite. Do not scatter `Theme.of(context).brightness`
checks through feature code.
