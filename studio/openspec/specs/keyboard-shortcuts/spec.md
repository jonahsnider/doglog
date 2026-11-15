# keyboard-shortcuts Specification

## Purpose

Define Studio's app-wide keyboard shortcuts and how they differ between the desktop app and the web, where browsers reserve some shortcuts. Timeline shortcuts are defined in the timeline spec.

## Requirements

### Requirement: Global shortcuts

Studio SHALL provide these shortcuts, using ⌘ on macOS and Ctrl on Windows and Linux: New dashboard (⌘T, or Alt+T), Close pane or dashboard (⌘W, or Alt+W), Settings (⌘, or Alt+,), Toggle sidebar (⌘B), Toggle key browser (⌥⌘B), and Quick connect (⌘K).

#### Scenario: New dashboard

- **WHEN** the user presses Alt+T
- **THEN** a new dashboard is created the same way as pressing New dashboard

#### Scenario: Open Settings

- **WHEN** the user presses Alt+,
- **THEN** the Settings page opens

#### Scenario: Toggle sidebar

- **WHEN** the user presses ⌘B
- **THEN** the sidebar collapses or expands

#### Scenario: Quick connect

- **WHEN** the user presses ⌘K
- **THEN** Studio starts quick connect

### Requirement: Shortcuts in tooltips

Every control with a keyboard shortcut SHALL show the shortcut in its tooltip, formatted for the user's platform. All tooltips MUST use the same tooltip style, never the browser's native `title` tooltips.

#### Scenario: Hover a timeline button

- **WHEN** the user hovers the step forward button
- **THEN** its tooltip shows `Step forward` and `→`

#### Scenario: Hover the playback speed

- **WHEN** the user hovers the playback speed select
- **THEN** its tooltip shows `Playback speed` with `[` and `]`

### Requirement: Desktop-only shortcuts

⌘T, ⌘W, and ⌘, SHALL only be active in the desktop app, because browsers reserve them. Their Alt variants MUST work in both the desktop app and the web.

#### Scenario: Web app

- **GIVEN** the user is using the web app
- **WHEN** the user presses Alt+W
- **THEN** Studio closes the focused pane
- **AND** ⌘W is left to the browser

#### Scenario: Desktop app

- **GIVEN** the user is using the desktop app
- **WHEN** the user presses ⌘W
- **THEN** Studio closes the focused pane

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

Adding Shift to the platform's close shortcut (⌘⇧W on macOS desktop, Ctrl+Shift+W on Windows and Linux desktop, or Alt+Shift+W on the web) SHALL close the current dashboard using the same confirmation rules as closing it from the sidebar.

#### Scenario: Close a dashboard with widgets

- **GIVEN** the current dashboard has widgets
- **WHEN** the user presses the dashboard close shortcut
- **THEN** the dashboard close confirmation opens
- **AND** the dashboard is unchanged until the user confirms

#### Scenario: Close a dashboard without widgets

- **GIVEN** the current dashboard has no widgets
- **WHEN** the user presses the dashboard close shortcut
- **THEN** the dashboard is deleted without a confirmation

#### Scenario: No current dashboard

- **GIVEN** the user is on a page other than a dashboard
- **WHEN** the user presses the dashboard close shortcut
- **THEN** no dashboard is closed

### Requirement: Shortcuts while typing

Shortcuts SHALL NOT trigger while the user is typing in a text field, except shortcuts that use ⌘ or Ctrl.

#### Scenario: Typing in search

- **GIVEN** the key browser search box is focused
- **WHEN** the user types a space
- **THEN** a space is typed and playback does not toggle
