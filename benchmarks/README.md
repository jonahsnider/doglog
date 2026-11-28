# DogLog benchmarks

## Run the suite

Run from the repo root with Node 26 and the repo's pinned pnpm. For the full suite, use a logged-in macOS desktop session.

- **Desktop:** Install the Xcode command-line tools and put both apps in `/Applications`. Clear first-launch prompts, disconnect live sources, select the same lightweight layout in both apps (such as an empty line graph), and quit them before running.
- **Chrome:** Install Chrome and `uv`, and authenticate `gh` unless using `--lite-dir`. Keep Chrome visible and leave ports 4173 and 5808 free. The loopback URL below satisfies the build without a running Convex backend or Studio account.

```sh
pnpm install --frozen-lockfile
export VITE_CONVEX_URL=http://127.0.0.1:3210
pnpm --filter @doglog/benchmarks suite --fixtures /path/to/fixtures.json
```

Each run writes `benchmark-report.md` and raw JSONL under a new `benchmarks/results/` folder. The default is 10 samples per app and workload, and one size measurement per installed bundle. Use `--runs 1` to check your setup. Omit `--fixtures` to run startup, size, and the Chrome stock 3D field check without opening logs.

## Fixtures

Save a JSON array with paths relative to that file or absolute paths. Use real logs around 50, 100, and 150 MB. Each `signal` must be a numeric entry in that log. `scopeSignal` names the same HOOT channel in AdvantageScope when its entry path differs.

```json
[
	{ "path": "match-50mb.wpilog", "signal": "/Robot/SystemStats/BatteryVoltage" },
	{ "path": "match-100mb.wpilog", "signal": "/Robot/SystemStats/BatteryVoltage" },
	{ "path": "practice-150mb.wpilog", "signal": "/Robot/SystemStats/BatteryVoltage" },
	{
		"path": "match.hoot",
		"signal": "/Phoenix6/rio/TalonFX-17/MotorVoltage",
		"scopeSignal": "Phoenix6/TalonFX-17/MotorVoltage"
	}
]
```

For desktop log checks, use macOS 14.2 or newer in English and grant the terminal Screen Recording and Accessibility permissions. In each app, save one line graph in one window (at least 640 × 400 points). Use a colored line, keep legends visible, hide entry browsers, and use the full log time range. Open each fixture once in both apps and confirm **only the intended trace draws**. The apps may decode different HOOT channels; clear any decoder or license prompts yourself. Close the logs before quitting, and leave the desktop alone during the run.

Chrome configures its own graphs and streams WPILOGs over loopback HTTP. HOOT runs on desktop only.

## Run a subset

```sh
pnpm --filter @doglog/benchmarks suite --only macos --runs 3 --fixtures /path/to/fixtures.json
pnpm --filter @doglog/benchmarks suite --only chrome --fixtures /path/to/fixtures.json
pnpm --filter @doglog/benchmarks suite --only wpilog-local --fixtures /path/to/fixtures.json
pnpm --filter @doglog/benchmarks suite --only field
pnpm --filter @doglog/benchmarks suite --only size
pnpm --filter @doglog/benchmarks suite --help
```

For one WPILOG, pass `--wpilog /path/to/match.wpilog --signal '/Robot/SystemStats/BatteryVoltage'` instead of a fixture list. Add `--local-file` to include that file in both the macOS and Chrome checks on a full run.

For installer size, add both `--studio-dmg /path/to/Studio.dmg` and `--advantagescope-dmg /path/to/AdvantageScope.dmg` matching the installed builds and architectures. For another Lite build, pass `--lite-run <GitHub Actions run ID>` and `--lite-version <version>` together (default: v27.0.0-beta-1). To rerun after an artifact expires, keep the unpacked `advantagescopelite-desktop` artifact and pass `--lite-dir <path>` and `--lite-version <version>` instead.

```sh
pnpm --filter @doglog/benchmarks report /path/to/results/*.jsonl
```
