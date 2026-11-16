# entry-units Specification

## Purpose

Define how Studio determines the unit of a logged value, so every widget interprets units the same way. Units can come from the entry's type, its metadata, or its name. Only angles are covered for now.

## Requirements

### Requirement: Angle unit inference

When a widget reads an entry as an angle, Studio SHALL determine its unit from the first source that matches, in this order:

1. The entry type: `Rotation2d` values are radians.
2. The `unit` field in the entry's metadata, or in its `properties` field for NT entries recorded by WPILib's DataLogManager.
3. A unit word in the entry's name.
4. Otherwise, radians.

#### Scenario: Rotation2d

- **GIVEN** a `Rotation2d` entry with metadata unit `deg`
- **THEN** its values are read as radians

#### Scenario: Metadata unit

- **GIVEN** a numeric entry `/Drive/Gyro/Yaw` with metadata `{"unit": "Degree"}`
- **THEN** its values are read as degrees

#### Scenario: Recorded NT metadata

- **GIVEN** a numeric entry `/Drive/Gyro/Yaw` with metadata `{"properties": {"unit": "Degree"}, "source": "NT"}`
- **THEN** its values are read as degrees

#### Scenario: Name

- **GIVEN** a numeric entry `/Turret/AngleRotations` with no unit metadata
- **THEN** its values are read as rotations

#### Scenario: Fallback

- **GIVEN** a numeric entry `/Drive/Gyro/Yaw` with no unit metadata
- **THEN** its values are read as radians

### Requirement: Recognized angle units

Studio SHALL recognize these angle units, ignoring case and allowing plurals:

- Radians: `rad`, `radian`
- Degrees: `°`, `deg`, `degree`
- Rotations: `R`, `rot`, `rotation`, `rev`, `revolution`

A metadata unit that isn't recognized MUST be ignored, continuing to the entry's name. Names only match a whole word or camelCase segment of the name's last part, and never match `R`.

#### Scenario: Unrecognized metadata unit

- **GIVEN** a numeric entry `/Arm/PivotDeg` with metadata unit `amps`
- **THEN** its values are read as degrees

#### Scenario: Word boundaries

- **GIVEN** a numeric entry `/Intake/Roller/Speed` with no unit metadata
- **THEN** its values are read as radians, not rotations

#### Scenario: Single letter in a name

- **GIVEN** a numeric entry `/Drive/R` with no unit metadata
- **THEN** its values are read as radians
