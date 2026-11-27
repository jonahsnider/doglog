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

When a dashboard is open and a source is active, the timeline bar SHALL span the bottom of the window below both sidebars, directly on the app's frame rather than on a surface of its own. In video export mode, it SHALL fit below the panes inside the preview instead. Dragging or scrolling horizontally along it MUST move the cursor.

#### Scenario: Open or resize a sidebar

- **GIVEN** a dashboard is open and playback is paused
- **WHEN** the app sidebar or entry browser is opened, closed, or resized
- **THEN** the timeline controls and scrubber stay in place and the playhead does not move

#### Scenario: Scrub on a narrow timeline

- **GIVEN** the timeline is narrower than 480 CSS pixels
- **THEN** the scrubber has a row below the playback controls, alongside the end time and the live button when present
- **AND** play, playback speed, the current time, and timeline options remain available above it

#### Scenario: Open or close the only source

- **GIVEN** a dashboard is open
- **WHEN** the first source opens or the last source closes
- **THEN** the timeline bar slides up from or down past the bottom edge as the panes and sidebars resize
- **AND** if the system requests reduced motion, the layout changes immediately without sliding

#### Scenario: Scrub

- **WHEN** the user drags along the timeline bar
- **THEN** the cursor follows the drag
- **AND** every widget updates to the new cursor time

#### Scenario: Scroll

- **WHEN** the user scrolls horizontally over the timeline bar
- **THEN** the cursor moves 15 ms for each pixel scrolled, however long the source is
- **AND** it moves the same way as the fingers, whether or not the system uses natural scrolling
- **AND** the browser doesn't navigate back or forward

### Requirement: Snap to sections

Clicking or dragging along the timeline bar SHALL snap the cursor to the start of a section of the robot's mode when the pointer is within 6 pixels of it, and the hover line and tooltip MUST show the snapped time.

#### Scenario: Click near the start of auto

- **GIVEN** auto starts at 2:16.94
- **WHEN** the user clicks the track 4 pixels after the start of auto
- **THEN** the cursor moves to 2:16.94

### Requirement: Robot mode on the timeline

When the source has Driver Station data, the timeline bar's track SHALL be colored by the robot's mode: autonomous, teleop, test, and e-stopped, leaving disabled periods uncolored. Studio MUST use the first source of mode data available: WPILib's `/DS:` flags, AdvantageKit's `/DriverStation/` entries in a log, its `/AdvantageKit/DriverStation/` or `/NT:/AdvantageKit/DriverStation/` entries from NetworkTables, `/DS:controlWord`, `/DriverStation/ControlWord`, then `/FMSInfo/FMSControlData`.

#### Scenario: Teleop

- **GIVEN** a match log where teleop ran from 2:34.94 to 4:49.84
- **THEN** that part of the track is colored as teleop

#### Scenario: AdvantageKit robot modes

- **GIVEN** a source with AdvantageKit's `Enabled`, `EmergencyStop`, and `RobotMode` entries instead of separate `Autonomous` and `Test` flags
- **THEN** the timeline shows `AUTONOMOUS` as auto and `UTILITY` as test while enabled
- **AND** it shows e-stop when `EmergencyStop` is true, even if the robot is disabled

#### Scenario: WPILib 2027 control word

- **GIVEN** a log or live session from a robot using WPILib 2027, which has a `ControlWord` struct (`/DS:controlWord` in logs, `/DriverStation/ControlWord` in NetworkTables) instead of the earlier Driver Station flags and `/FMSInfo/FMSControlData`
- **THEN** the timeline shows the robot's mode from the control word's `enabled`, `eStop`, and `robotMode` fields, with `utility` shown as test

### Requirement: Alerts on the timeline

The timeline bar SHALL show when WPILib error and warning alerts were active, from entries in groups with a `.type` of `Alerts`, as bars above the track from when each alert became active until it cleared. Info alerts MUST NOT be shown. An alert that clears and becomes active again within 5 seconds MUST be shown as staying active, so flapping alerts don't clutter the timeline. Alerts too short to see SHALL still be drawn as a dot.

