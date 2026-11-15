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

Each widget type SHALL declare the data types it accepts, and only entries of accepted types MUST be bindable to it.

#### Scenario: Type mismatch on drop

- **GIVEN** a widget that only accepts strings
- **WHEN** the user drags a numeric entry onto it
- **THEN** the entry is not bound
- **AND** the user is shown that the type is not accepted

### Requirement: Entry picker

Each widget SHALL have an options button that opens a searchable entry picker, filtered to the widget's accepted types, for binding one or more entries.

#### Scenario: Pick entries by typing

- **GIVEN** a console widget
- **WHEN** the user opens its options and types "msg"
- **THEN** only string entries whose names match "msg" are listed
- **AND** selecting one binds it to the widget

#### Scenario: Unbind

- **WHEN** the user removes a bound entry in the picker
- **THEN** the widget stops showing that entry

### Requirement: Bind by drag and drop

Users SHALL be able to bind an entry by dragging it from the key browser onto a widget.

#### Scenario: Drag from key browser

- **WHEN** the user drags an accepted entry from the key browser onto a widget
- **THEN** the entry is bound to that widget

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
