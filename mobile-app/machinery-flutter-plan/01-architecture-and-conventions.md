# 01 — Architecture & Conventions

## The #1 rule

**Adapt to the existing project. Never impose a new structure, package, or pattern on code that
already has its own conventions.**

If the project uses Cubit, this plan's Cubit examples apply directly. If it uses Riverpod, GetX,
Provider or BLoC, translate the *requirements* into that — the state shapes and business rules in
these files are the deliverable, not the specific class names.

## Discovery checklist (run before every feature)

- [ ] `pubspec.yaml` read — all packages and versions known
- [ ] `main.dart` / `app.dart` read — bootstrap understood
- [ ] one complete existing feature read end to end
- [ ] **state management** identified: BLoC / Cubit / Riverpod / Provider / GetX / MobX
- [ ] **navigation** identified: GoRouter / AutoRoute / Navigator 1.0 / custom
- [ ] **localization** identified: ARB + gen-l10n / easy_localization / custom JSON
- [ ] **theming** identified: ThemeData / ThemeExtension / custom tokens
- [ ] **DI** identified: GetIt / Riverpod / Provider / manual
- [ ] **networking** identified: Dio / http / Chopper / Retrofit
- [ ] **serialization** identified: freezed / json_serializable / manual
- [ ] **error handling** identified: Either / Result / try-catch
- [ ] **naming conventions** identified: file suffixes, class suffixes, folder names
- [ ] `analysis_options.yaml` read

Then state in one sentence which existing feature you are mirroring, and start.

## Zero-drift rules

- **No new top-level folders** in `lib/` unless there is a real structural gap
- **No new architectural layers** — no `domain/` if none exists, no use cases if none exist
- **No new state management library** — ever
- **No new base classes or abstractions** unless similar ones already exist
- **No renaming conventions** — if they call it `Controller`, you call it `Controller`
- **No reformatting** unrelated files
- **No silent improvements** to unrelated code — flag in a comment instead

## Packages — zero new dependencies without approval

Do not run `flutter pub add` on your own. Do not propose replacements for packages already in use.
If a task genuinely requires a new package, stop, explain why, propose it with justification, and
wait for approval.

The features in this plan will realistically need capabilities in these areas. **Check whether the
project already has an equivalent before proposing anything:**

| Capability | Needed for | Typical package |
|---|---|---|
| local database | offline queue and cache (`07`) | drift / isar / sembast / sqflite |
| secure storage | tokens, biometric flags | flutter_secure_storage |
| biometrics | hand-off confirmation (`14`) | local_auth |
| signature canvas | drawn signatures (`14`) | signature |
| QR/barcode scanning | serial capture (`12`) | mobile_scanner |
| camera / gallery | condition photos, invoices | image_picker |
| image compression | field upload over bad networks (`13`) | flutter_image_compress |
| connectivity | online/offline detection (`07`) | connectivity_plus |
| background sync | flushing the queue (`07`) | workmanager |
| push notifications | (`20`) | firebase_messaging |
| device info | signature evidence | device_info_plus |
| file open/share | report exports (`19`) | open_filex / share_plus |

## THE WIDGET SEPARATION RULE — non-negotiable

**Every widget lives in its own file inside the feature's `widgets/` folder. No exceptions.**

Never define helper or child widgets as private classes (`_MyWidget`) inside a screen or page file.
Every widget — no matter how small — gets its own `.dart` file in the `widgets/` folder of that
feature.

### ❌ Wrong

```dart
// lib/features/machines/presentation/pages/machines_page.dart
class MachinesPage extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Column(children: [
    _MachineHeader(), _MachineList(), _EmptyState(),
  ]);
}

class _MachineHeader extends StatelessWidget { … }   // ❌ must not be here
class _MachineList extends StatelessWidget { … }     // ❌
class _EmptyState extends StatelessWidget { … }      // ❌
```

### ✅ Right

```
lib/features/machines/presentation/
├── pages/
│   └── machines_page.dart          ← only the page, imports widgets
└── widgets/
    ├── machine_header.dart
    ├── machine_list.dart
    ├── machine_card.dart
    └── empty_state.dart
```

```dart
// lib/features/machines/presentation/pages/machines_page.dart
import '../widgets/machine_header.dart';
import '../widgets/machine_list.dart';
import '../widgets/empty_state.dart';

class MachinesPage extends StatelessWidget {
  const MachinesPage({super.key});

  @override
  Widget build(BuildContext context) => Column(children: const [
    MachineHeader(), MachineList(), EmptyState(),
  ]);
}
```

### The rules in full

1. **One widget per file**, named in `snake_case` after the class (`MachineCard` → `machine_card.dart`).
2. **`widgets/` sits as a sibling to `pages/`** (or `screens/` — mirror whatever the project uses).
3. **No private widget classes in page files.** A page contains only the page widget.
4. **Public classes, not private.** Widgets used by exactly one page still go in `widgets/`.
5. **Inline widget trees are fine.** `Padding(...)`, `Row(children: [...])` directly in `build()` is
   correct. The rule triggers only when you would create a *named class* extending
   `StatelessWidget` / `StatefulWidget`.
6. **Barrel exports** — if the project uses them, add the new widget to the feature's barrel.
7. **When refactoring**, extract any private widgets you encounter in a file you are touching,
   rename them without the underscore, update imports, and note the move in your checklist.

### Decision flowchart

```
About to write a class extending StatelessWidget / StatefulWidget?
  ├─ Yes → Is it the main page/screen widget for this feature?
  │          ├─ Yes → pages/ (or screens/)
  │          └─ No  → widgets/, its own file
  └─ No (inline tree) → carry on
```

## Code output format

Deliver code file by file with the full path as a header comment:

```dart
// lib/features/transfers/presentation/cubit/transfers_cubit.dart
```

After the code, always provide:
- **Files created/modified** with a one-line purpose each
- **Widgets extracted** — every file created under `widgets/`
- **Commands to run** (`dart run build_runner build`, `flutter gen-l10n`, …)
- **Manual steps** (register in DI, add to router, add l10n keys to which files)
- **Patterns followed** and any **deviations** with reasons

## Code quality

- Follow `analysis_options.yaml` — zero new warnings
- Match existing style: indentation, trailing commas, import ordering, comment style
- Full null safety — no `!` unless the codebase already does it that way
- No `// TODO: implement`, no pseudo-code — production-ready only
- `const` constructors everywhere possible
- No deprecated APIs; if the project uses one consistently, flag once and keep consistent

## When in doubt — ask

One clarifying question beats 200 lines of wrong-pattern code. Ask when two features use different
patterns, when conventions are inconsistent, or when a task needs something no existing package
provides.

## Definition of done

- [ ] follows the existing project structure exactly
- [ ] only existing packages used (or new ones explicitly approved)
- [ ] same state management, routing, DI, networking and error patterns as siblings
- [ ] **every widget in its own file under `widgets/`; no private widget classes in page files**
- [ ] new strings added to existing localization files in the existing key style
- [ ] zero hardcoded colours or text styles — theme tokens only
- [ ] naming matches existing conventions
- [ ] no unrelated files modified
- [ ] `build_runner` / `gen-l10n` noted if needed
- [ ] lint passes with zero new warnings
- [ ] indistinguishable in style from the rest of the codebase