#### Scenario: Alert span

- **GIVEN** the error alert `Arm not homed` was active from 0:12.00 to 0:30.00
- **THEN** a bar above the track spans 0:12.00 to 0:30.00

#### Scenario: Flapping alert

- **GIVEN** a warning alert that turns on and off every second for a minute
- **THEN** it's shown as one bar spanning that minute

#### Scenario: No alerts

- **GIVEN** a practice log where no error or warning alerts were active
- **THEN** the track stays in the vertical center of the timeline bar instead of moving down to make room for alerts

### Requirement: Active hub shifts on the timeline

For 2026 matches, the timeline bar SHALL show when the robot's alliance hub was active in teleop as bars below the track in REBUILT's fuel color (#FACB43, outlined in light mode), one per shift with a gap between each: the 10 second transition shift, the robot's two 25 second alliance shifts, and the 30 second end game. Inactive shifts MUST NOT be shown. Shifts SHALL start with teleop and end where it does. The track SHALL move up to make room only when shifts are shown.

#### Scenario: Blue alliance, red scored more in auto

- **GIVEN** a 2026 match log from a blue alliance robot where the game data is `R`, and teleop ran from 5:32.33 to 7:52.30
- **THEN** shift bars span 5:32.33 to 5:42.33 (transition shift), 5:42.33 to 6:07.33 (shift 1), 6:32.33 to 6:57.33 (shift 3), and 7:22.33 to 7:52.30 (end game)
- **AND** hovering shift 3 shows "Hub active (shift 3)"

### Requirement: Active hub shifts from FMSInfo

Which shifts were active MUST come from NetworkTables' FMSInfo (`/NT:/FMSInfo/` in logs, `/FMSInfo/` live): the game data (`GameSpecificMessage`) is the alliance whose hub is inactive first, and `IsRedAlliance` is the robot's alliance. Unless the game data during that match's teleop is exactly `R` or `B` and the alliance is known, the match MUST NOT show shifts.

#### Scenario: No FMSInfo

- **GIVEN** a 2026 match log without FMSInfo
- **THEN** no shifts are shown

### Requirement: Recognizing 2026 matches

A match MUST be recognized by its timing, 20 seconds of auto followed within 5 seconds by at most 2 minutes 20 seconds of teleop, which real matches and the Driver Station's practice mode follow. A source's year MUST come from the wall clock WPILib's `DataLogManager` records (`/systemTime`), then the log's file name, and live sessions are from the current year. Shifts MUST NOT be shown for other years or for logs whose year isn't known.

#### Scenario: 2025 match

- **GIVEN** a 2025 match log with 15 seconds of auto and 2 minutes 15 seconds of teleop
- **THEN** no shifts are shown

#### Scenario: Practice without match timing

- **GIVEN** a 2026 log where the robot was enabled in teleop for 3 minutes from the Driver Station
- **THEN** no shifts are shown

### Requirement: Timeline tooltip

Hovering the timeline bar's track SHALL show a tooltip of what was happening at that time, stacked vertically: the robot's mode, the shift its hub is active in, then each alert active there, and a thin vertical line MUST mark the hovered time on the track. Each item MUST show its name with its length on the right, and when it started and ended below. For items at least 2 seconds long, the right side MUST also show how far into the item the hovered time is.

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

### Requirement: Graphs on the timeline

The timeline bar SHALL mark the time hovered in a graph, and while graphs or histograms are shown zoomed in it SHALL mark the time range they show, so it's clear where they are in the whole source.

#### Scenario: Zoomed graph

- **GIVEN** a graph zoomed to 1:10 through 1:20
- **THEN** the timeline bar marks 1:10 through 1:20

### Requirement: Disconnected time

The timeline bar SHALL show the time a live session was disconnected as a break in the track, at least a few pixels wide so short drops stand out, and its tooltip MUST say "Disconnected". Graphs MUST shade it gray and MUST NOT draw lines or bands across it, and widgets SHALL show the last values received before the connection dropped while the cursor is in it.

#### Scenario: Robot rebooted

- **GIVEN** the robot was disconnected from 1:10 to 1:40 during a live session
- **THEN** the timeline bar shows a break from 1:10 to 1:40
- **AND** graphs shade 1:10 to 1:40 gray, without lines or bands

### Requirement: Start of disconnected time

Disconnected time MUST start when the robot stopped sending data, not when Studio noticed the connection dropped, which can be seconds later. While the robot sends data, that's the newest value received.

#### Scenario: Network drops

- **GIVEN** Studio is connected to a robot sending data every 20 ms
- **WHEN** the network drops at 1:10, and Studio notices 3 seconds later
- **THEN** the disconnected time starts at 1:10
- **AND** graphs don't hold the last values from 1:10 to 1:13

### Requirement: Unreadable end of a log

When the end of a log couldn't be read (see the data sources spec's damaged log tolerance), the timeline bar SHALL show it after the data, red and hatched, for about as long as it would have lasted at the rate the rest of the log was written. Hovering it MUST show "Couldn't be read" with that estimate, how much of the file couldn't be read, and the time the log stops at. Seeking into it MUST go to the end of the data.

