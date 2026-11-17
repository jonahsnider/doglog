# widgets Specification

## Purpose

Define the behavior shared by every widget: binding entries by name, filtering by accepted data type, following the time cursor, and handling missing data, so new widgets are cheap to add.

## Requirements

### Requirement: Read-only widgets

Widgets SHALL only display data and MUST NOT write to or modify any data source.

#### Scenario: No editing

- **GIVEN** a widget bound to a live NT entry
- **THEN** the widget offers no way to change the entry's value

### Requirement: Accepted data types

Each widget type SHALL declare the data types it accepts, which MAY be specific struct types such as `SwerveModuleState[]`, and only entries of accepted types MUST be bindable to it.

#### Scenario: Type mismatch on drop

- **GIVEN** a widget that only accepts strings
- **WHEN** the user drags a numeric entry onto it
- **THEN** the entry is not bound
- **AND** the user is shown that the type is not accepted

### Requirement: Entry picker

Each widget SHALL have an options button that opens a searchable entry picker, filtered to the widget's accepted types, for binding one or more entries. Its search MUST match entries the same way as the entry browser's search, listing the best matches first and highlighting the matched characters.

#### Scenario: Pick entries by typing

- **GIVEN** a console widget
- **WHEN** the user opens its options and types "msg"
- **THEN** only string entries whose names match "msg" are listed
- **AND** selecting one binds it to the widget

#### Scenario: Unbind

- **WHEN** the user removes a bound entry in the picker
- **THEN** the widget stops showing that entry

### Requirement: Entry picker list

The entry picker SHALL list few enough entries to fit without scrolling, at most 10 before searching and 20 while searching, and MUST say how many more entries are hidden. Before searching, bound entries MUST be listed first, in the order the widget shows them, and entries MUST NOT move while they're toggled. Selecting an entry MUST keep the search, and names too long to fit MUST scroll back and forth while hovered.

#### Scenario: Bound entries first

- **GIVEN** a console widget bound to `/messages`
- **WHEN** the user opens its options
- **THEN** `/messages` is listed first and checked

#### Scenario: Pick several entries from one search

- **WHEN** the user searches "power" and selects a result
- **THEN** the search stays "power" so another result can be selected

#### Scenario: Hidden entries

- **GIVEN** a source with 85 entries a widget accepts
- **WHEN** the user opens the widget's options
- **THEN** 10 entries are listed, followed by "75 more"

### Requirement: Edit entries from the context menu

A widget's context menu SHALL offer to add entries, which opens the entry picker, and to remove a bound entry. Right-clicking the part of a widget that shows an entry, such as a values table or discrete timeline row, MUST offer to remove that entry directly; elsewhere, bound entries MUST be listed in a submenu. Middle-clicking the part of a widget that shows an entry SHALL remove it.

#### Scenario: Remove a values table row

- **GIVEN** a values table showing `/Arm/Angle`
- **WHEN** the user right-clicks the `/Arm/Angle` row and chooses "Remove /Arm/Angle"
- **THEN** the table stops showing `/Arm/Angle`

#### Scenario: Middle-click to remove

- **GIVEN** a values table showing `/Arm/Angle`
- **WHEN** the user middle-clicks the `/Arm/Angle` row
- **THEN** the table stops showing `/Arm/Angle`

### Requirement: Bind by drag and drop

Users SHALL be able to bind an entry by dragging it from the entry browser onto a widget.

#### Scenario: Drag from entry browser

- **WHEN** the user drags an accepted entry from the entry browser onto a widget
- **THEN** the entry is bound to that widget

#### Scenario: Already shown

- **GIVEN** a widget showing `/Arm/Angle`
- **WHEN** the user drags `/Arm/Angle` onto it from the entry browser or another widget
- **THEN** the user is shown that the widget already shows it
- **AND** dropping it changes nothing

### Requirement: Drag entries out of widgets

The part of a widget that shows an entry, such as a values table row or swerve legend item, SHALL be draggable. Dropping it on another entry of the same widget MUST move it to that entry's position, and dropping it on another widget MUST move it after that widget's entries. Rows whose other parts have their own interactions, such as selecting values, MUST be dragged by the entry name. Widgets that don't show entries individually, such as the console, are exempt.

