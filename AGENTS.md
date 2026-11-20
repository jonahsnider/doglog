# AGENTS.md

DogLog is a logging library for FRC teams using Java.
DogLog Studio is a web and desktop app for reviewing and analyzing logs.

## DogLog

- Prioritize reliability, performance, simplicity, and usability in that order.

## DogLog Studio

- We use OpenSpec to describe features and expectations for the app
- Our workflow is fairly standard, but we don't use their change tracking feature
- When making changes to the app, consider if spec documents should be added or updated
- Do not mention specific products when writing comments/specs, only exception is if it's explicitly necessary (ex. "support AdvantageScope JSON")
- Follow `studio/DESIGN.md` for UI patterns (components, styling, color, motion), and update it when a pattern changes
- Run `pnpm check:dev` in `studio` to check your changes, it adds a React Doctor scan of changed files to `pnpm check`

### Testing web app

Ideally, most changes can be validated through the web app.

1. Check if a dev server is already running at `https://studio.doglog.dev.localhost` or `http://localhost:5173`
2. If not, start one with `pnpm dev` in the `studio` directory
3. Open a log by adding `?log=<url>` to the page URL, ex. `?log=/@fs/<absolute path to a .wpilog in this repository>`, since the file picker can't be automated (dev server only, errors are logged to the console)
4. Interact with the dev server using built-in browser tools
   - T3 Code browser tools can be buggy or missing features at times, use `agent-browser` as a fallback if necessary
   - Safari WebDriver MCP is available for WebKit specific testing

### Testing desktop app

Testing the desktop app is necessary for some features, but should only be used when you can't run the regular dev server.

1. Check if a Tauri dev app window is already open
2. Start a `tauri dev` session for it if not
3. Use the Tauri MCP to interact, falling back to `agent-desktop` if necessary
4. Once finished, end the `tauri dev` session

## General development

- You may see other changes in the main worktree, try to work around them if possible
  - When committing changes, you can use `--no-verify` to skip pre-commit checks that are failing from other work after you've verified your own changes are correct
