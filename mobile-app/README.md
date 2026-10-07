# machinery

Flutter client for the Machinery custody / POS system.

## Build stage (manual)

Edit **one file** before you build or run:

`config/active_stage.env`

```bash
FLAVOR=development   # development | staging | production
MODE=debug            # debug | profile | production
```

Then:

```bash
./scripts/run_flavor.sh        # flutter run with that stage
./scripts/run_flavor.sh apk    # flutter build apk with that stage
```

| MODE | Flutter flag |
|------|----------------|
| `debug` | `--debug` |
| `profile` | `--profile` |
| `production` | `--release` |

`FLAVOR` picks the Android/iOS product flavor and loads `config/<flavor>.env.json` (`APP_ENV`, `API_BASE_URL`, store URLs).

Optional overrides without editing the file:

```bash
./scripts/run_flavor.sh staging apk
./scripts/run_flavor.sh production apk --mode=production
```

> Plain `flutter build apk` is not enough: this app has product flavors and dart-defines. Always use `./scripts/run_flavor.sh` so flavor + mode + env file stay in sync.
