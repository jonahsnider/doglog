# timeline Specification

## Purpose

Define the single app-wide time cursor, playback controls for logs, follow-live behavior for live sources, and how time is displayed, so every widget shows a consistent moment in time.

## Requirements

### Requirement: Global time cursor

Studio SHALL have one time cursor shared by every dashboard and widget.

#### Scenario: Cursor shared across dashboards

- **GIVEN** the cursor is at 42.0 s on one dashboard
- **WHEN** the user switches to another dashboard
- **THEN** the cursor is still at 42.0 s

### Requirement: Timeline bar

When a dashboard is open and a source is active, a timeline bar SHALL be shown along the bottom of the dashboard area, and dragging or scrolling horizontally along it MUST move the cursor.

#### Scenario: Scrub

- **WHEN** the user drags along the timeline bar
- **THEN** the cursor follows the drag
- **AND** every widget updates to the new cursor time

#### Scenario: Scroll

- **WHEN** the user scrolls horizontally over the timeline bar
- **THEN** the cursor moves as far as dragging the same distance would
- **AND** the browser doesn't navigate back or forward

### Requirement: Log playback controls

For log sources, Studio SHALL provide play/pause, a playback speed multiplier, step forward and back, and jump to start and end, each with a keyboard shortcut.

#### Scenario: Play and pause

- **WHEN** the user presses Space
- **THEN** playback toggles between playing and paused

#### Scenario: Step

- **WHEN** the user presses the right arrow key
- **THEN** the cursor moves forward by a small fixed step

#### Scenario: Jump to ends

- **WHEN** the user presses Home or End
- **THEN** the cursor moves to the start or end of the log

#### Scenario: Speed

- **WHEN** the user sets playback speed to 2x and plays
- **THEN** the cursor advances at twice real time

### Requirement: Media controls

While the media controls setting is on and a log is open, media keys and the operating system's media controls SHALL control playback: play and pause toggle playback, previous and next track or skip back and forward move the cursor 5 seconds back or forward, and seeking moves the cursor. The OS's media controls MUST show the log's file name and the cursor's position in the log. Media controls MUST NOT control live sources.

#### Scenario: Media key

- **GIVEN** media controls are on and a log is open and paused
- **WHEN** the user presses the play/pause media key
- **THEN** the log plays

#### Scenario: Skip

- **GIVEN** media controls are on and the cursor is at 42.0 s in a log
- **WHEN** the user presses the next track media key
- **THEN** the cursor moves to 47.0 s
- **AND** playback doesn't change

#### Scenario: Setting off

- **GIVEN** media controls are off
- **WHEN** the user presses the play/pause media key
- **THEN** playback doesn't change

### Requirement: Remember log position

Studio SHALL remember where the cursor was in each log by file name, and MUST move the cursor there when a log with that name is opened again.

#### Scenario: Reopen a log

- **GIVEN** the cursor was at 42.0 s when the user last had `match.wpilog` open
- **WHEN** the user opens `match.wpilog` again
- **THEN** the cursor starts paused at 42.0 s

#### Scenario: New log

- **WHEN** the user opens a log they haven't opened before
- **THEN** the cursor starts paused at the beginning of the log

### Requirement: Live follow

For live sources, Studio SHALL support following (tracking the newest data), playing, and paused states, and MUST keep receiving data in every state.

#### Scenario: Follow by default

- **WHEN** a live connection starts
- **THEN** the cursor follows the newest data

#### Scenario: Leave follow on manual navigation

- **GIVEN** the cursor is following live data
- **WHEN** the user seeks, pans, or scrolls back in time
- **THEN** the cursor stops following
- **AND** new data keeps arriving in the background

#### Scenario: Go live

- **GIVEN** the cursor is not following
- **WHEN** the user presses Go live
- **THEN** the cursor jumps to the newest data and follows it again

### Requirement: Live history retention

Studio SHALL keep live history for the session until a memory limit is reached, then discard the oldest data first, and MUST always keep the latest value of every entry.

#### Scenario: Memory limit reached

- **GIVEN** a long live session has reached the memory limit
- **WHEN** new data arrives
- **THEN** the oldest data is discarded
- **AND** every entry still has its latest value available

### Requirement: Time display

Timestamps SHALL be shown as time since the start of the source: the first record of a log, or the moment a live connection began. Times of a minute or more SHALL be shown in minutes and seconds.

#### Scenario: Log time

- **GIVEN** a log's first record has a robot timestamp of 3,000,000 µs
- **WHEN** the cursor is at a record with timestamp 5,500,000 µs
- **THEN** the time is shown as 2.50s

#### Scenario: Time over a minute

- **WHEN** the cursor is 65.5 seconds after the start of the source
- **THEN** the time is shown as 1m 5.50s
- **AND** the seconds are padded with blank space to the width of two digits so the time doesn't shift as it plays
