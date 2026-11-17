# widget-console Specification

## Purpose

Define the console widget, which merges one or more string entries into a single time-ordered list of messages, like robot console output, with filtering and live auto-scroll.

## Requirements

### Requirement: Merged string output

The console SHALL accept string entries and show messages from all bound entries in one list, ordered by time, with each message's timestamp. Timestamps SHALL NOT be selectable, so copying messages copies only their text.

#### Scenario: Two sources merged

- **GIVEN** the console is bound to `console` and `messages`
- **THEN** messages from both entries appear interleaved in time order

#### Scenario: Copying messages

- **WHEN** the user selects several messages and copies them
- **THEN** the copied text contains the messages without their timestamps

### Requirement: Message row interaction

The console SHALL highlight a message's row while it's hovered. Right-clicking a message SHALL open a context menu with an option to copy the message's text.

#### Scenario: Copy a message

- **WHEN** the user right-clicks a message and picks Copy message
- **THEN** the message's text, without its timestamp, is copied to the clipboard

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

The console SHALL provide a text filter that hides messages not matching the filter and highlights the matching text in the messages shown. The filter SHALL ignore case and match its text literally by default, with toggles to match case, match whole words, and use a regular expression, like VS Code's find options. An invalid regular expression SHALL mark the filter as invalid and show no messages.

#### Scenario: Filter messages

- **WHEN** the user types "CAN" in the filter
- **THEN** only messages containing "CAN", in any case, are shown
- **AND** each match in them is highlighted

#### Scenario: Whole word

- **WHEN** the user types "CAN" in the filter and turns on match whole word
- **THEN** messages containing "CAN bus" are shown, but not ones only containing "CANcoder"

### Requirement: Message navigation

The console SHALL provide previous and next message buttons, also bound to Shift+Enter and Enter in the filter, that move the global cursor to the previous or next message passing the filters. While filtering, the filter SHALL show how many matching messages are at or before the cursor out of all matching messages in the log.

#### Scenario: Matches after the cursor

- **GIVEN** the cursor is at the start of the log, and "CAN" matches 41 messages later in the log
- **WHEN** the user types "CAN" in the filter
- **THEN** the filter shows "0 of 41"
- **WHEN** the user presses Enter
- **THEN** the cursor moves to the first matching message, which is shown at the bottom of the console

### Requirement: Messages split by line

The console SHALL show each line of a sample as its own message, skipping blank lines. An indented line SHALL instead join the previous message from the same entry, even when it was logged in a later sample, since console output is logged in arbitrary chunks.

#### Scenario: Stack trace

- **GIVEN** `console` has a sample `Error at Main.java:9: Unhandled exception` followed by a sample with indented `at ...` lines
- **THEN** the console shows one message containing the error and its stack trace

### Requirement: Message levels

The console SHALL mark messages starting with `Error at ` or `Exception in thread ` as errors, messages starting with `Warning at ` or `CommandScheduler loop overrun` as warnings, and all other messages as info. These are the prefixes WPILib prints for `DriverStation.reportError()`, `DriverStation.reportWarning()`, uncaught exceptions, and command scheduler overruns. Errors and warnings SHALL be tinted with distinct colors.

#### Scenario: Loop overrun

- **GIVEN** `console` has the message `Warning at ...: Loop time of 0.02s overrun`
- **THEN** the message is tinted as a warning

### Requirement: Level filter

The console SHALL provide a minimum level filter with the options All, Warnings (warnings and errors), and Errors, defaulting to All.

#### Scenario: Errors only

- **WHEN** the user picks Errors
- **THEN** only error messages are shown

### Requirement: Live auto-scroll

The console SHALL auto-scroll to the newest message while following live data.

#### Scenario: Following

- **GIVEN** the cursor is following live data
- **WHEN** a new message arrives
- **THEN** the console scrolls to show it
