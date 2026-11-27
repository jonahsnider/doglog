# DogLog benchmarks

## Run the suite

Use a logged-in macOS desktop session.

- **Desktop checks:** Install the Xcode command-line tools, DogLog Studio, and AdvantageScope. Put both apps in `/Applications`, clear first-launch prompts, and quit both.
- **Chrome checks:** Install Chrome and `uv`, authenticate `gh`, and set `VITE_CONVEX_URL` for the Studio build. Keep Chrome visible and leave ports 4173 and 5808 free.

From the repo root:

```sh
pnpm install --frozen-lockfile
pnpm --filter @doglog/benchmarks suite
```

Each run writes `benchmark-report.md` and raw JSONL under a new `benchmarks/results/` folder. The default is 10 timed samples per app and one size measurement per installed bundle.

```sh
pnpm --filter @doglog/benchmarks suite --only macos --runs 3
pnpm --filter @doglog/benchmarks suite --only chrome --runs 3
pnpm --filter @doglog/benchmarks suite --help
```

The suite uses Lite v27.0.0-beta-1 by default. To use another build, pass `--lite-run <GitHub Actions run ID>` and `--lite-version <version>` together.

## Chrome WPILOG open-to-graph

Use a local `.wpilog` file and the full path of a numeric entry in it. Drop `--only wpilog` to include this check in the full suite.

```sh
pnpm --filter @doglog/benchmarks suite --only wpilog \
  --wpilog /path/to/match.wpilog --signal '/Robot/SystemStats/BatteryVoltage'
```

## macOS size only

```sh
pnpm --filter @doglog/benchmarks suite --only size
```

To also measure installer downloads, add both `--studio-dmg /path/to/Studio.dmg` and `--advantagescope-dmg /path/to/AdvantageScope.dmg`. Use the DMGs for the exact installed builds and architectures. This check reads the files without mounting them.

## Individual commands

Use the individual commands for custom app paths, already-running web servers, or saved results:

```sh
pnpm --filter @doglog/benchmarks startup:macos --help
pnpm --filter @doglog/benchmarks startup:chrome --help
pnpm --filter @doglog/benchmarks report --help
```
