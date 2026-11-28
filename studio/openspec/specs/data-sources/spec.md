# data-sources Specification

## Purpose

Define how users load data into Studio, by opening WPILOG files and connecting to a live NetworkTables 4 server, how several sources are shown together and lined up in time, and how Studio behaves when sources fail or disconnect.

## Requirements

### Requirement: Several sources

Each window SHALL hold any number of logs and at most one live session, and MUST show every visible source in every dashboard and widget at the same time (see the widgets spec's several sources). Opening a log MUST add it to the window instead of replacing an open log. The live session SHALL last until the user clears it or Connect replaces it, receiving data whether or not it's visible and coming back when Studio reopens (see Restore the live session).

#### Scenario: Open a log while live

- **GIVEN** the user is connected to the robot
- **WHEN** the user opens `qual12.wpilog`
- **THEN** every dashboard shows the live session and `qual12.wpilog` together
- **AND** the live session keeps receiving data
- **AND** no dashboard layout or widget binding changes

#### Scenario: Open another log

- **GIVEN** `qual12.wpilog` is open
- **WHEN** the user opens `qual13.wpilog`
- **THEN** `qual13.wpilog` is added below `qual12.wpilog`
- **AND** every dashboard shows both

#### Scenario: Open several logs at once

- **WHEN** the user picks `qual12.wpilog` and `qual13.wpilog` in the file picker, or drops both on the window
- **THEN** both are added

#### Scenario: Drop a folder of logs

- **GIVEN** a folder holds `qual13.wpilog`, `qual12.wpilog`, and `notes.txt`
- **WHEN** the user drops the folder on the window
- **THEN** `qual12.wpilog` and `qual13.wpilog` are added, in that order by name
- **AND** `notes.txt` and any folders inside it are left out

#### Scenario: Open a log that's already open

- **GIVEN** `qual12.wpilog` is open
- **WHEN** the user opens the same `qual12.wpilog` file or URL again
- **THEN** Studio doesn't read it again or add a second row
- **AND** its row in the source list is highlighted

#### Scenario: No switching between sources

- **GIVEN** the user opened `qual12.wpilog` while connected to the robot
- **THEN** Studio offers no command or shortcut to show one source instead of the other
- **AND** the user hides sources or hides the others instead (see Hide a source and Hide other sources)

### Requirement: Source list

The source list at the top of the sidebar SHALL show one row per source, with the live session first and logs below it. The list MUST grow with each source instead of scrolling or hiding any in a menu. Each row MUST show the source's icon, name, state, and, while several sources are visible, its line style (see the widgets spec's several sources), and keep its actions in its menu (see Source menu). The list's header SHALL have a menu to open a log, open from URL, open a recent log, and connect.

#### Scenario: Three sources

- **GIVEN** the user is connected to the robot and opened `qual12.wpilog`, then `qual13.wpilog`
- **THEN** the source list shows the live session, `qual12.wpilog`, and `qual13.wpilog`, from top to bottom
- **AND** the pages section moves down to make room for them

#### Scenario: Log source shown

- **GIVEN** the user opened `qual12.wpilog`
- **THEN** its row shows `qual12.wpilog`
- **AND** its row shows no line style sample, since it's the only visible source

#### Scenario: Match log source shown

- **GIVEN** the user opened `FRC_20260315_143000_CAPH_Q12.wpilog`
- **THEN** its row shows `CAPH Q12` with a file icon and the local date and time
- **AND** hovering or focusing the row reveals the match type and original filename

#### Scenario: Long log name

- **GIVEN** the user opened `practice_session_with_a_really_long_name.wpilog`, which is too long for the sidebar
- **THEN** its row cuts the name off with an ellipsis
- **AND** hovering or focusing the row shows the whole filename

#### Scenario: Dated log outside a match

- **GIVEN** the user opened `WPILIB_20261118_003735.wpilog`
- **THEN** its row shows the local date and time instead of the filename
- **AND** if the filename names an event but no match, the event appears above the date and time

#### Scenario: HOOT log source shown

- **GIVEN** the user opened `mttd_Q51_rio_2026-11-08_01-20-41.hoot`
- **THEN** its row shows `MTTD Q51` with the local date and time and `roboRIO HOOT`, for the CAN bus it's from
- **AND** a log named by a CANivore's serial number, ex. `FE21E64A394C4853202020500F0D18FF_2026-11-06_18-39-11.hoot`, shows `CANivore HOOT` under the date and time

#### Scenario: Renamed match log source shown

- **GIVEN** the user opened `qual12.wpilog`, a renamed log with the Driver Station's match info for qualification 12 at `CAPH`
- **THEN** its row keeps `qual12.wpilog` and shows that it is for `CAPH Q12`
- **AND** if a recognized filename names a different match, the match from the log data takes precedence

#### Scenario: Live source shown

- **GIVEN** the user is connected to `10.5.81.2`
- **THEN** the live session's row shows the address and the connection state (connecting, connected, reconnecting, or disconnected)

#### Scenario: Close a log

- **GIVEN** the user opened `qual12.wpilog` and `qual13.wpilog` while connected to the robot
- **WHEN** the user chooses Close log from `qual12.wpilog`'s menu
- **THEN** `qual12.wpilog` closes
- **AND** the live session and `qual13.wpilog` are unaffected

#### Scenario: Close the live session

- **GIVEN** the user opened `qual12.wpilog` while connected to the robot
- **WHEN** the user chooses Disconnect, then Clear, from the live session's menu
- **THEN** Studio disconnects, throws away the live data, and shows `qual12.wpilog`

#### Scenario: No source

