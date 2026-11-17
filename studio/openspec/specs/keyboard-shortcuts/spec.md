# keyboard-shortcuts Specification

## Purpose

Define Studio's app-wide keyboard shortcuts and how they differ between the desktop app and the web, where browsers reserve some shortcuts. Timeline shortcuts are defined in the timeline spec.

## Requirements

### Requirement: Global shortcuts

Studio SHALL provide these shortcuts, using ⌘ on macOS and Ctrl on Windows and Linux: New dashboard (⌘T, or Alt+T), Close pane or dashboard (⌘W, or Alt+W), Close dashboard (⇧⌘W, or Alt+Shift+W), Reopen closed dashboard (⇧⌘T, or Alt+Shift+T), Undo (⌘Z), Redo (⇧⌘Z), Toggle sidebar (⌘B), Toggle entry browser (⌥⌘B), Connect (⌘K), Split right (⌘D), Split down (⇧⌘D), Zoom or restore pane (⇧⌘↩), Open log (⌘O), and Keyboard shortcuts (⌘/).

#### Scenario: New dashboard

- **WHEN** the user presses Alt+T
- **THEN** a new dashboard is created the same way as pressing New dashboard

#### Scenario: Reopen a closed dashboard

- **GIVEN** the user closed a dashboard
- **WHEN** the user presses Alt+Shift+T
- **THEN** the dashboard is reopened

#### Scenario: Undo in a text field

- **GIVEN** the user is renaming a dashboard
- **WHEN** the user presses ⌘Z
- **THEN** the text field undoes its typing and the dashboard is unchanged

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

### Requirement: Keyboard shortcuts list

The keyboard shortcuts shortcut SHALL open a dialog listing every keyboard shortcut, grouped by area and formatted for the user's platform. While the media controls setting is on, it SHALL also list the media keys. Pressing the shortcut again MUST close it.

#### Scenario: Open the list

- **WHEN** the user presses ⌘/
- **THEN** a dialog lists every keyboard shortcut, including the timeline's

#### Scenario: Web app

- **GIVEN** the user is using the web app
- **WHEN** the user opens the keyboard shortcuts list
- **THEN** New dashboard shows Alt+T

#### Scenario: Media controls on

- **GIVEN** media controls are on
- **WHEN** the user opens the keyboard shortcuts list
- **THEN** it lists the play/pause, previous track, and next track media keys

### Requirement: Shortcuts in tooltips

Every control with a keyboard shortcut SHALL show the shortcut in its tooltip, formatted for the user's platform. All tooltips MUST use the same tooltip style, never the browser's native `title` tooltips.

#### Scenario: Hover a timeline button

- **WHEN** the user hovers the step forward button
- **THEN** its tooltip shows `Step forward` and `.`

#### Scenario: Hover the playback speed

- **WHEN** the user hovers the playback speed select
- **THEN** its tooltip shows `Playback speed` with `[` and `]`

### Requirement: Shortcuts in menus

Every menu item with a keyboard shortcut SHALL show the shortcut on the right of the item, formatted for the user's platform.

#### Scenario: Open a dashboard's options

- **WHEN** the user opens a dashboard's options menu
- **THEN** Close dashboard shows ⇧⌘W, or Alt+Shift+W on the web

### Requirement: Navigation shortcuts

Studio SHALL provide shortcuts for the sidebar's pages: Logs (⌘L, or Alt+L), Settings (⌘, or Alt+,), and Switch to dashboard 1-9 (⌘1-⌘9, or Alt+1-Alt+9).

#### Scenario: Open Logs

- **WHEN** the user presses Alt+L
- **THEN** the Logs page opens

#### Scenario: Open Settings

- **WHEN** the user presses Alt+,
- **THEN** the Settings page opens

### Requirement: Sidebar shortcut hints

While the user holds the modifier for switching dashboards (⌘ in the desktop app, Alt on the web) for 300 ms, Logs, Settings, and each of the first nine dashboards in the sidebar SHALL show their shortcut on the right of their row.

#### Scenario: Hold the modifier

- **GIVEN** the user is using the web app with three dashboards
- **WHEN** the user holds Alt for 300 ms
- **THEN** Logs shows Alt+L and Settings shows Alt+,
- **AND** the dashboards show Alt+1, Alt+2, and Alt+3 in sidebar order
- **AND** the hints disappear when Alt is released

### Requirement: Desktop-only shortcuts

⌘T, ⌘W, ⇧⌘W, ⇧⌘T, ⌘L, ⌘, and ⌘1-⌘9 SHALL only be active in the desktop app, because browsers reserve them. Their Alt variants MUST work in both the desktop app and the web.

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

On macOS, the desktop app SHALL list New dashboard, Reopen closed dashboard, Open log, Close pane, and Close dashboard in its File menu, Undo and Redo in its Edit menu, and Settings in its app menu, each with its shortcut. Undo and Redo MUST act on the focused text field while one is focused.

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
- **THEN** the dashboard is closed

### Requirement: Close the current dashboard

The close dashboard shortcut SHALL close the current dashboard the same way as any other dashboard close.

#### Scenario: Close a dashboard with widgets

- **GIVEN** the current dashboard has widgets
- **WHEN** the user presses the close dashboard shortcut
- **THEN** the dashboard is closed without a confirmation

### Requirement: Shortcuts while typing

Shortcuts SHALL NOT trigger while the user is typing in a text field, except shortcuts that use ⌘ or Ctrl.

#### Scenario: Typing in search

- **GIVEN** the entry browser search box is focused
- **WHEN** the user types a space
- **THEN** a space is typed and playback does not toggle
