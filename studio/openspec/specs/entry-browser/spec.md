# entry-browser Specification

## Purpose

Define the entry browser, a collapsible panel listing every entry in the active source as a searchable tree, used to find entries and drag them onto widgets.

## Requirements

### Requirement: Entry tree

The entry browser SHALL list every entry in the active source as a tree grouped by path segments, showing each entry's type indicator and value at the cursor.

#### Scenario: Nested entries

- **GIVEN** the source has `/Arm/Angle` and `/Arm/Velocity`
- **THEN** both appear under an expandable `Arm` group

#### Scenario: Live announcements

- **GIVEN** a live source is active
- **WHEN** a new topic is announced
- **THEN** it appears in the tree

### Requirement: Keyboard navigation

The entry tree SHALL follow the WAI-ARIA tree view pattern: it MUST be a single tab stop, the arrow keys MUST move between rows and expand or collapse groups, and typing MUST focus the next row whose label starts with the typed text. Keyboard navigation MUST reach rows scrolled out of view.

#### Scenario: Expand with the keyboard

- **GIVEN** the `Arm` group is focused and collapsed
- **WHEN** the user presses Right Arrow
- **THEN** `Arm` expands

#### Scenario: Jump to the last row

- **GIVEN** the tree has more rows than fit in the panel
- **WHEN** the user presses End
- **THEN** the last row is scrolled into view and focused

#### Scenario: Typeahead

- **WHEN** the user types "v" while `Arm` is expanded and `Arm/Angle` is focused
- **THEN** `Velocity` is focused

### Requirement: Search

The entry browser SHALL provide a search box that filters the tree to entries whose names contain the query's characters in order, so abbreviations match and separators like `/`, `_`, `-`, and spaces can be skipped, and MUST highlight the matched characters in each entry's and group's name. Struct entries MUST also match their struct type. Primitive types like `boolean` or `double` MUST NOT match, since nearly every entry has one.

#### Scenario: Search entries

- **WHEN** the user types "velocity"
- **THEN** only entries whose names match "velocity" and their parent groups are shown
- **AND** "Velocity" is highlighted in each matching entry

#### Scenario: Search with an abbreviation

- **GIVEN** the source has `/Swerve/ModuleStates` and `/Swerve/Module1/Current`
- **WHEN** the user types "swmodst"
- **THEN** `/Swerve/ModuleStates` is shown
- **WHEN** the user types "mod1"
- **THEN** `/Swerve/Module1/Current` is shown

#### Scenario: Search ignores separators

- **GIVEN** the source has `/Swerve/ModuleStates` and `/Swerve/module_states`
- **WHEN** the user types "SwerveModuleStates"
- **THEN** both entries are shown

#### Scenario: Search by struct type

- **GIVEN** the source has `/Drive/Pose` of type `struct:Pose2d`
- **WHEN** the user types "Pose2d"
- **THEN** `/Drive/Pose` is shown

### Requirement: Collapsible panel

The entry browser SHALL be a collapsible panel on the right side of the dashboard view, toggled by a button or keyboard shortcut, and its open state MUST persist. Users MUST be able to resize it by dragging the divider between it and the panes, and its width MUST persist.

#### Scenario: Toggle and remember

- **WHEN** the user collapses the entry browser and reopens Studio
- **THEN** the entry browser is still collapsed

#### Scenario: Resize the entry browser

- **WHEN** the user drags the divider between the panes and the entry browser
- **THEN** the entry browser's width changes
- **AND** the panes resize to fill the remaining space

#### Scenario: Reset the width

- **WHEN** the user double-clicks the divider between the panes and the entry browser
- **THEN** the entry browser returns to its default width

#### Scenario: Remember the width

- **WHEN** the user resizes the entry browser and reopens Studio
- **THEN** the entry browser has the same width

#### Scenario: Resize the window

- **WHEN** the user resizes the window
- **THEN** the entry browser keeps its width and the panes absorb the change

### Requirement: Drag to bind

Users SHALL be able to drag entries from the entry browser onto widgets to bind them.

#### Scenario: Drag an entry

- **WHEN** the user drags `/Arm/Angle` onto a values table
- **THEN** the values table binds `/Arm/Angle`

### Requirement: Type indicators

The entry browser SHALL show each entry's type as a compact icon that is visually distinct from its value, and MUST show the full type name in a tooltip.

#### Scenario: Integer entry

- **GIVEN** the source has an `int64` entry
- **THEN** its row shows an integer type icon instead of the text `int64`
- **AND** hovering the icon shows `int64`

#### Scenario: Struct entry

- **GIVEN** the source has a `struct:Pose2d` entry
- **THEN** its row shows a struct type icon
- **AND** hovering the icon shows `Pose2d`

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

Right-clicking an entry SHALL open a context menu with Add to dashboard, Copy name, and Copy value.

#### Scenario: Copy name

- **WHEN** the user right-clicks `/Arm/Angle` and chooses Copy name
- **THEN** `/Arm/Angle` is copied to the clipboard

#### Scenario: Copy value

- **WHEN** the user right-clicks an entry and chooses Copy value
- **THEN** its value at the cursor is copied to the clipboard as JSON, except plain strings which are copied without quotes

#### Scenario: Add to dashboard

- **WHEN** the user right-clicks a bindable entry and chooses Add to dashboard
- **THEN** it is added the same way as double-clicking it
