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

### Requirement: Snap to sections

Clicking or dragging along the timeline bar SHALL snap the cursor to the start of a section of the robot's mode when the pointer is within 6 pixels of it, and the hover line and tooltip MUST show the snapped time.

#### Scenario: Click near the start of auto

- **GIVEN** auto starts at 2:16.94
- **WHEN** the user clicks the track 4 pixels after the start of auto
- **THEN** the cursor moves to 2:16.94

### Requirement: Robot mode on the timeline

When the source has Driver Station data (`DS:` entries in a log, or `/FMSInfo/FMSControlData` from NetworkTables), the timeline bar's track SHALL be colored by the robot's mode: autonomous, teleop, test, and e-stopped, leaving disabled periods uncolored.

#### Scenario: Teleop

- **GIVEN** a match log where teleop ran from 2:34.94 to 4:49.84
- **THEN** that part of the track is colored as teleop

### Requirement: Alerts on the timeline

The timeline bar SHALL show when WPILib error and warning alerts were active, from entries in groups with a `.type` of `Alerts`, as bars above the track from when each alert became active until it cleared. Info alerts MUST NOT be shown. An alert that clears and becomes active again within 5 seconds MUST be shown as staying active, so flapping alerts don't clutter the timeline. Alerts too short to see SHALL still be drawn as a dot.

#### Scenario: Alert span

- **GIVEN** the error alert `Arm not homed` was active from 0:12.00 to 0:30.00
- **THEN** a bar above the track spans 0:12.00 to 0:30.00

#### Scenario: Flapping alert

- **GIVEN** a warning alert that turns on and off every second for a minute
- **THEN** it's shown as one bar spanning that minute

### Requirement: Timeline tooltip

Hovering the timeline bar's track SHALL show a tooltip of what was happening at that time, stacked vertically: the robot's mode, then each alert active there, and a thin vertical line MUST mark the hovered time on the track. Each item MUST show its name with its length on the right, and when it started and ended below. For items at least 2 seconds long, the right side MUST also show how far into the item the hovered time is.

#### Scenario: Hover during teleop with an alert

- **GIVEN** teleop ran from 2:34.94 to 4:49.84 and the warning `Battery voltage low` was active from 2:16.92 to 5:01.54
- **WHEN** the user hovers the track at 3:37.70
- **THEN** the tooltip shows "Teleop" with "1:02.76 / 2:14.90" on the right, above "2:34.94 – 4:49.84"
- **AND** below that, "Battery voltage low" with "1:20.78 / 2:44.62" on the right, above "2:16.92 – 5:01.54"

#### Scenario: Nothing known

- **GIVEN** a log's Driver Station data starts 4 seconds in, and no alerts are active before then
- **WHEN** the user moves the pointer from teleop to 0:02.00
- **THEN** the tooltip fades out still showing what it last showed, not an empty box

#### Scenario: Short alert

- **GIVEN** an alert was active for 0.30 seconds
- **WHEN** the user hovers it
- **THEN** its right side only shows "0:00.30"

### Requirement: Skip disabled time

While the skip disabled time option is on, disabled periods longer than 15 seconds SHALL be skipped, except for 2 seconds at each end, so the time around enabling and disabling stays at normal scale. On the timeline bar, each skipped span SHALL take a small fixed width, hatched so it's clear it isn't to scale, and the rest of the time SHALL share the remaining width evenly. Nothing MUST be skipped if the robot was never enabled, or the disabled period a live source is still in.

#### Scenario: Practice log

- **GIVEN** a log where the robot sat disabled for 20 minutes, then ran for 2 minutes
- **THEN** the 2 minutes take up most of the track
- **AND** hovering the hatched span shows "Disabled (skipped)" with its real start and end

#### Scenario: Short gap

- **GIVEN** the robot was disabled for 3 seconds between auto and teleop
- **THEN** that gap is shown at normal scale

### Requirement: Fast-forward skipped time

While playing, the cursor SHALL fast-forward through a skipped span in about 1.5 seconds, then continue at the playback speed from the end of the span. The current time MUST be marked with a fast-forward icon while it is in a skipped span, playing or paused, with a tooltip saying what it means.

#### Scenario: Play into a skipped span

- **GIVEN** a skipped span from 0:06.25 to 2:14.95
- **WHEN** the user plays from 0:29.25
- **THEN** the cursor reaches 2:14.95 about a second later
- **AND** it continues at normal speed from there

### Requirement: Live timeline length

For live sources, the timeline bar SHALL span at least one FRC match (2 min 40 s), so it doesn't rescale with every new sample right after connecting. The part of the track past the newest data MUST look distinct from the part with data.

#### Scenario: New live connection

- **GIVEN** a live connection started 10 seconds ago
- **THEN** the data fills about the first 6% of the track

### Requirement: Timeline bar controls

