# widget-values-table Specification

## Purpose

Define the values table widget, which shows the name, type, and value at the cursor for any bound entries, including expandable struct fields.

## Requirements

### Requirement: Values at cursor

The values table SHALL accept entries of any supported type and show each bound entry's name, type, and latest value at or before the cursor.

#### Scenario: Mixed types

- **GIVEN** the table is bound to a boolean, a string, and a number
- **THEN** each row shows the entry's name, type, and current value

### Requirement: Struct expansion

Struct and array values SHALL be expandable to show their individual fields or elements.

#### Scenario: Expand a pose

- **GIVEN** the table is bound to a `Pose2d` entry
- **WHEN** the user expands the row
- **THEN** the pose's x, y, and rotation fields are shown
