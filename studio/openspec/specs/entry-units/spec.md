# entry-units Specification

## Purpose

Define how Studio determines the unit of a logged value, so every widget interprets units the same way. Units can come from the entry's type, its metadata, or its name. Widgets that read angles use the angle rules, and the graph uses the general unit rules.

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

### Requirement: Unit inference

For numeric entries in general, Studio SHALL determine the unit from the `unit` field in the entry's metadata (or its `properties` field for recorded NT entries), then from unit words in the entry's name. An entry with neither MUST have no unit, and its values MUST be shown as logged.

#### Scenario: Compound unit in a name

- **GIVEN** a numeric entry `/Drive/VelocityMetersPerSec` with no unit metadata
- **THEN** its unit is `m/s`

#### Scenario: Metadata unit

- **GIVEN** a numeric entry `/Elevator/Accel` with metadata `{"unit": "m/s^2"}`
- **THEN** its unit is `m/s²`

#### Scenario: No unit

- **GIVEN** a numeric entry `/Drive/Speed` with no unit metadata
- **THEN** it has no unit

### Requirement: Recognized units

Studio SHALL recognize units of length (`m`, `cm`, `mm`, `in`, `ft`), angle (radians, degrees, rotations), time (`s`, `ms`, `µs`, `min`), voltage (`V`, `mV`), current (`A`, `mA`), and temperature (`°C`, `°F`, `K`), ignoring case and allowing plurals, and lengths and angles per time or per time squared, written `m/s`, `meters per second`, `MetersPerSec`, or `MetersPerSecSquared`. `rpm` and `rps` MUST be read as rotations per minute and per second.

#### Scenario: RPM

- **GIVEN** a numeric entry `/Shooter/VelocityRPM` with no unit metadata
- **THEN** its unit is `rpm`

### Requirement: Unit words in names

Unit words in names SHALL NOT match single letters, `in`, or `min`, since they're usually ordinary words.

#### Scenario: Words that aren't units

- **GIVEN** a numeric entry `/Arm/MinPosition` with no unit metadata
- **THEN** it has no unit

### Requirement: Unit conversion

Values in units that measure the same thing SHALL be convertible between each other, ex. feet per second to meters per second, or Fahrenheit to Celsius.

#### Scenario: Feet per second

- **GIVEN** a value of 10 `ft/s`
- **THEN** it converts to 3.048 `m/s`