- **GIVEN** no source is open
- **THEN** the source list prompts the user to open a log or connect

### Requirement: Sources in the sidebar rail

While the sidebar is collapsed to its rail, the rail SHALL show one icon per source in source list order, up to 4, followed by "+N" for the rest.

#### Scenario: Collapsed sidebar

- **GIVEN** the user is connected to the robot and opened 5 logs
- **WHEN** the sidebar is collapsed to its rail
- **THEN** the rail shows the live session's icon and 3 log icons, followed by "+3"

### Requirement: Source menu

A source's menu SHALL open by clicking, tapping, or pressing Enter on its row, without a separate actions button. Right-clicking or long-pressing the row SHALL still open its context menu. Picking up, dropping, or canceling a drag MUST NOT open the menu (see Source order).

#### Scenario: Drag a source without opening its menu

- **GIVEN** the user opened `qual12.wpilog` and `qual13.wpilog`
- **WHEN** the user drags `qual13.wpilog` above `qual12.wpilog` and lets go
- **THEN** the rows reorder without opening a menu

### Requirement: Source menu items

Every source's menu SHALL offer Hide or Show (see Hide a source), and while there are other sources, Hide others (see Hide other sources). The live session's menu MUST offer its connection actions (see Disconnect and clear). A log's menu MUST offer Close log, and once it's loaded, the menu opened by activating its row MUST show its time offset above its items (see Time offset). In the desktop app, every source's menu MUST offer Move to (see the platforms spec's move sources between windows).

#### Scenario: Open a log's menu

- **GIVEN** the user opened `qual12.wpilog` and `qual13.wpilog`
- **WHEN** the user clicks `qual13.wpilog`'s row
- **THEN** its menu shows its time offset and offers Hide, Hide others, and Close log
- **AND** both logs stay visible in every dashboard

### Requirement: Source order

The top source in the source list SHALL be the time base that other sources line up with (see Line up sources), and MUST draw with a solid line. Users MUST be able to reorder logs by dragging their rows. The live session MUST stay at the top. Reordering MUST NOT move sources in time relative to each other.

#### Scenario: Compare against another log

- **GIVEN** the user opened `qual12.wpilog`, then `qual13.wpilog`
- **WHEN** the user drags `qual13.wpilog` above `qual12.wpilog`
- **THEN** `qual13.wpilog` is the time base and draws solid, and `qual12.wpilog` draws dashed
- **AND** widgets keep showing the same moment of each log

#### Scenario: Live session stays first

- **GIVEN** the user opened `qual12.wpilog` while connected to the robot
- **WHEN** the user drags `qual12.wpilog` toward the top of the list
- **THEN** it can't be dropped above the live session

### Requirement: Hide a source

Hide in a source's menu SHALL hide the source without closing it, and Show MUST show it again. A hidden source's row MUST be dimmed and leave out its line style sample. A hidden source MUST keep its data, and a hidden live session MUST keep receiving and recording data, but a hidden source MUST NOT be drawn in widgets, listed in the entry browser, or count toward the timeline's range.

#### Scenario: Hide a log

- **GIVEN** the user opened `qual12.wpilog` and `qual13.wpilog`
- **WHEN** the user hides `qual13.wpilog`
- **THEN** widgets only draw `qual12.wpilog`
- **WHEN** the user shows `qual13.wpilog` again
- **THEN** it's drawn right away, without reading the file again

### Requirement: Hide other sources

Hide others in a source's menu SHALL show that source and hide every other source. While it's the only visible source, the item MUST read Show others instead, and MUST show every source.

#### Scenario: Hide other sources

- **GIVEN** the user opened `qual12.wpilog` and `qual13.wpilog` while connected to the robot
- **WHEN** the user chooses Hide others from the live session's menu
- **THEN** only the live session is drawn
- **WHEN** the user chooses Show others from its menu
- **THEN** every source is drawn

### Requirement: Line up sources

Studio SHALL line each log up with the time base using one time offset, chosen by matching when each was enabled, disabled, and in auto or teleop, so the same moments of different matches line up, and so do logs from the same run on different clocks. When either log was never enabled, or their enabled times can't be matched, Studio MUST line up their starts. A log MUST be lined up when it's added, and MUST keep its offset until the user changes it or lines it up again.

#### Scenario: Compare two matches

- **GIVEN** auto starts 2:16.94 into `qual12.wpilog` and 1:05.20 into `qual13.wpilog`
- **WHEN** the user opens `qual12.wpilog`, then `qual13.wpilog`
- **THEN** the start of auto in both logs is at the same time on the timeline

#### Scenario: Logs from the same run

- **GIVEN** a roboRIO log and a coprocessor log of the same match, each on its own clock
- **WHEN** the user opens both
- **THEN** the times the robot was enabled and disabled line up in both logs

#### Scenario: Log that was never enabled

- **GIVEN** `qual12.wpilog` is open
- **WHEN** the user opens `bench-test.wpilog`, in which the robot was never enabled
- **THEN** both logs start at the same time on the timeline

### Requirement: Line up with the live session

While a live session is open, it's the time base, and logs MUST line up with its latest enable instead of its whole history. A log added before the live session was ever enabled MUST line up with the start of the live session, then line up with its first enable once it happens. The live session's menu SHALL offer Line up logs with latest enable, which lines every log up with its most recent enable.

#### Scenario: Compare live with a reference log

- **GIVEN** the user is connected to the robot, which just ran auto
- **WHEN** the user opens `reference.wpilog`
- **THEN** the start of auto in `reference.wpilog` lines up with the start of the auto the robot just ran

