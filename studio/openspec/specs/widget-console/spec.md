# widget-console Specification

## Purpose

Define the console widget, which merges one or more string entries into a single time-ordered list of messages, like robot console output, with filtering and live auto-scroll.

## Requirements

### Requirement: Merged string output

The console SHALL accept string entries and show messages from all bound entries in one list, ordered by time, with each message's timestamp.

#### Scenario: Two sources merged

- **GIVEN** the console is bound to `console` and `messages`
- **THEN** messages from both entries appear interleaved in time order

### Requirement: DogLog-friendly default

A new console widget SHALL bind WPILib's `console` and `messages` entries by default.

#### Scenario: New console

- **WHEN** the user adds a console widget
- **THEN** it is bound to `console` and `messages`

### Requirement: Cursor position

The console SHALL only show messages at or before the global cursor.

#### Scenario: Scrubbing back

- **WHEN** the user moves the cursor to 30 s
- **THEN** the console's last visible message is the latest one at or before 30 s

### Requirement: Text filter

The console SHALL provide a text filter that hides messages not matching the filter.

#### Scenario: Filter messages

- **WHEN** the user types "CAN" in the filter
- **THEN** only messages containing "CAN" are shown

### Requirement: Live auto-scroll

The console SHALL auto-scroll to the newest message while following live data.

#### Scenario: Following

- **GIVEN** the cursor is following live data
- **WHEN** a new message arrives
- **THEN** the console scrolls to show it
