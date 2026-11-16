# keyboard-shortcuts Specification

## Purpose

Define Studio's app-wide keyboard shortcuts and how they differ between the desktop app and the web, where browsers reserve some shortcuts. Timeline shortcuts are defined in the timeline spec.

## Requirements

### Requirement: Global shortcuts

Studio SHALL provide these shortcuts, using ⌘ on macOS and Ctrl on Windows and Linux: New dashboard (⌘T, or Alt+T), Close pane or dashboard (⌘W, or Alt+W), Close dashboard (⇧⌘W, or Alt+Shift+W), Settings (⌘, or Alt+,), Toggle sidebar (⌘B), Toggle key browser (⌥⌘B), Connect (⌘K), Split right (⌘D), Split down (⇧⌘D), Open log (⌘O), and Switch to dashboard 1-9 (⌘1-⌘9, or Alt+1-Alt+9).

#### Scenario: New dashboard

- **WHEN** the user presses Alt+T
- **THEN** a new dashboard is created the same way as pressing New dashboard

#### Scenario: Open Settings

- **WHEN** the user presses Alt+,
- **THEN** the Settings page opens

#### Scenario: Toggle sidebar

- **WHEN** the user presses ⌘B
- **THEN** the sidebar collapses or expands

#### Scenario: Split the focused pane

- **WHEN** the user presses ⌘D
- **THEN** the focused pane splits to the right, the same way as pressing Split right

#### Scenario: Open a log

- **WHEN** the user presses ⌘O
- **THEN** the file picker for opening a log opens

#### Scenario: Switch dashboards

- **GIVEN** there are at least three dashboards
- **WHEN** the user presses Alt+3
- **THEN** the third dashboard in the sidebar opens

#### Scenario: Connect

- **WHEN** the user presses ⌘K
- **THEN** Studio starts connecting, the same way as choosing Connect

### Requirement: Shortcuts in tooltips

Every control with a keyboard shortcut SHALL show the shortcut in its tooltip, formatted for the user's platform. All tooltips MUST use the same tooltip style, never the browser's native `title` tooltips.

#### Scenario: Hover a timeline button

- **WHEN** the user hovers the step forward button
- **THEN** its tooltip shows `Step forward` and `→`

#### Scenario: Hover the playback speed

- **WHEN** the user hovers the playback speed select
- **THEN** its tooltip shows `Playback speed` with `[` and `]`

### Requirement: Dashboard shortcut hints

While the user holds the modifier for switching dashboards (⌘ in the desktop app, Alt on the web) for 300 ms, each of the first nine dashboards in the sidebar SHALL show its switch shortcut on the right of its row.

#### Scenario: Hold the modifier

- **GIVEN** the user is using the web app with three dashboards
- **WHEN** the user holds Alt for 300 ms
- **THEN** the dashboards show Alt+1, Alt+2, and Alt+3 in sidebar order
- **AND** the hints disappear when Alt is released

### Requirement: Desktop-only shortcuts

⌘T, ⌘W, ⇧⌘W, ⌘, and ⌘1-⌘9 SHALL only be active in the desktop app, because browsers reserve them. Their Alt variants MUST work in both the desktop app and the web.

#### Scenario: Web app

- **GIVEN** the user is using the web app
- **WHEN** the user presses Alt+W
- **THEN** Studio closes the focused pane
- **AND** ⌘W is left to the browser

#### Scenario: Desktop app

- **GIVEN** the user is using the desktop app
- **WHEN** the user presses ⌘W
- **THEN** Studio closes the focused pane

### Requirement: App menu

On macOS, the desktop app SHALL list New dashboard, Open log, Close pane, and Close dashboard in its File menu, and Settings in its app menu, each with its shortcut.

#### Scenario: Open a log from the menu

- **GIVEN** the user is using the desktop app on macOS
- **WHEN** the user chooses File > Open Log…
- **THEN** the file picker for opening a log opens

### Requirement: Close pane or dashboard

The close shortcut SHALL close the focused pane. When the dashboard is down to a single empty pane, it MUST close the dashboard instead.

#### Scenario: Close a pane

- **GIVEN** a dashboard with two panes
- **WHEN** the user presses the close shortcut
- **THEN** the focused pane closes and the other pane fills the dashboard

#### Scenario: Close the last widget

- **GIVEN** a dashboard with a single pane holding a widget
- **WHEN** the user presses the close shortcut
- **THEN** the widget is removed and the pane becomes empty

#### Scenario: Close an empty dashboard

- **GIVEN** a dashboard with a single empty pane
- **WHEN** the user presses the close shortcut
- **THEN** the dashboard is deleted without a confirmation

### Requirement: Close the current dashboard

The close dashboard shortcut SHALL close the current dashboard the same way as any other dashboard close, including the confirmation rules.

#### Scenario: Close a dashboard with widgets

- **GIVEN** the current dashboard has widgets
- **WHEN** the user presses the close dashboard shortcut
- **THEN** the dashboard close confirmation opens

### Requirement: Shortcuts while typing

Shortcuts SHALL NOT trigger while the user is typing in a text field, except shortcuts that use ⌘ or Ctrl.

#### Scenario: Typing in search

- **GIVEN** the key browser search box is focused
- **WHEN** the user types a space
- **THEN** a space is typed and playback does not toggle