#### Scenario: Run auto again

- **GIVEN** `reference.wpilog` is lined up with the robot's previous run
- **AND** the robot ran auto again
- **WHEN** the user chooses Line up logs with latest enable from the live session's menu
- **THEN** the start of auto in `reference.wpilog` lines up with the start of the auto the robot just ran

#### Scenario: Open a log before enabling

- **GIVEN** the user is connected to the robot, which hasn't been enabled
- **WHEN** the user opens `reference.wpilog`
- **THEN** `reference.wpilog` starts when the live session started
- **WHEN** the robot is enabled for the first time
- **THEN** `reference.wpilog`'s first enable lines up with it

### Requirement: Time offset

A log's menu SHALL have a field for how far it's shifted from where it would be if its clock matched the time base's, ex. "+1:11.74". While the log is lined up automatically (see Line up sources and Line up with the live session), the field MUST be blank with the automatic offset as its placeholder. Typing an offset MUST move the log right away, and clearing the field MUST line it up automatically again. The time base's menu MUST NOT show an offset.

#### Scenario: Fine-tune an offset

- **GIVEN** `qual13.wpilog` is lined up with `qual12.wpilog` with an offset of +1:11.74
- **THEN** the offset field is blank, with +1:11.74 as its placeholder
- **WHEN** the user changes the offset to +1:11.80
- **THEN** `qual13.wpilog` is drawn 0.06 s later on the timeline, and the field shows +1:11.80
- **WHEN** the user clears the field
- **THEN** the offset goes back to +1:11.74

#### Scenario: Focus the offset field

- **GIVEN** `qual13.wpilog` is lined up automatically
- **WHEN** the user focuses its offset field, then closes the menu without typing
- **THEN** it stays lined up automatically

### Requirement: Open a log file

Users SHALL be able to open WPILOG files with a file picker or by dropping them anywhere on the app window. Picking or dropping several MUST add each, in the order given. Studio MUST also open XZ-compressed WPILOG files (`.wpilogxz`), and MUST show what it could decompress from one that was cut off, ex. by the robot losing power. Studio MUST open local HOOT files in format C19 or C21 using the same picker and drop paths.

#### Scenario: Open with the file picker

- **WHEN** the user chooses Open log and selects a `.wpilog` file
- **THEN** that log is added to the window

#### Scenario: Loading progress

- **WHEN** the user opens a large log
- **THEN** the timeline shows its loading progress, which reaches 100% only once every entry has been read and is ready to show
- **AND** the entries dashboards show, and the ones the timeline reads, are drawn first, before the rest of the log is read
- **AND** the log's other entries appear together once it's loaded, not one at a time while it loads

#### Scenario: Open a compressed log

- **WHEN** the user opens a `.wpilogxz` file
- **THEN** that log opens the same as the `.wpilog` file it was compressed from

#### Scenario: Open a local HOOT log in the browser

- **WHEN** the user picks or drops a `.hoot` file in format C19 or C21
- **THEN** Studio decodes it locally without an upload, native converter, or desktop app
- **AND** supported entries can be viewed and graphed on the log's timeline
- **AND** Studio skips signals it doesn't know how to decode

#### Scenario: Unsupported HOOT version

- **WHEN** the user opens a `.hoot` file in a format Studio doesn't support
- **THEN** Studio reports that only C19 and C21 are supported

#### Scenario: Drag and drop

- **WHEN** the user drops a `.wpilog` file anywhere on the app window
- **THEN** that log is added to the window

#### Scenario: Drop logs with other files

- **WHEN** the user drops `qual12.wpilog`, `notes.txt`, and `qual13.wpilog` on the app window
- **THEN** `qual12.wpilog` and `qual13.wpilog` are added, in that order
- **AND** `notes.txt` is ignored

#### Scenario: Dragging a potential log over the window

- **WHEN** the user drags a potential log file over the window outside a widget accepting the drag
- **THEN** an overlay shows that dropping it opens the log
- **AND** the overlay hides when the file is dropped or dragged out of the window

#### Scenario: Video dropped outside a video widget

- **WHEN** the user drops a video file outside a video widget
- **THEN** Studio doesn't try to open it as a log
- **AND** no source is added

#### Scenario: Values set before logging started

- **GIVEN** a log with NetworkTables values a coprocessor set before the robot started logging, which are logged with negative timestamps
- **WHEN** the user opens it
- **THEN** each of those entries has the latest of those values at the start of the log, unless it was also logged right at the start
- **AND** the log ends at its last record

### Requirement: HOOT CAN buses

Studio SHALL put the CAN bus in the entry names of a HOOT log's devices, after `/Phoenix6`, so the devices of several HOOT logs opened together don't share entries. C19 logs, which have one file per CAN bus, MUST use the bus their file is from, with the roboRIO's bus named `rio` and a CANivore named as robot code names it. Other logs MUST use the bus names they have, ex. a Systemcore's onboard buses.

#### Scenario: Two buses with the same IDs

- **GIVEN** the user opened `mttd_Q51_rio_2026-11-08_01-20-41.hoot` and the log from the CANivore `581CANivore` for the same match, both C19
- **AND** both buses have a Talon FX with ID 16
- **THEN** the entry browser lists `/Phoenix6/rio/TalonFX-16/Velocity` and `/Phoenix6/581CANivore/TalonFX-16/Velocity`

### Requirement: HOOT device names

Studio SHALL rename the devices in a HOOT log, opened or embedded, with the names in a robot's `devices`, since HOOT logs only name devices by model and ID. A device's model and ID in its entry names MUST be replaced with its name, keeping the CAN bus. Devices without a name and custom signals MUST keep their names.

