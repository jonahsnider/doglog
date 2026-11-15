# widget-discrete-timeline Specification

## Purpose

Define the discrete timeline widget, which shows boolean and enum-like entries as colored bands over time, making state changes easy to spot.

## Requirements

### Requirement: State bands

The discrete timeline SHALL accept boolean and string entries and draw each bound entry as a row of colored bands, one band per period of unchanged value.

#### Scenario: Boolean entry

- **GIVEN** the widget is bound to `/Intake/HasGamePiece`
- **THEN** periods where the value is true and false are shown as differently colored bands

#### Scenario: Enum-like string entry

- **GIVEN** the widget is bound to `/Arm/State` with values `STOWED`, `INTAKING`, and `SCORING`
- **THEN** each distinct value has its own color

### Requirement: Hover and cursor

The discrete timeline SHALL show the value under the pointer on hover, draw the global cursor as a vertical line, and MUST move the cursor when the user clicks.

#### Scenario: Hover value

- **WHEN** the user hovers over a band
- **THEN** the band's value and time range are shown

#### Scenario: Click to seek

- **WHEN** the user clicks a band at 8 s
- **THEN** the global cursor moves to 8 s
