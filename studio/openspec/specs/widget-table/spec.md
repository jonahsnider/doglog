# widget-table Specification

## Purpose

Define the table widget, a spreadsheet of the bound entries' values over time: one column per entry, with expandable struct and array columns, and one row per time any of them was logged, with the cursor's row highlighted.

## Requirements

### Requirement: Entry columns

The table SHALL accept entries of any supported type and show each bound entry as a column, in binding order, headed by the entry's name and type. A bound entry no visible source has SHALL still have a column, headed with "No data". While several sources are visible, each source's copy of an entry SHALL have its own column, labeled with the source.

#### Scenario: Mixed types

- **GIVEN** the table is bound to a boolean, a string, and a number
- **THEN** it has a column for each, headed with the entry's name and type

### Requirement: Rows over time

The table SHALL have a row for each time any bound entry has a sample at, in time order, starting with the row's time. Each cell SHALL show the column's latest value at or before its row's time, and be empty before the entry's first sample. Times SHALL NOT be selectable, so copying values copies only the values.

#### Scenario: Entries logged at different times

- **GIVEN** the table is bound to `/Arm/Angle`, logged at 1 s and 3 s, and `/Arm/Voltage`, logged at 2 s
- **THEN** the table has rows at 1 s, 2 s, and 3 s
- **AND** the row at 2 s shows `/Arm/Angle`'s value from 1 s

### Requirement: Numbers aligned to the end

Like a spreadsheet, number columns and their headers SHALL be aligned to the end, so digits line up.

#### Scenario: Number column

- **GIVEN** the table is bound to a number
- **THEN** its values and header line up at the right of its column

### Requirement: Changed values stand out

A cell SHALL be dimmed unless its entry logged a value at its row's time that differs from the entry's value before it, so changes stand out from values carried down from earlier rows.

#### Scenario: Value logged again unchanged

- **GIVEN** `/Intake/HasPiece` is logged `false` at 1 s, `false` at 2 s, and `true` at 3 s
- **THEN** its cells are dimmed at 2 s and shown normally at 1 s and 3 s

### Requirement: Cursor row

The table SHALL show every row and highlight the cursor's row, the latest one at or before the cursor. Clicking a row without selecting text SHALL move the cursor to its time.

Moving the cursor, such as by clicking the timeline or scrubbing, SHALL scroll its row into view, centered unless it's already in view. While playback or live data moves the cursor, the table SHALL keep its row in view only while it's in view, so the user can scroll away from it.

#### Scenario: Click a row

- **GIVEN** the table is scrolled to rows from 30 s to 40 s
- **WHEN** the user clicks the row at 35 s
- **THEN** the cursor moves to 35 s and that row is highlighted, without the table scrolling

#### Scenario: Seek on the timeline

- **WHEN** the user clicks the timeline at 2:00, far from the rows in view
- **THEN** the table scrolls to center the row at or before 2:00, with rows after it below

#### Scenario: Scroll away during playback

- **GIVEN** playback is moving the cursor, and its row is in view
- **THEN** the table scrolls to keep its row in view
- **WHEN** the user scrolls up
- **THEN** the table stays where the user scrolled to

### Requirement: Struct expansion

Struct and array columns SHALL have an expand button in their header that splits the column into a column for each of their fields or elements, under a header naming each one. Expanded fields that are structs or arrays SHALL expand the same way. Which fields an array or struct has SHALL follow the value at the cursor.

#### Scenario: Expand a pose

- **GIVEN** the table is bound to a `Pose2d` entry
- **WHEN** the user expands its column
- **THEN** the column is split into `translation` and `rotation` columns under the pose's header

#### Scenario: Activate the expand button

- **GIVEN** the table shows an expandable column, including a nested field or element
- **WHEN** the user activates its expand button by pointer or keyboard
- **THEN** the column toggles once without starting a drag

### Requirement: Scroll sideways

Columns SHALL share the table's width, and the table SHALL scroll sideways once they'd be too narrow to read, keeping the time column in view.

#### Scenario: Many columns

- **GIVEN** a narrow table bound to 10 entries
- **WHEN** the user scrolls it sideways
- **THEN** the time column stays at the left edge