#### Scenario: Name a motor

- **GIVEN** an added robot project whose robot has `"devices": { "rio": { "TalonFX-16": "Intake/Left" } }`
- **WHEN** the user opens a HOOT log from the roboRIO's CAN bus with signals from `TalonFX-16` and `TalonFX-17`
- **THEN** the entry browser lists `/Phoenix6/rio/Intake/Left/Velocity` and `/Phoenix6/rio/TalonFX-17/Velocity`

#### Scenario: Same ID on different models

- **GIVEN** a robot with `"TalonFX-11": "Shooter/Left"` and `"CANcoder-11": "Shooter/Encoder"` on `rio`
- **THEN** the log's Talon FX 11 and CANcoder 11 are renamed `Shooter/Left` and `Shooter/Encoder`

#### Scenario: Embedded HOOT file

- **GIVEN** a log with a HOOT file from the roboRIO's CAN bus embedded in `/Hoot`, and a robot that names `TalonFX-16` on `rio` `Intake/Left`
- **THEN** the entry browser lists `/Hoot/Phoenix6/rio/Intake/Left/Velocity`

### Requirement: Robot for HOOT device names

Studio SHALL rename a HOOT log's devices with the names of the robot whose `devices` names the most of them on the same CAN bus, from every added robot project, without asking. When robots tie, the one added most recently MUST be used, and when no robot names any of them, nothing MUST be renamed.

#### Scenario: Closest robot

- **GIVEN** a competition robot that names `TalonFX-16` and `TalonFX-17` on `rio`, and a practice robot that names them on `581CANivore`
- **WHEN** the user opens a HOOT log from the practice robot's `581CANivore`
- **THEN** its devices are renamed with the practice robot's names

### Requirement: Updated HOOT device names

Studio SHALL rename open HOOT logs' devices again, without reopening them, when a robot project is added or removed, or when its `devices` change, which Studio MUST notice when its window is focused. Names MUST still be used when the web app can't read the project's folder until the user allows it again.

#### Scenario: Edit device names

- **GIVEN** an open HOOT log whose `TalonFX-16` was renamed `Intake/Left`
- **WHEN** the user renames it `Intake/Leader` in `doglog.jsonc`, then switches back to Studio
- **THEN** the entry browser lists `/Phoenix6/rio/Intake/Leader/Velocity` instead of `/Phoenix6/rio/Intake/Left/Velocity`

#### Scenario: Reopened web app

- **GIVEN** the web app, with an added robot project that names devices
- **WHEN** the user reopens the web app, and opens a HOOT log before allowing access to the project's folder again
- **THEN** its devices are renamed with the project's names

### Requirement: Open a log from a URL

Users SHALL be able to open a `.wpilog` or `.wpilogxz` file from an `http://` or `https://` URL, including via an in-app "Open from URL..." dialog in the source list's header menu and macOS File menu. Other schemes like `file://` MUST be rejected, including after redirects. Scheme-less URLs SHALL default to `https://` when they do not start with `/` and their host is `localhost` or contains a dot. URL logs MUST stay in memory only and MUST NOT be added to recent logs.

#### Scenario: Open a valid log URL from the dialog

- **WHEN** the user opens "Open from URL..." and enters `https://example.com/qual12.wpilog`
- **THEN** Studio displays `qual12.wpilog` and begins rendering its data after the download completes
- **AND** `qual12.wpilog` is not added to recent logs

#### Scenario: Scheme-less URL

- **WHEN** the user enters `example.com/qual12.wpilog`
- **THEN** Studio fetches `https://example.com/qual12.wpilog`

#### Scenario: Rejected scheme

- **WHEN** a URL uses `file:///tmp/qual12.wpilog`
- **THEN** Studio rejects it without attempting to read the file

### Requirement: Streaming URL log download and progress

Studio SHALL check HTTP status, `Content-Type`, and the first 6 magic bytes (`WPILOG` or XZ) before adding the log to the source list. Studio MUST stream downloads and decompress XZ incrementally. After download, Studio SHALL publish dashboard-bound entries before the rest. The timeline SHALL show determinate progress when `Content-Length` is known, indeterminate progress otherwise, and a Cancel button that aborts the download and removes the log.

#### Scenario: Cancel a download

- **GIVEN** the user is connected to the robot and a large log URL is downloading
- **WHEN** the user clicks Cancel on the progress bar
- **THEN** Studio aborts the download and removes the log
- **AND** the live session is unaffected

#### Scenario: Filename derivation

- **GIVEN** a URL redirects to a path ending in `match.wpilog` and sends `Content-Disposition: attachment; filename="qual12.wpilog"`
- **WHEN** Studio opens the URL
- **THEN** Studio displays `qual12.wpilog` (falling back to the decoded final URL path segment, then `log.wpilog`)

### Requirement: URL log error handling

HTTP 401 and 403 responses MUST explain that the link requires signing in or permission. `text/html` responses MUST fail fast before reading the body, explaining that the URL returned a web page instead of a WPILOG file, and on desktop MUST offer a toast action to open the URL in the browser. Non-WPILOG responses MUST abort after the first chunk. Mid-download network drops or responses shorter than `Content-Length` MUST fail as download errors instead of showing a partial log.

#### Scenario: Login wall returns HTML

- **GIVEN** a URL redirects to a sign-in page with `Content-Type: text/html`
- **AND** another log is already open
- **WHEN** the user opens that URL in the desktop app
- **THEN** Studio aborts before downloading the page, adds no source, and leaves the already open log as it was
- **AND** explains that the URL returned a web page instead of a WPILOG file, with an action to open it in the browser

