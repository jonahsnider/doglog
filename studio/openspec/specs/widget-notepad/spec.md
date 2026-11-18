# widget-notepad Specification

## Purpose

Define the notepad widget, a Markdown notes field for writing things down without leaving Studio, such as gains tried while tuning.

## Requirements

### Requirement: No entries

The notepad SHALL NOT accept any entries, and MUST NOT offer Edit entries or show the "no entries" or "no data" states.

#### Scenario: Drop an entry

- **WHEN** the user drags an entry from the entry browser onto a notepad
- **THEN** the entry is not bound

### Requirement: Markdown highlighting

The notepad SHALL style Markdown with syntax highlighting instead of rendering it: the Markdown characters stay visible, and the text they mark is styled, ex. bold, italic, strikethrough, code, links, headings, and fenced code blocks. Text MUST keep a monospace font so styling never moves the caret.

#### Scenario: Bold text

- **WHEN** the user types `**kP** = 0.4`
- **THEN** `kP` is bold and the asterisks are still shown

### Requirement: Shared notes

Every notepad SHALL show the same notes, which MUST be saved, follow edits made in other windows, and be kept when notepads or dashboards are closed.

#### Scenario: Reload

- **GIVEN** a notepad with notes
- **WHEN** the user reloads Studio
- **THEN** the notepad shows the same notes

#### Scenario: Another dashboard

- **GIVEN** a notepad with notes
- **WHEN** the user adds a notepad to another dashboard
- **THEN** it shows the same notes
