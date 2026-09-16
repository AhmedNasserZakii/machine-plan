# 03 — Theming & Design Tokens

> Every value here is a **literal port** of `mobile-app/lib/core/theme/styles/`.
> If a value differs from the Dart file, the Dart file is right and this is a bug.
> **Zero raw hex values and zero inline font sizes in `src/features/` or `src/app/`.**

## Source of truth

| Web file | Ported from |
|---|---|
| `src/styles/tokens.css` | `app_colors.dart`, `app_spacing.dart` |
| `src/lib/theme/text-styles.ts` | `app_text_styles.dart` |
| `src/lib/theme/status-tone.ts` | `status_colors.dart` |

## `tokens.css`

```css
/* The ONLY file in the project allowed to contain a hex colour. */
:root {
  /* ── Brand ─────────────────────────────────────────── */
  --color-primary:            #1B4965;
  --color-primary-light:      #3E7CA6;
  --color-secondary:          #5FA8D3;

  /* ── Surfaces ──────────────────────────────────────── */
  --color-background:         #F7F9FB;   /* scaffoldBackgroundColor */
  --color-surface:            #FFFFFF;
  --color-surface-alt:        #EDF2F7;

  /* ── Borders ───────────────────────────────────────── */
  --color-border:             #DDE3EA;
  --color-divider:            #E8E9F1;

  /* ── Text ──────────────────────────────────────────── */
  --color-text-primary:       #1A202C;
  --color-text-secondary:     #4A5568;
  --color-text-disabled:      #A0AEC0;
  --color-text-placeholder:   #A0AEC0;
  --color-text-on-primary:    #FFFFFF;

  /* ── Semantic ──────────────────────────────────────── */
  --color-success:            #2F855A;
  --color-warning:            #D69E2E;
  --color-danger:             #C53030;
  --color-info:               #2B6CB0;
  --color-neutral:            #718096;

  /* ── Semantic surfaces (chips, banners, badges) ────── */
  --color-success-surface:    #E6F4EC;
  --color-warning-surface:    #FDF3E1;
  --color-danger-surface:     #FCE8E8;
  --color-info-surface:       #E7F0FA;
  --color-neutral-surface:    #EDF2F7;

  /* ── States ────────────────────────────────────────── */
  --color-disabled-button:    #E2E8F0;
  --color-offline-banner:     #4A5568;
  --color-badge:              #C53030;
  --color-shimmer-base:       #EDF2F7;
  --color-scrim:              rgb(0 0 0 / 0.80);

  /* ── Spacing (AppSpacing) ──────────────────────────── */
  --spacing-xs:  4px;
  --spacing-sm:  8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
  --spacing-xxl:48px;

  /* ── Radius (AppRadius) ────────────────────────────── */
  --radius-sm:   8px;
  --radius-md:  12px;
  --radius-lg:  16px;
  --radius-pill:999px;

  /* ── Elevation — web-only; mobile uses Material elevation ── */
  --shadow-card:   0 1px 2px rgb(26 32 44 / 0.06), 0 1px 3px rgb(26 32 44 / 0.08);
  --shadow-popover:0 4px 6px rgb(26 32 44 / 0.06), 0 10px 20px rgb(26 32 44 / 0.10);

  /* ── Layout — web-only ─────────────────────────────── */
  --sidebar-width:          264px;
  --sidebar-width-collapsed: 72px;
  --topbar-height:           64px;
  --content-max-width:     1440px;
}
```

Wire them into Tailwind v4 so `bg-surface`, `text-danger`, `p-md`, `rounded-pill` exist:

```css
/* globals.css */
@import "tailwindcss";
@import "./tokens.css";

@theme inline {
  --color-primary: var(--color-primary);
  --color-surface: var(--color-surface);
  /* …one line per token above… */
  --spacing-md: var(--spacing-md);
  --radius-md:  var(--radius-md);
}
```

## Status tone — one source of truth

The direct counterpart of `StatusColors`. Statuses appear on chips, table cells, filter pills,
timelines and report legends; they are defined **once** and consumed everywhere.

```ts
// src/lib/theme/status-tone.ts
export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'primary';

export const MACHINE_STATUS_TONE: Record<MachineStatus, Tone> = {
  IN_COMPANY_WAREHOUSE: 'neutral',
  IN_BRANCH_WAREHOUSE:  'info',
  WITH_SUPERVISOR:      'info',
  WITH_REPRESENTATIVE:  'primary',
  WITH_MERCHANT:        'success',
  IN_TRANSIT:           'warning',
  UNDER_MAINTENANCE:    'warning',
  AT_FACTORY:           'warning',
  AT_SERVICE_CENTER:    'warning',
  REPLACED:             'neutral',
  DECOMMISSIONED:       'danger',
};

export const TRANSFER_STATUS_TONE: Record<TransferStatus, Tone> = {
  PENDING: 'warning', CONFIRMED: 'success', REJECTED: 'danger', CANCELLED: 'neutral',
};

export const MAINTENANCE_STATUS_TONE: Record<MaintenanceStatus, Tone> = {
  OPEN: 'info', IN_PROGRESS: 'warning', RETURNED: 'primary',
  CLOSED: 'success', CANCELLED: 'neutral',
};

export const VIOLATION_STATUS_TONE: Record<ViolationStatus, Tone> = {
  OPEN: 'warning', ACKNOWLEDGED: 'info', WAIVED: 'neutral',
  CHARGED: 'danger', CLOSED: 'success',
};

export const SEVERITY_TONE: Record<Severity, Tone> = {
  LOW: 'info', MEDIUM: 'warning', HIGH: 'danger',
};

export const BUDGET_TONE: Record<BudgetStatus, Tone> = {
  OK: 'success', WARNING: 'warning', EXCEEDED: 'danger',
};
```