#### Scenario: Mid-download network drop

- **GIVEN** a server advertises `Content-Length` of 50 MB and disconnects after 20 MB
- **WHEN** the stream ends early
- **THEN** Studio reports a download error instead of showing a partial log
- **AND** a complete HTTP response whose WPILOG payload is truncated still applies normal damaged log tolerance

### Requirement: Connect to a live NT4 server

Users SHALL be able to connect to a robot or simulator over NT4 with a single Connect action, using the connection target from Settings. The source list MUST NOT offer separate actions for the robot and the simulator.

#### Scenario: Connect to a robot by team number

- **GIVEN** Settings has team number 581
- **AND** the robot is reachable
- **WHEN** the user chooses Connect
- **THEN** Studio connects to the robot address for team 581

#### Scenario: Connect to a simulator

- **GIVEN** the robot is not reachable and a simulator is running
- **WHEN** the user chooses Connect
- **THEN** Studio connects to an NT4 server on localhost

### Requirement: Reduced live bandwidth

When Reduce live bandwidth is on, Studio SHALL ask the server to send only the latest change about every 2 seconds for background topics, and about every 20 ms for dashboard bindings and their source topics, robot status, alerts, and tunables. Topics MUST remain discoverable, and recording MUST keep all updates that Studio receives. With the setting off, Studio SHALL request every change at its normal 20 ms cadence.

#### Scenario: Add and remove a dashboard binding while connected

- **GIVEN** Reduce live bandwidth is on and a topic is updating in the background
- **WHEN** the user binds one of its fields to a widget
- **THEN** Studio requests faster updates for the underlying topic without reconnecting
- **WHEN** the user removes its last binding and no other feature needs faster updates for it
- **THEN** the topic returns to the background rate without losing its history

#### Scenario: Tabs share a live connection

- **GIVEN** several live sessions share one connection with Reduce live bandwidth on
- **THEN** the server is asked for faster updates for every topic any of the sessions needs

### Requirement: Live connection resilience

Studio MUST keep all data received from a live source when the connection drops, and SHALL reconnect automatically. Received data MUST be kept until the user clears the live session or Connect replaces it with another target, including after Studio closes.

#### Scenario: Robot reboots mid-session

- **GIVEN** Studio is connected and has received data
- **WHEN** the connection drops
- **THEN** the live session's row shows the reconnecting state
- **AND** all previously received data remains viewable
- **AND** Studio keeps trying to reconnect

#### Scenario: Reconnect

- **GIVEN** the connection dropped
- **WHEN** the server becomes reachable again
- **THEN** Studio reconnects without user action
- **AND** new data is added to the same session history
- **AND** the time it was disconnected is marked on the timeline

### Requirement: Shared robot connection

Studio tabs and windows SHALL share one NT4 connection to each server, for their live sessions, shared dashboards, and log sync, so a robot isn't sent the same data once for each of them. Each tab or window MUST still connect and disconnect its own live session, and the connection MUST close once no tab or window uses it. Where the platform can't share connections, each tab or window MAY open its own.

#### Scenario: Two windows connected to the robot

- **GIVEN** a Studio window is connected to the robot
- **WHEN** the user opens another window and connects it to the robot
- **THEN** the robot has one connection from Studio
- **AND** both windows receive its data

#### Scenario: Disconnect one window

- **GIVEN** two Studio windows are connected to the robot
- **WHEN** the user disconnects one of them
- **THEN** the other window stays connected

### Requirement: Disconnect and clear

The source list's header menu SHALL offer Connect when no live session is open. The live session's menu SHALL offer Disconnect while connecting, connected, or reconnecting, and Reconnect and Clear once disconnected. Disconnect MUST stop reconnecting and keep the received data. If the session never connected, Disconnect MUST close it. Reconnect MUST continue the same session. Clear MUST close the session and delete its data and recording.

#### Scenario: Disconnect

- **GIVEN** Studio is connected to the robot
- **WHEN** the user chooses Disconnect
- **THEN** the live session's row shows the disconnected state
- **AND** the received data remains viewable
- **AND** the menu offers "Reconnect to robot" and "Clear"

#### Scenario: Clear after disconnecting

- **GIVEN** the user disconnected from the robot and has `qual12.wpilog` open
- **WHEN** the user chooses Clear
- **THEN** the live session is closed
- **AND** `qual12.wpilog` becomes the time base

#### Scenario: Disconnect before connecting

- **GIVEN** a live session that has never connected was moved to another window, where it shows as reconnecting
- **WHEN** the user chooses Disconnect
- **THEN** the live session is closed, since it has no data

### Requirement: Live recording

Studio SHALL record every live session to a WPILOG file on the user's device as data arrives, with no setting to turn it off, and MUST write what it received at least once a second. Each tab or window MUST record its own session, even when they share a connection. A recording MUST last as long as its session: clearing the session, or Connect replacing it with another target, deletes it. Unlike the session's history in memory, a recording MUST NOT drop old data.

#### Scenario: Two windows connected to the robot

- **GIVEN** two Studio windows are connected to the robot
- **THEN** each window records its own session
- **WHEN** the user clears the live session in one window
- **THEN** only that window's recording is deleted

### Requirement: Recording contents

A recording MUST contain every topic and value the session received as the server sent it, including values Studio can't decode, struct schemas as text, each protobuf schema once, and topic property changes as entry metadata. It MUST NOT contain the topics Studio uses to share dashboards, or entries Studio derives, ex. struct fields. It SHALL also contain entries under `/DogLogStudio/` for when each connection started and ended, and both clocks when it started.

