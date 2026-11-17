# AGENTS.md

DogLog is a logging library for FRC teams using Java.
DogLog Studio is a web and desktop app for reviewing and analyzing logs.

## DogLog

- Prioritize reliability, performance, simplicity, and usability in that order.

## DogLog Studio

- We use OpenSpec to describe features and expectations for the app
- Our workflow is fairly standard, but we don't use their change tracking feature
- When making changes to the app, consider if spec documents should be added or updated
- Follow `studio/DESIGN.md` for UI patterns (components, styling, color, motion), and update it when a pattern changes
- The dev server (`pnpm dev` in `studio`) runs at https://studio.doglog.dev.localhost, https://studio.doglog.dev is production
- Run `pnpm check:dev` in `studio` to check your changes, it adds a React Doctor scan of changed files to `pnpm check`

## General development

- You may see other changes in the main worktree, try to work around them if possible
  - When committing changes, you can use --no-verify to skip pre-commit checks that are failing from other work