The timeline bar SHALL have buttons for play/pause and playback speed at its start and a timeline options menu at its end, leaving the other playback controls to keyboard shortcuts so the track has room. Keyboard shortcuts MUST NOT act while the speed list or options menu is open.

#### Scenario: Step from the keyboard

- **WHEN** the user wants to step forward
- **THEN** they press period, there's no step button

### Requirement: Timeline options

The timeline options menu SHALL let the user hide or show alerts on the timeline and turn skipping disabled time on or off, and MUST remember both choices. Both are on by default.

#### Scenario: Hide alerts

- **WHEN** the user turns off Show alerts in the timeline options
- **THEN** alerts disappear from the track and its tooltip
- **AND** the track moves to the vertical center of the timeline bar
- **AND** they stay hidden after Studio restarts

### Requirement: Log playback controls

For log sources, Studio SHALL provide play/pause, a playback speed multiplier, step forward and back, skip forward and back, and jump to start and end, each with a keyboard shortcut. The shortcuts SHALL match YouTube's: Space or K plays and pauses, comma and period step back and forward, the left and right arrow keys skip 5 seconds, and J and L skip 10 seconds. Shift with the left and right arrow keys goes to the previous and next section. Skipping MUST NOT change playback.

#### Scenario: Play and pause

- **WHEN** the user presses Space
- **THEN** playback toggles between playing and paused

#### Scenario: Step

- **WHEN** the user presses period
- **THEN** the cursor moves forward by a small fixed step

#### Scenario: Skip

- **GIVEN** the cursor is at 42.0 s in a log
- **WHEN** the user presses L
- **THEN** the cursor moves to 52.0 s
- **AND** playback doesn't change

#### Scenario: Speed keys

- **WHEN** the user presses ] or YouTube's >
- **THEN** playback speed goes up one step
- **AND** only ] is shown as the shortcut in the UI

#### Scenario: Speed

- **WHEN** the user sets playback speed to 2x and plays
- **THEN** the cursor advances at twice real time

### Requirement: Jump to ends

Home and End, or ⌘← and ⌘→ (Ctrl on Windows and Linux), SHALL jump to the start and end of the timeline. In text fields, ⌘← and ⌘→ MUST keep moving the text cursor instead.

#### Scenario: Jump to ends

- **WHEN** the user presses Home or End
- **THEN** the cursor moves to the start or end of the log

#### Scenario: Jump to ends while typing

- **GIVEN** the entry browser search box is focused
- **WHEN** the user presses ⌘←
- **THEN** the text cursor moves to the start of the search box and the timeline cursor doesn't move

### Requirement: Skip sections

Shift+Left and Shift+Right, and the previous and next track media keys, SHALL go to the previous and next section of the robot's mode (ex. the start of auto). Going back more than 1 second into a section MUST go to its start first, like a music player. Without robot mode data, they SHALL skip 5 seconds.

#### Scenario: Next section

- **GIVEN** auto starts at 2:16.94 and the cursor is at 1:00.00 while the robot is disabled
- **WHEN** the user presses Shift+Right
- **THEN** the cursor moves to 2:16.94

#### Scenario: Previous section

- **GIVEN** teleop started at 2:34.94, after auto from 2:16.94
- **WHEN** the user presses Shift+Left with the cursor at 3:00.00
- **THEN** the cursor moves to 2:34.94
- **AND** pressing Shift+Left again moves it to the start of the section before teleop

### Requirement: Media controls

While the media controls setting is on and a log is open, media keys and the operating system's media controls SHALL control playback: play and pause toggle playback, previous and next track go to the previous and next section, skip back and forward move the cursor 5 seconds back or forward, and seeking moves the cursor. The OS's media controls MUST show the log's file name and the cursor's position in the log. Media controls MUST NOT control live sources.

#### Scenario: Media key

- **GIVEN** media controls are on and a log is open and paused
- **WHEN** the user presses the play/pause media key
- **THEN** the log plays

#### Scenario: Skip

- **GIVEN** media controls are on and the cursor is at 42.0 s in a log
- **WHEN** the user presses the skip forward button in the OS's media controls
- **THEN** the cursor moves to 47.0 s
- **AND** playback doesn't change

#### Scenario: Next track

- **GIVEN** media controls are on, auto starts at 2:16.94, and the cursor is at 1:00.00
- **WHEN** the user presses the next track media key
- **THEN** the cursor moves to 2:16.94

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

Timestamps SHALL be shown as time since the start of the source (the first record of a log, or the moment a live connection began) in minutes and seconds to the hundredth, like `m:ss.cc`.

#### Scenario: Log time

- **GIVEN** a log's first record has a robot timestamp of 3,000,000 µs
- **WHEN** the cursor is at a record with timestamp 5,500,000 µs
- **THEN** the time is shown as 0:02.50

#### Scenario: Time over a minute

- **WHEN** the cursor is 65.5 seconds after the start of the source
- **THEN** the time is shown as 1:05.50