#### Scenario: Values Studio can't decode

- **GIVEN** Studio is connected to a robot publishing msgpack values to `/Vision/Result`
- **THEN** `/Vision/Result` is listed as unsupported
- **AND** the recording has every value the robot sent for it

### Requirement: Recording times

Times in a recording SHALL be on the server's clock, so a robot's recording lines up with its own logs. A value changed before Studio connected MUST keep the time it changed, and one without a known time is recorded when the connection was made. When the server's clock goes back, ex. after the robot is power cycled, later data MUST continue from the last recorded time plus how long Studio was disconnected. The live session keeps Studio's clock.

#### Scenario: Robot power cycled during a session

- **GIVEN** Studio is connected to the robot, and the recording reached 300 s on the robot's clock
- **WHEN** the robot is power cycled and Studio reconnects to it 40 s later
- **THEN** data received after reconnecting is recorded starting at 340 s

### Requirement: Recording failure

When the recording can't be written, ex. because storage is full, the live session MUST keep receiving data, and Studio SHALL warn once that recording stopped. The recording keeps what was written before it stopped.

#### Scenario: Storage is full

- **GIVEN** Studio is connected to the robot
- **WHEN** the recording can't be written because storage is full
- **THEN** Studio warns that recording stopped
- **AND** the live session keeps receiving data

### Requirement: Restore the live session

When Studio reopens after closing with a live session, including after a crash, each window SHALL restore the most recent recording that no other window has restored. It MUST show the same data, disconnect gaps, and times as before Studio closed, up to the most history a live session keeps in memory, and mark the time Studio was closed as a gap. It MUST reconnect to the same server, unless the user had disconnected it. A session that never connected isn't restored.

#### Scenario: Reopen after a crash

- **GIVEN** Studio was connected to the robot for 10 minutes
- **WHEN** Studio crashes and the user opens it again
- **THEN** the live session shows the 10 minutes of data
- **AND** Studio reconnects to the robot, adding to the same session
- **AND** the time Studio was closed is marked on the timeline

#### Scenario: Reopen a disconnected session

- **GIVEN** the user disconnected from the robot and quit Studio
- **WHEN** the user opens Studio again
- **THEN** the live session shows the data it received, in the disconnected state
- **AND** the menu offers "Reconnect to robot" and "Clear"

#### Scenario: Several windows

- **GIVEN** two Studio windows each had a live session when Studio quit
- **WHEN** the user opens Studio, then opens another window
- **THEN** the first window restores the session that received data most recently
- **AND** the new window restores the other session

### Requirement: Export live data

The live session's menu SHALL offer Export as WPILOG in its own section above its connection actions whenever the live session has data. Exporting MUST save a copy of the whole recording, including history no longer kept in memory, without interrupting the session. The desktop app MUST ask where to save it, and the web app MUST download it. The suggested file name MUST be `WPILIB_<date>_<time>.wpilog` with the date and time the session started in UTC, like WPILib names its logs.

#### Scenario: Export while connected

- **GIVEN** Studio has been connected to the robot since 22:30 UTC on November 21, 2026
- **WHEN** the user chooses Export as WPILOG in the desktop app
- **THEN** the save dialog suggests `WPILIB_20261121_223000.wpilog`
- **AND** Studio stays connected, still adding to the same session

#### Scenario: Export a long session

- **GIVEN** the live session received more data than Studio keeps in memory, so its oldest data is no longer shown
- **WHEN** the user exports it
- **THEN** the file includes the oldest data

#### Scenario: Export in the web app

- **GIVEN** the user is connected to the simulator in the web app
- **WHEN** the user chooses Export as WPILOG
- **THEN** the browser downloads the recording

### Requirement: Open an exported recording

Tools that don't read Studio's entries see no values published while Studio was disconnected. Studio MUST mark those gaps on the timeline when it opens an exported recording as a log, and MUST start it when Studio first connected.

#### Scenario: Open an export

- **GIVEN** the user exported a session in which the robot disconnected for 5 s
- **WHEN** the user opens the exported file
- **THEN** its entries have the values the live session received, at times on the robot's clock
- **AND** the 5 s the robot was disconnected is marked on the timeline
- **AND** Studio's recording entries aren't shown

### Requirement: Damaged log tolerance

When part of a log can't be read, Studio MUST load every record before the damage and tell the user how much is missing instead of failing to open the log. Studio MUST NOT load anything after the first record that can't be read, even if it looks valid. When a log can't be opened at all, Studio MUST NOT add it, and other sources MUST stay as they were.

#### Scenario: Partial last record

- **WHEN** the user opens a log whose last record is cut off
- **THEN** every other record is available
- **AND** Studio doesn't warn, since this is normal when the robot is turned off

#### Scenario: Unreadable end of a log

- **GIVEN** a log whose last 66% is blocks the file system reserved but never wrote, which hold leftover data instead of records
- **AND** its readable part stops at 1:59.42
- **WHEN** the user opens it
- **THEN** every record before the damage is available
- **AND** Studio warns that the log, named by its file name, is corrupted: the last 66% of the file is unreadable, and an estimate of how long that is after 1:59.42, from the rate the rest of the log was written

#### Scenario: Value that can't be decoded

- **GIVEN** a log with a struct or protobuf value that doesn't match its schema, or a schema that can't be parsed
- **WHEN** the user opens it
- **THEN** only the values that can't be decoded are missing
- **AND** every record after them is still available

#### Scenario: Unreadable log

- **WHEN** the user opens a log that's empty, or so damaged that none of its entries can be read
- **THEN** Studio says it couldn't open the log, and why