#### Scenario: Most of a log is unreadable

- **GIVEN** a log whose readable part is 3.4 MB over 2:00, followed by 6.6 MB that can't be read
- **THEN** the timeline bar ends with a red hatched section about 3:50 long after 2:00
- **AND** hovering it shows "Couldn't be read", "estimated 3:50", and "The last 66% of the file, after 2:00.00"

### Requirement: Skip idle time

While the skip idle time option is on, disabled and disconnected periods over 15 seconds SHALL be skipped, except for 2 seconds at each end. On the timeline bar, each skipped span SHALL take a small fixed width, hatched so it's clear it isn't to scale, and the rest of the time SHALL share the remaining width evenly. Disabled periods MUST NOT be skipped if the robot was never enabled. A live source's ongoing disabled period SHALL be skipped too, except for its newest 2 seconds.

#### Scenario: Live robot disabled again

- **GIVEN** a live source where the robot was disabled for 5 minutes, enabled for 5 seconds, and has been disabled for 5 minutes since
- **THEN** both disabled periods are hatched and the 5 seconds enabled take up most of the track
- **AND** the newest 2 seconds are shown at normal scale

#### Scenario: Practice log

- **GIVEN** a log where the robot sat disabled for 20 minutes, then ran for 2 minutes
- **THEN** the 2 minutes take up most of the track
- **AND** hovering the hatched span shows "Disabled (skipped)" with its real start and end

#### Scenario: Short gap

- **GIVEN** the robot was disabled for 3 seconds between auto and teleop
- **THEN** that gap is shown at normal scale

#### Scenario: Pit repairs

- **GIVEN** a live session where the robot was off for 10 minutes for repairs
- **THEN** the 10 minutes take a small hatched span of the track

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

The timeline options menu SHALL let the user hide or show alerts and active hub shifts on the timeline and turn skipping idle time on or off, and MUST remember these choices. All are on by default.

#### Scenario: Hide alerts

- **WHEN** the user turns off Show alerts in the timeline options
- **THEN** alerts disappear from the track and its tooltip
- **AND** the track moves to the vertical center of the timeline bar
- **AND** they stay hidden after Studio restarts

#### Scenario: Hide active hub shifts

- **GIVEN** a 2026 match log with FMSInfo
- **WHEN** the user turns off Show active hub shifts in the timeline options
- **THEN** shifts disappear from the track and its tooltip

### Requirement: Go to a time

Clicking the current time in the timeline bar SHALL replace it with a text field for typing a time to move the cursor to, either as it's shown (`m:ss.cc`, with fewer decimal places allowed) or in seconds. Pressing Enter or leaving the field MUST move the cursor there without changing playback, and pressing Escape MUST close the field without moving it. Pressing Enter with something that isn't a time MUST mark the field invalid and keep it open.

