# key-browser Specification

## Purpose

Define the key browser, a collapsible panel listing every entry in the active source as a searchable tree, used to find entries and drag them onto widgets.

## Requirements

### Requirement: Entry tree

The key browser SHALL list every entry in the active source as a tree grouped by path segments, showing each entry's type indicator and value at the cursor.

#### Scenario: Nested entries

- **GIVEN** the source has `/Arm/Angle` and `/Arm/Velocity`
- **THEN** both appear under an expandable `Arm` group

#### Scenario: Live announcements

- **GIVEN** a live source is active
- **WHEN** a new topic is announced
- **THEN** it appears in the tree

### Requirement: Search

The key browser SHALL provide a search box that filters the tree to entries whose names fuzzy match, tolerating typos, and MUST highlight the matching parts of each entry's name.

#### Scenario: Search entries

- **WHEN** the user types "velocity"
- **THEN** only entries whose names match "velocity" and their parent groups are shown
- **AND** "Velocity" is highlighted in each matching entry

#### Scenario: Search with a typo

- **WHEN** the user types "velcoity"
- **THEN** entries whose names contain "Velocity" are shown

### Requirement: Collapsible panel

The key browser SHALL be a collapsible panel on the right side of the dashboard view, toggled by a button or keyboard shortcut, and its open state MUST persist.

#### Scenario: Toggle and remember

- **WHEN** the user collapses the key browser and reopens Studio
- **THEN** the key browser is still collapsed

### Requirement: Drag to bind

Users SHALL be able to drag entries from the key browser onto widgets to bind them.

#### Scenario: Drag an entry

- **WHEN** the user drags `/Arm/Angle` onto a values table
- **THEN** the values table binds `/Arm/Angle`

### Requirement: Type indicators

The key browser SHALL show each entry's type as a compact icon that is visually distinct from its value, and MUST show the full type name in a tooltip.

#### Scenario: Integer entry

- **GIVEN** the source has an `int64` entry
- **THEN** its row shows an integer type icon instead of the text `int64`
- **AND** hovering the icon shows `int64`

#### Scenario: Struct entry

- **GIVEN** the source has a `struct:Pose2d` entry
- **THEN** its row shows a struct type icon
- **AND** hovering the icon shows `struct:Pose2d`

### Requirement: Double-click to add

Double-clicking a bindable entry SHALL add it to the open dashboard using the entry's default widget. If the dashboard already has a widget of that type, the entry MUST be added to it instead of creating a new pane, preferring the focused pane's widget.

#### Scenario: Add to a matching widget

- **GIVEN** the focused pane shows a discrete timeline bound to `/Intake/HasGamePiece`
- **WHEN** the user double-clicks the boolean entry `/Arm/AtSetpoint`
- **THEN** the same discrete timeline shows both entries
- **AND** no new pane is created

#### Scenario: Add to a matching widget that isn't focused

- **GIVEN** the dashboard has a discrete timeline and a console, and the console's pane is focused
- **WHEN** the user double-clicks a boolean entry
- **THEN** the entry is added to the discrete timeline
- **AND** the discrete timeline's pane becomes focused

#### Scenario: Add to a dashboard without a matching widget

- **GIVEN** no pane shows the default widget for `/Arm/Angle`, and the focused pane has a widget
- **WHEN** the user double-clicks `/Arm/Angle`
- **THEN** the focused pane is split and the new pane shows the default widget for `/Arm/Angle`, bound to it

#### Scenario: Add to an empty dashboard

- **GIVEN** the open dashboard has a single empty pane
- **WHEN** the user double-clicks `/console`
- **THEN** the empty pane shows a console widget bound to `/console`

#### Scenario: Unsupported entry

- **WHEN** the user double-clicks an entry marked as unsupported
- **THEN** nothing is added

### Requirement: Entry context menu

Right-clicking an entry SHALL open a context menu with Add to dashboard and Copy name.

#### Scenario: Copy name

- **WHEN** the user right-clicks `/Arm/Angle` and chooses Copy name
- **THEN** `/Arm/Angle` is copied to the clipboard

#### Scenario: Add to dashboard

- **WHEN** the user right-clicks a bindable entry and chooses Add to dashboard
- **THEN** it is added the same way as double-clicking it