#### Scenario: Reorder

- **GIVEN** a values table showing `/Arm/Angle` then `/Arm/Voltage`
- **WHEN** the user drags the `/Arm/Voltage` row onto the `/Arm/Angle` row
- **THEN** the table shows `/Arm/Voltage` then `/Arm/Angle`
- **AND** while dragging, a line marks where it will go

#### Scenario: Move to another widget

- **GIVEN** a values table and a discrete timeline showing `/Intake/HasPiece`
- **WHEN** the user drags the `/Intake/HasPiece` timeline row onto the values table
- **THEN** the values table shows `/Intake/HasPiece` and the discrete timeline doesn't

#### Scenario: Dropped outside a widget

- **WHEN** the user drags a values table row and drops it outside any widget
- **THEN** the table is unchanged

### Requirement: Follow the cursor

Widgets SHALL reflect the global time cursor. Value-style widgets MUST show the latest value at or before the cursor; time-series widgets MUST mark the cursor position.

#### Scenario: Latest value at cursor

- **GIVEN** an entry was set to 3 at 10 s and 5 at 20 s
- **WHEN** the cursor is at 15 s
- **THEN** a value-style widget shows 3

### Requirement: Missing data

When a bound entry doesn't exist in the active source, or no source is active, the widget SHALL show a "no data" state instead of an error and MUST keep the binding.

#### Scenario: Entry missing from source

- **GIVEN** a widget bound to `/Arm/Angle`
- **WHEN** the user opens a log without `/Arm/Angle`
- **THEN** the widget shows "no data" for that entry
- **AND** the binding is kept for future sources

### Requirement: Shortened entry names

Widgets and the entry picker SHALL shorten the `/Robot`, `/RealOutputs`, `/AdvantageKit`, `/AdvantageKit/RealOutputs`, and `/AdvantageKit/DriverStation` prefixes of entry names to their slashes and capital letters, shown dimmed, and MUST show the full prefix when the shortened prefix has been hovered for a short delay. `/ReplayOutputs` MUST NOT be shortened, so replayed outputs stand out from real ones.

#### Scenario: Shortened name

- **GIVEN** a widget bound to `/Robot/Arm/Angle`
- **THEN** the widget shows `/R/Arm/Angle` with `/R` dimmed

#### Scenario: Shortened AdvantageKit name

- **GIVEN** a widget bound to `/AdvantageKit/RealOutputs/Arm/Angle`
- **THEN** the widget shows `/AK/RO/Arm/Angle` with `/AK/RO` dimmed

#### Scenario: Hover to expand

- **WHEN** the user hovers `/R` in `/R/Arm/Angle`
- **THEN** after a short delay it grows to show `/Robot/Arm/Angle`

#### Scenario: Hovering the rest of the name

- **WHEN** the user hovers `/Arm/Angle` in `/R/Arm/Angle`
- **THEN** the prefix stays shortened

### Requirement: Default widget for an entry

Each bindable entry SHALL have a default widget, used when the entry is added without choosing a widget: numeric entries use the line graph, `/console` and `/messages` use the console, other string and boolean entries use the discrete timeline, `SwerveModuleState[]` and `SwerveModuleVelocity[]` entries use the swerve widget, entries the field widget accepts use the field widget, and all other entries use the values table.

#### Scenario: Numeric entry

- **WHEN** a `double` entry is added by double-clicking it
- **THEN** it is shown in a line graph

#### Scenario: Console entry

- **WHEN** `/messages` is added by double-clicking it
- **THEN** it is shown in a console

#### Scenario: Boolean entry

- **WHEN** a boolean entry is added by double-clicking it
- **THEN** it is shown in a discrete timeline

#### Scenario: Swerve module states

- **WHEN** a `SwerveModuleState[]` entry is added by double-clicking it
- **THEN** it is shown in a swerve widget

#### Scenario: Pose entry

- **WHEN** a `struct:Pose2d` entry is added by double-clicking it
- **THEN** it is shown in a field widget

#### Scenario: Struct entry

- **WHEN** a `struct:ChassisSpeeds` entry is added by double-clicking it
- **THEN** it is shown in a values table