#### Scenario: Type a time

- **WHEN** the user clicks the current time, types `1:05.5`, and presses Enter
- **THEN** the cursor moves to 1:05.50

#### Scenario: Type seconds

- **WHEN** the user clicks the current time, types `90`, and presses Enter
- **THEN** the cursor moves to 1:30.00

#### Scenario: Cancel

- **WHEN** the user clicks the current time, types `2:00`, and presses Escape
- **THEN** the cursor doesn't move

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

Studio SHALL remember where the cursor was in each log by file name, and MUST move the cursor there when a log with that name is opened as the window's only source. Adding a log to other sources MUST NOT move the cursor.

#### Scenario: Reopen a log

- **GIVEN** the cursor was at 42.0 s when the user last had `match.wpilog` open
- **WHEN** the user opens `match.wpilog` again in a window without sources
- **THEN** the cursor starts paused at 42.0 s

#### Scenario: New log

- **WHEN** the user opens a log they haven't opened before in a window without sources
- **THEN** the cursor starts paused at the beginning of the log

#### Scenario: Add a log to another

- **GIVEN** the cursor is at 1:30.00 in `qual12.wpilog`
- **WHEN** the user opens `qual13.wpilog`
- **THEN** the cursor stays at 1:30.00

### Requirement: Adding and removing sources

Adding, closing, hiding, or showing a source SHALL keep the playback speed, timeline options, and the moment the cursor is at. While the cursor follows the live session, it MUST keep following when a log is added. When the time base closes or is hidden, the next visible source becomes the time base, and the cursor MUST stay at the same moment.

#### Scenario: Open a log while following live

- **GIVEN** the cursor follows the live session
- **WHEN** the user opens `reference.wpilog`
- **THEN** the cursor keeps following the newest data

#### Scenario: Close the time base

- **GIVEN** the cursor is at the start of auto in `qual12.wpilog` and `qual13.wpilog`, with `qual12.wpilog` on top
- **WHEN** the user closes `qual12.wpilog`
- **THEN** `qual13.wpilog` becomes the time base and the cursor stays at the start of its auto

### Requirement: Several sources on the timeline

The timeline bar SHALL span every visible source, after lining them up (see the data-sources spec's line up sources). The robot's mode, alerts, hub shifts, skipped idle time, disconnected time, and unreadable end shown on it MUST come from the top visible source, and while several sources are visible, hovering them MUST name that source. While the live session is visible, the timeline bar MUST end at its newest data, so logs that extend past it are cut off.

#### Scenario: Logs of different lengths

- **GIVEN** `qual12.wpilog` lasts 3:00 and `practice.wpilog` lasts 10:00, lined up at their first enable
- **THEN** the timeline bar spans from the earliest start to the latest end of the two logs
- **AND** the track is colored by `qual12.wpilog`'s robot mode, since it's on top

#### Scenario: Hide the top source

- **GIVEN** `qual12.wpilog` is above `qual13.wpilog`
- **WHEN** the user hides `qual12.wpilog`
- **THEN** the track is colored by `qual13.wpilog`'s robot mode

#### Scenario: Name the source of the timeline's events

- **GIVEN** `CAPH Q12` is above `CAPH Q13`, and both are visible
- **WHEN** the user hovers an alert on the timeline bar
- **THEN** the tooltip names `CAPH Q12` above the alert

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

Timestamps SHALL be shown as time since the start of the time base (the first record of a log, or the moment a live connection began) in minutes and seconds to the hundredth, like `m:ss.cc`. Times before it starts MUST be shown with a minus sign, ex. `-0:04.20`.

#### Scenario: Log time

- **GIVEN** a log's first record has a robot timestamp of 3,000,000 µs
- **WHEN** the cursor is at a record with timestamp 5,500,000 µs
- **THEN** the time is shown as 0:02.50

#### Scenario: Time over a minute

- **WHEN** the cursor is 65.5 seconds after the start of the time base
- **THEN** the time is shown as 1:05.50
