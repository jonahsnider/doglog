# command-palette Specification

## Purpose

Define the command palette, a searchable list of everything Studio can do right now: app-wide commands, dashboards, pages, recent logs, and the focused widget's commands.

## Requirements

### Requirement: Open the command palette

The command palette shortcut (⌘P, Ctrl+P on Windows and Linux) SHALL open the command palette on the desktop app and the web, instead of the browser printing the page. Pressing it again or pressing Escape MUST close it.

#### Scenario: Open and close with the shortcut

- **WHEN** the user presses ⌘P
- **THEN** the command palette opens with its search box focused
- **WHEN** the user presses ⌘P again
- **THEN** the command palette closes

### Requirement: Palette contents

The command palette SHALL list every dashboard, the sidebar's pages, recent logs, and every app-wide command from the keyboard shortcuts list and the macOS menu bar, except timeline playback. Commands that can't run right now MUST NOT be listed, ex. Split right on the Logs page.

#### Scenario: Commands on the Logs page

- **GIVEN** the Logs page is open
- **WHEN** the user opens the command palette
- **THEN** it lists Open log and New dashboard
- **AND** it doesn't list Split right or Zoom or restore pane

#### Scenario: Dashboards

- **GIVEN** there are two dashboards
- **WHEN** the user opens the command palette
- **THEN** it lists both dashboards by name, with ⌘1 and ⌘2, or Alt+1 and Alt+2 on the web

### Requirement: Palette position

The command palette SHALL sit where it would be centered with a full list. As fewer items match, it MUST shrink from the bottom while its search box stays in place.

#### Scenario: Narrow the results

- **WHEN** the user types until one item matches
- **THEN** the search box stays where it was and the palette ends below the item

### Requirement: Palette items

Each item SHALL show an icon and its label in sentence case, without the `…` the macOS menu bar adds. On the right, it SHALL show its shortcut, formatted for the user's platform, followed by its kind: Dashboard, Page, Widget, Command, or Log.

#### Scenario: Item details

- **WHEN** the user opens the command palette
- **THEN** Settings shows its icon, ⌘, and Page

### Requirement: Palette search

The command palette SHALL show one list without group headings. With an empty query it MUST list dashboards, pages, the focused widget's commands, other commands, and recent logs, in that order. Typing SHALL fuzzy match item labels and related words, and list the matches best first, with the matched characters highlighted. The first item MUST be highlighted whenever the list changes, so Enter runs it.

#### Scenario: Search

- **WHEN** the user opens the command palette and types "split"
- **THEN** Split right and Split down are listed

#### Scenario: Related words

- **WHEN** the user types "preferences"
- **THEN** Settings is listed

#### Scenario: Run the best match

- **WHEN** the user opens the command palette, types "logs", and presses Enter
- **THEN** the Logs page opens

### Requirement: Widget commands

The command palette SHALL list commands for the focused pane's widget: Add widget or Change widget, Widget options, each option picked from choices, and the actions the widget adds to its menu, ex. a graph's Reset view. Each MUST show the widget's title after its label, except options, which show their current choice. Options with their own controls, ex. the video widget's video, are left to Widget options.

#### Scenario: Field widget

- **GIVEN** the focused pane holds a Field widget
- **WHEN** the user opens the command palette
- **THEN** it lists Change widget and Widget options with "Field", and Orientation with its current choice

#### Scenario: Open the widget options

- **WHEN** the user chooses Widget options
- **THEN** the command palette closes and the focused pane's widget options open

### Requirement: Nested choices

Choosing an item with several choices, ex. Change widget or an option, SHALL list its choices in the command palette instead of closing it. The widget it changes MUST show above the search box, the search box MUST ask for the item, ex. "Orientation…", and the current choice MUST be checked and highlighted. Escape, or Backspace with nothing typed, MUST go back. Typing SHALL also find choices without opening their item, shown after its name, ex. "Orientation › Red left".

#### Scenario: Pick a choice

- **GIVEN** the focused pane holds a Field widget
- **WHEN** the user chooses Orientation
- **THEN** "Field" shows above the search box, which reads "Orientation…"
- **AND** the current orientation is checked and highlighted
- **WHEN** the user chooses Red left
- **THEN** the field's orientation is Red left

#### Scenario: Search for a choice

- **WHEN** the user types "red left" and presses Enter
- **THEN** the field's orientation is Red left

#### Scenario: Go back

- **GIVEN** the user chose Orientation
- **WHEN** the user presses Escape
- **THEN** the command palette lists the top-level items again

### Requirement: Run from the palette

Choosing an item with Enter or a click SHALL close the command palette and then run it, the same way as its shortcut or menu item. Choosing a dashboard MUST switch to it, and choosing a recent log MUST open it.

#### Scenario: Run a command

- **GIVEN** a dashboard is open
- **WHEN** the user opens the command palette, types "search entries", and presses Enter
- **THEN** the command palette closes
- **AND** the entry browser's search box is focused