### Requirement: Supported data types

Studio SHALL decode numeric, boolean, string, array, WPILib struct, and protobuf entries. Entries of unsupported types MUST still be listed and marked as unsupported.

#### Scenario: Struct entry

- **GIVEN** a log contains a `Pose2d` struct entry
- **THEN** its fields are decoded and available to widgets
- **AND** its type is shown as `Pose2d`, without the `struct:` prefix

#### Scenario: Struct schemas

- **GIVEN** a source contains the `/.schema/struct:Pose2d` schema entry
- **THEN** the schema is used to decode `Pose2d` entries
- **AND** the schema entry isn't listed anywhere in Studio

#### Scenario: Struct schemas sent before the live session connected

- **GIVEN** Studio is already connected to an NT4 server, ex. to sync shared dashboards or from a live session that was disconnected
- **WHEN** a live session connects to that server
- **THEN** struct entries are decoded with the schemas the server already sent

#### Scenario: Protobuf entry

- **GIVEN** a log contains a `proto:wpi.proto.ProtobufTrajectory` entry
- **THEN** its type is shown as `ProtobufTrajectory`
- **AND** each field logged in it is available to widgets, ex. `/Auto/Trajectory/states/3/velocity`, including fields and repeated elements first logged partway through

#### Scenario: Protobuf schemas

- **GIVEN** a source contains `/.schema/proto:` schema entries
- **THEN** they're used to decode protobuf entries, including values logged or received before them
- **AND** the schema entries aren't listed anywhere in Studio

### Requirement: Embedded logs

Studio SHALL read logs embedded in a log's entries, which let one WPILOG file hold a robot's other logs, ex. vendor or coprocessor logs. An embedded log is a raw entry with a `log:<format>` type, ex. `log:hoot`, whose records joined in time order are the bytes of the embedded log's file. Studio MUST list the entries of embedded WPILOG, WPILOGXZ, and HOOT files under the entry they're embedded in, and MUST list embedded logs of other formats marked as unreadable.

#### Scenario: Embedded WPILOG file

- **GIVEN** a log with a coprocessor's WPILOG file embedded in `/WPILOG`, which has `/Arm/Angle`
- **WHEN** the user opens it
- **THEN** the entry browser lists `/WPILOG/Arm/Angle`, and widgets can show it like any other entry

#### Scenario: Embedded HOOT file

- **GIVEN** a log with a Phoenix 6 HOOT file embedded in `/Hoot`
- **THEN** the entry browser lists its signals under `/Hoot`, ex. `/Hoot/Phoenix6/rio/TalonFX-5/Velocity`
- **AND** `/Hoot/RobotEnable` changes when the robot's `/DS:controlWord` says it was enabled and disabled

#### Scenario: Unreadable embedded log

- **GIVEN** a log with a REV status log embedded in `/REVLOG`
- **THEN** `/REVLOG` is listed with a `.revlog log` type and marked as unreadable, and can't be bound to widgets

### Requirement: Embedded log times

Studio MUST line up an embedded log's times with the robot's data, whatever clock it was written on, since data is captured into a log only after it's written. It MUST stay lined up when some of it was captured late.

#### Scenario: Embedded log on another clock

- **GIVEN** a log with an embedded log written on another computer's clock, some of which was captured into the log within 4 ms of being written
- **AND** other parts were captured seconds after they were written, ex. while logging was paused
- **THEN** the embedded log's entries line up with the robot's data within 4 ms

#### Scenario: Embedded log on the robot's clock

- **GIVEN** an embedded log written on the robot's clock
- **THEN** its entries keep their times

#### Scenario: Embedded log captured late

- **GIVEN** an embedded log that was all captured long after it was written
- **AND** it and the log it's embedded in both have Driver Station data, ex. Phoenix's `RobotEnable` in a HOOT file
- **THEN** its entries are lined up by when the robot was enabled, since devices can log being disabled late

### Requirement: Export an embedded log

Users MUST be able to export the original file of any embedded log, the same way as exporting live data.

#### Scenario: Export an embedded log

- **GIVEN** the user opened `qual12.wpilog`, which has a log embedded in `/Hoot`
- **WHEN** the user right-clicks `/Hoot` and chooses Export original log
- **THEN** Studio saves `qual12_Hoot.hoot`, the same bytes as the file that was embedded

### Requirement: Mechanism2d entries

Studio SHALL add an entry of type `Mechanism2d` for each group of entries with a `.type` entry set to `Mechanism2d`, named after the group, so a WPILib `Mechanism2d` can be bound to widgets as one entry. The group's own entries MUST still be listed. Mechanisms MUST be read whether their roots log a `position` array, as WPILib 2027 does, or `x` and `y` entries, as WPILib 2026 does.

#### Scenario: Mechanism logged with DogLog

- **GIVEN** a log with `/Robot/Arm/Mechanism/.type` set to `Mechanism2d`, `/Robot/Arm/Mechanism/dims`, and the mechanism's roots and ligaments
- **THEN** the entry browser lists `/Robot/Arm/Mechanism` as a `Mechanism2d` entry, with the group's entries in it

#### Scenario: Mechanism from NetworkTables

- **GIVEN** a robot publishing a `Mechanism2d` on NetworkTables with WPILib 2026, under `/SmartDashboard/Arm`
- **THEN** `/SmartDashboard/Arm` is a `Mechanism2d` entry, with its roots at their `x` and `y`

### Requirement: Entry metadata

Studio SHALL read each entry's JSON metadata from WPILOG entry metadata and from NT4 topic properties, and MUST use the most recent metadata when it changes. Metadata that isn't valid JSON SHALL be treated as empty.