**Never rely on colour alone.** Every `StatusChip` renders an icon *and* a localized label beside
the tone. This is an accessibility requirement, not a preference — and the same rule the mobile
plan states for sunlight readability.

## Typography

**Cairo** for both locales, exactly as the mobile app — one family covering Arabic and Latin, so
switching locale does not reflow the page into a different typeface.

```ts
// src/app/[locale]/layout.tsx
import { Cairo, Roboto_Mono } from 'next/font/google';

const cairo = Cairo({ subsets: ['arabic', 'latin'], variable: '--font-sans',
                      weight: ['400','500','600','700'], display: 'swap' });
const mono  = Roboto_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });
```

The mobile `Styles.sNN(context)` helpers are size-named. The web equivalent is a small set of
semantic classes, because on the web a `<h2>` carries meaning that a Flutter `Text` does not:

| Class | Size / weight / line-height | Mobile counterpart |
|---|---|---|
| `.t-h1` | 24 / 700 / 1.4 | `Styles.s24` bold |
| `.t-h2` | 20 / 700 / 1.4 | `Styles.s20` bold |
| `.t-h3` | 17 / 600 / 1.4 | `Styles.s16`/`s18` semibold |
| `.t-body-lg` | 16 / 400 / 1.6 | `Styles.s16` |
| `.t-body` | 14 / 400 / 1.6 | `Styles.s14` |
| `.t-label` | 13 / 500 / 1.5 | `Styles.s13` |
| `.t-caption` | 12 / 400 / 1.5 | `Styles.s12` |
| `.t-button` | 15 / 600 / 1.5 | `Styles.s15` |
| `.t-mono` | 14 / 400, `font-mono`, `font-variant-numeric: tabular-nums` | `Styles.mono` |

`line-height: 1.6` on body text is not decorative — it is what stops Arabic descenders colliding.
Do not tighten it for a denser table; tighten the row padding instead.

Use `.t-mono` for **serials, amounts, counts and IDs** in tables. Tabular figures keep a currency
column aligned, which is the difference between a readable financial table and a bad one.

## RTL — Arabic is the default locale

1. `<html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>` in the locale layout. Everything
   else follows from that plus logical properties.
2. **Only logical utilities.** `ps-md`/`pe-md`, `ms-`/`me-`, `start-0`/`end-0`, `text-start`,
   `border-s`/`border-e`, `rounded-s-md`. Lint bans `pl-`, `pr-`, `ml-`, `mr-`, `left-`, `right-`,
   `text-left`, `text-right` outside `components/ui/`.
3. **Directional icons flip.** Chevrons, arrows, "next page". Use a `<DirectionalIcon>` wrapper
   that applies `rtl:-scale-x-100`. Non-directional icons (trash, check, download) must **not** flip.
4. **LTR islands inside RTL text.** Serials, phone numbers, amounts, IDs and dates render inside
   `<bdi dir="ltr" class="t-mono">`. Without this, `SN-00341` renders as `341-00SN` in an Arabic
   paragraph. Ship `<SerialText>`, `<Money>`, `<PhoneText>` in `components/common/` so nobody has
   to remember.
5. **Charts flip too.** Recharts does not read `dir`. Reverse the category axis and set legend
   alignment from the locale — wrap it once in `components/charts/` rather than per chart.
6. **Tables flip.** Column order reverses in RTL; the first column is still the identifier.
   Sticky columns must stick to the *inline-start* edge.
7. Test every screen in both locales. Right in Arabic and broken in English is a bug, and so is
   the reverse.

## Numbers, dates and money

- Digits: **Western Arabic numerals (0-9) in both locales.** The mobile app does this and the
  finance team reads them this way. Configure `next-intl` with `numberingSystem: 'latn'` for `ar`.
- Dates: Gregorian, `dd/MM/yyyy` display, ISO on the wire. Arabic month names via `date-fns/locale/ar`.
- Money: `formatMoney(amount, { currency: 'EGP' })` in `lib/format/money.ts`, `.t-mono`,
  two decimals, thousands separators, symbol on the inline-start. Negative amounts are
  `text-danger` with a real minus sign, never parentheses.

## Density

Web tables get a **compact** and a **comfortable** density toggle, persisted per user in
`localStorage`. Row height: compact `40px`, comfortable `52px`. Default comfortable — these are
users who read a machine serial and then act on it, not traders scanning a tape.

## Dark mode

Same posture as the mobile plan: **out of scope for v1**, structured so it is a token swap later.
Write `:root[data-theme="dark"] { … }` overrides in `tokens.css` when the time comes. Do **not**
scatter `dark:` variants through feature code in the meantime — a half-done dark mode is worse
than none.

## Focus, hit targets and print

- Visible focus ring on every interactive element: `outline: 2px solid var(--color-primary);
  outline-offset: 2px`. Never `outline: none` without a replacement.
- Minimum click target `32×32px` on desktop, `44×44px` under `(pointer: coarse)` — a supervisor
  on a tablet in a warehouse is a real user.
- `print.css` hides the sidebar, topbar, filters and action buttons, forces `background: white`,
  expands tables to full width and repeats `<thead>` on each page. Reports and transfer receipts
  get printed. Budget for it from the start.