#### Scenario: Log metadata

- **GIVEN** a log entry `/Arm/Angle` with metadata `{"unit": "deg"}`
- **THEN** Studio knows `/Arm/Angle` is in degrees

#### Scenario: Live topic properties

- **GIVEN** Studio is connected to a robot publishing `/Arm/Angle` with the topic property `"unit": "deg"`
- **THEN** Studio knows `/Arm/Angle` is in degrees

#### Scenario: Metadata changes

- **GIVEN** a log entry's metadata is set to `{"unit": "rad"}` and later to `{"unit": "deg"}`
- **THEN** Studio uses `{"unit": "deg"}`

### Requirement: NetworkTables entries in logs

Logs that record NetworkTables keep its topics under `/NT:`, ex. `/NT:/FMSInfo/EventName` for the live topic `/FMSInfo/EventName`. Studio SHALL show entries under the names the source gives them, and wherever Studio finds an entry by name, ex. for a widget binding or Driver Station data, it MUST use the entry with exactly that name when the source has one, and otherwise the same topic under its other name. Two entries MUST NOT be merged, even when they only differ by the `/NT:` prefix.

#### Scenario: Live binding opened on a log

- **GIVEN** a widget bound to `/limelight-front/tx` while connected to a robot
- **WHEN** the user opens a log from that robot with `/NT:/limelight-front/tx`
- **THEN** the widget shows `/NT:/limelight-front/tx`
- **AND** the binding is still `/limelight-front/tx`

#### Scenario: Log binding shown live

- **GIVEN** a widget bound to `/NT:/FMSInfo/MatchTime` from a log
- **WHEN** the user connects to a robot publishing `/FMSInfo/MatchTime`
- **THEN** the widget shows `/FMSInfo/MatchTime`

#### Scenario: Log with both names

- **GIVEN** a log with `/Robot/Pose` logged directly and `/NT:/Robot/Pose` recorded from NetworkTables
- **THEN** the entry browser lists both
- **AND** a widget bound to `/Robot/Pose` shows the directly logged entry

### Requirement: Studio's own topics

Entries under `/DogLogStudio/`, which Studio uses to share dashboards and record live sessions, SHALL NOT be shown, whether they come from a live NT4 server or from a log that recorded NetworkTables (ex. `NT:/DogLogStudio/`).

#### Scenario: Robot log with shared dashboards

- **GIVEN** a robot log recorded NetworkTables while dashboards were shared
- **WHEN** the user opens it
- **THEN** no `/DogLogStudio/` entries are shown

### Requirement: Connect target selection

Connect SHALL try the robot connection target and the simulator at the same time, connect to the robot if it is reachable and otherwise to the simulator, and MUST keep trying both until one is reachable without showing an error. Connect MUST NOT replace the live session unless it would connect to a different target, so the received data isn't thrown away.

#### Scenario: Robot available

- **GIVEN** the robot is reachable
- **WHEN** the user chooses Connect
- **THEN** Studio connects to the robot, even if a simulator is also running

#### Scenario: Only the simulator is running

- **GIVEN** the robot is not reachable and a simulator is running
- **WHEN** the user chooses Connect
- **THEN** Studio connects to the simulator

#### Scenario: Nothing reachable yet

- **GIVEN** neither the robot nor a simulator is reachable
- **WHEN** the user chooses Connect
- **THEN** the live session's row shows the connecting state
- **AND** Studio connects as soon as one becomes reachable

#### Scenario: No robot target

- **GIVEN** Settings has no valid robot connection target
- **WHEN** the user chooses Connect
- **THEN** Studio only tries the simulator

#### Scenario: Connect while connected

- **GIVEN** Studio is connected to the robot
- **WHEN** the user opens the source list's header menu
- **THEN** it doesn't offer Connect, and the live session's menu offers Disconnect
- **AND** the Connect shortcut does nothing

#### Scenario: Connect while reconnecting

- **GIVEN** the connection to the robot dropped
- **AND** the simulator isn't running
- **WHEN** the user opens the source list's header menu
- **THEN** it doesn't offer Connect, and the live session's menu offers Disconnect
- **AND** the Connect shortcut does nothing

#### Scenario: Switch targets while reconnecting

- **GIVEN** the connection to the robot dropped
- **AND** a simulator is running
- **WHEN** the user presses the Connect shortcut, or disconnects and chooses "Connect to simulator"
- **THEN** Studio connects to the simulator, replacing the robot's data

### Requirement: Connect target preview

The source list's Connect action SHALL show whether it would connect to the robot or the simulator. Studio SHALL check the targets when it starts and when the menu opens, and MUST NOT check them at any other time. Studio MUST NOT check a target when doing so would show a browser permission prompt.

#### Scenario: Robot available

- **GIVEN** the robot is reachable
- **WHEN** the user opens the source list's header menu
- **THEN** the Connect action reads "Connect to robot"

#### Scenario: Only the simulator is running

- **GIVEN** the robot is not reachable and a simulator is running
- **WHEN** the user opens the source list's header menu
- **THEN** the Connect action reads "Connect to simulator"

#### Scenario: Target available at startup

- **GIVEN** a simulator is running
- **WHEN** Studio starts and the user opens the source list's header menu
- **THEN** the Connect action reads "Connect to simulator" right away

#### Scenario: Local network permission not granted

- **GIVEN** the user is on the web app and hasn't granted Chrome's local network permission
- **WHEN** the user opens the source list's header menu
- **THEN** no permission prompt is shown
- **AND** the Connect action reads "Connect"
