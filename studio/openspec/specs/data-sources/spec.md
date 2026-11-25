# data-sources Specification

## Purpose

Define how users load data into Studio, by opening a WPILOG file and connecting to a live NetworkTables 4 server, how they switch between the two, and how Studio behaves when sources fail or disconnect.

## Requirements

### Requirement: Log and live session

Each window SHALL have at most one open log and one live session, and MUST show one of them in every dashboard and widget. The live session SHALL last until the user clears it or Connect replaces it, receiving data whether or not it's shown and coming back when Studio reopens (see Restore the live session). The log MUST stay loaded while the live session is shown, so switching between them is instant.

#### Scenario: Open a log while live

- **GIVEN** the user is connected to the robot
- **WHEN** the user opens `qual12.wpilog`
- **THEN** every dashboard shows `qual12.wpilog`
- **AND** the live session keeps receiving data
- **AND** no dashboard layout or widget binding changes

#### Scenario: Back to live

- **GIVEN** the user opened `qual12.wpilog` while connected to the robot
- **WHEN** the user chooses Connect
- **THEN** every dashboard shows the live session, including the data received while the log was shown

#### Scenario: Back to the log

- **GIVEN** the user opened `qual12.wpilog`, then went back to the live session
- **WHEN** the user chooses `qual12.wpilog` in the source control menu
- **THEN** every dashboard shows `qual12.wpilog` right away, without reading the file again

#### Scenario: Switch with the keyboard

- **GIVEN** the user opened `qual12.wpilog` while connected to the robot
- **WHEN** the user presses Mod+Shift+K
- **THEN** every dashboard shows the live session
- **WHEN** the user presses Mod+Shift+K again
- **THEN** every dashboard shows `qual12.wpilog`

#### Scenario: Open another log

- **GIVEN** `qual12.wpilog` is open
- **WHEN** the user opens `qual13.wpilog`
- **THEN** `qual13.wpilog` replaces `qual12.wpilog`

### Requirement: Source control

The source control at the top of the sidebar SHALL show the shown source and its state, and MUST offer actions to open a log and to connect. While a log is shown, it MUST also show the live session's connection state with a status dot. If a log is open, users MUST be able to close it from the source control without affecting the live session, if any.

#### Scenario: Close the only log

- **GIVEN** a log is open without a live session
- **WHEN** the user chooses Close log from the source control's dropdown or context menu
- **THEN** the log closes and the source control shows No data source

#### Scenario: Log source shown

- **GIVEN** the user opened `qual12.wpilog`
- **THEN** the source control shows `qual12.wpilog`

#### Scenario: Match log source shown

- **GIVEN** the user opened `FRC_20260315_143000_CAPH_Q12.wpilog`
- **THEN** the source control and source switcher show `CAPH Q12` with a file icon and the local date and time
- **AND** hovering or focusing the source control reveals the match type and original filename

#### Scenario: Dated log outside a match

- **GIVEN** the user opened `WPILIB_20261118_003735.wpilog`
- **THEN** the source control shows the local date and time instead of the filename
- **AND** if the filename names an event but no match, the event appears above the date and time

#### Scenario: HOOT log source shown

- **GIVEN** the user opened `mttd_Q51_rio_2026-11-08_01-20-41.hoot`
- **THEN** the source control shows `MTTD Q51` with the local date and time and `roboRIO HOOT`, for the CAN bus it's from
- **AND** a log named by a CANivore's serial number, ex. `FE21E64A394C4853202020500F0D18FF_2026-11-06_18-39-11.hoot`, shows `CANivore HOOT` under the date and time

#### Scenario: Renamed match log source shown

- **GIVEN** the user opened `qual12.wpilog`, a renamed log with the Driver Station's match info for qualification 12 at `CAPH`
- **THEN** the source control keeps `qual12.wpilog` and shows that it is for `CAPH Q12`
- **AND** if a recognized filename names a different match, the match from the log data takes precedence

#### Scenario: Live source shown

- **GIVEN** the user is connected to `10.5.81.2`
- **THEN** the source control shows the address and the connection state (connecting, connected, reconnecting, or disconnected)

#### Scenario: Live session behind a log

- **GIVEN** the user opened `qual12.wpilog` while connected to the robot
- **THEN** the source control shows `qual12.wpilog` with a dot showing the robot is connected
- **AND** no toast is shown when the robot disconnects

#### Scenario: Log and live session open

- **GIVEN** the user opened `qual12.wpilog` while connected to the robot
- **WHEN** the user opens the source control menu
- **THEN** it lists the live session above `qual12.wpilog`, each with its icon, state, and a button to close it
- **AND** the shown source is raised on a surface, and the other is muted
- **WHEN** the user chooses the live session
- **THEN** the raised surface slides up to the live session, casting a deeper shadow while it moves
- **AND** the menu stays open

#### Scenario: Close from the source control menu

- **GIVEN** the user opened `qual12.wpilog` while connected to the robot
- **WHEN** the user hovers the live session's close button
- **THEN** a tooltip reads "Disconnect and clear live data"
- **WHEN** the user presses it
- **THEN** Studio disconnects, throws away the live data, and shows `qual12.wpilog`

#### Scenario: No source

- **GIVEN** no source is active
- **THEN** the source control prompts the user to open a log or connect

### Requirement: Open a log file

Users SHALL be able to open a WPILOG file with a file picker or by dropping it anywhere on the app window. Studio MUST also open XZ-compressed WPILOG files (`.wpilogxz`), and MUST show what it could decompress from one that was cut off, ex. by the robot losing power. Studio MUST open local HOOT files in format C19 or C21 using the same picker and drop paths.

#### Scenario: Open with the file picker

- **WHEN** the user chooses Open log and selects a `.wpilog` file
- **THEN** that log becomes the active source

#### Scenario: Open a compressed log

- **WHEN** the user opens a `.wpilogxz` file
- **THEN** that log becomes the active source, the same as the `.wpilog` file it was compressed from

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
- **THEN** that log becomes the active source

#### Scenario: Dragging a potential log over the window

- **WHEN** the user drags a potential log file over the window outside a widget accepting the drag
- **THEN** an overlay shows that dropping it opens the log
- **AND** the overlay hides when the file is dropped or dragged out of the window

#### Scenario: Video dropped outside a video widget

- **WHEN** the user drops a video file outside a video widget
- **THEN** Studio doesn't try to open it as a log
- **AND** the active source doesn't change

#### Scenario: Values set before logging started

- **GIVEN** a log with NetworkTables values a coprocessor set before the robot started logging, which are logged with negative timestamps
- **WHEN** the user opens it
- **THEN** each of those entries has the latest of those values at the start of the log, unless it was also logged right at the start
- **AND** the log ends at its last record

### Requirement: Open a log from a URL

Users SHALL be able to open a `.wpilog` or `.wpilogxz` file from an `http://` or `https://` URL, including via an in-app "Open from URL..." dialog in the source control menu and macOS File menu. Other schemes like `file://` MUST be rejected, including after redirects. Scheme-less URLs SHALL default to `https://` when they do not start with `/` and their host is `localhost` or contains a dot. URL logs MUST stay in memory only and MUST NOT be added to recent logs.

#### Scenario: Open a valid log URL from the dialog

- **WHEN** the user opens "Open from URL..." and enters `https://example.com/qual12.wpilog`
- **THEN** Studio streams and parses the log and displays `qual12.wpilog` once complete
- **AND** `qual12.wpilog` is not added to recent logs

#### Scenario: Scheme-less URL

- **WHEN** the user enters `example.com/qual12.wpilog`
- **THEN** Studio fetches `https://example.com/qual12.wpilog`

#### Scenario: Rejected scheme

- **WHEN** a URL uses `file:///tmp/qual12.wpilog`
- **THEN** Studio rejects it without attempting to read the file

### Requirement: Streaming URL log download and progress

Studio SHALL validate the HTTP status, `Content-Type`, and first 6 magic bytes (`WPILOG` or XZ) before replacing an already open log. While downloading, Studio MUST decompress `.wpilogxz` logs and parse WPILOG records incrementally as chunks arrive, showing the log once complete. The timeline progress bar SHALL show determinate progress when `Content-Length` is known, indeterminate progress otherwise, and a Cancel button that aborts the download and returns to the live session if one is open.

#### Scenario: Cancel a download

- **GIVEN** a live session is running in the background and a large log URL is downloading
- **WHEN** the user clicks Cancel on the progress bar
- **THEN** Studio aborts the download and returns to the live session

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
- **THEN** Studio aborts before downloading the page and keeps the already open log
- **AND** explains that the URL returned a web page instead of a WPILOG file, with an action to open it in the browser

#### Scenario: Mid-download network drop

- **GIVEN** a server advertises `Content-Length` of 50 MB and disconnects after 20 MB
- **WHEN** the stream ends early
- **THEN** Studio reports a download error instead of showing a partial log
- **AND** a complete HTTP response whose WPILOG payload is truncated still applies normal damaged log tolerance

### Requirement: Connect to a live NT4 server

Users SHALL be able to connect to a robot or simulator over NT4 with a single Connect action, using the connection target from Settings. The source control MUST NOT offer separate actions for the robot and the simulator.

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
- **THEN** the source control shows the reconnecting state
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

The source control menu's live section SHALL offer one action for the live session's state: Connect without a session, Disconnect while it's connecting, connected, or reconnecting, and once disconnected, Reconnect and Clear. Disconnect MUST stop reconnecting and keep the received data, and Reconnect MUST continue the same session. Clear MUST close the live session and throw away its data, including its recording.

#### Scenario: Disconnect

- **GIVEN** Studio is connected to the robot
- **WHEN** the user chooses Disconnect
- **THEN** the source control shows the disconnected state
- **AND** the received data remains viewable
- **AND** the menu offers "Reconnect to robot" and "Clear"

#### Scenario: Clear after disconnecting

- **GIVEN** the user disconnected from the robot and has `qual12.wpilog` open
- **WHEN** the user chooses Clear
- **THEN** the live session is closed
- **AND** every dashboard shows `qual12.wpilog`

#### Scenario: Disconnect before connecting

- **GIVEN** Studio is still looking for the robot or simulator
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

A recording MUST contain every topic and value the session received as the server sent it, including values Studio can't decode, struct schemas as text, and topic property changes as entry metadata. It MUST NOT contain the topics Studio uses to share dashboards, or entries Studio derives, ex. struct fields. It SHALL also contain entries under `/DogLogStudio/` for when each connection started and ended, and both clocks when it started.

#### Scenario: Values Studio can't decode

- **GIVEN** Studio is connected to a robot publishing protobuf values to `/Vision/Result`
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

The source control menu SHALL offer Export as WPILOG in its own section above the live session's actions whenever the live session has data. Exporting MUST save a copy of the whole recording, including history no longer kept in memory, without interrupting the session. The desktop app MUST ask where to save it, and the web app MUST download it. The suggested file name MUST be `WPILIB_<date>_<time>.wpilog` with the date and time the session started in UTC, like WPILib names its logs.

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

When part of a log can't be read, Studio MUST load every record before the damage and tell the user how much is missing instead of failing to open the log. Studio MUST NOT load anything after the first record that can't be read, even if it looks valid. When a log can't be opened at all, Studio MUST go back to showing the live session if there is one.

#### Scenario: Partial last record

- **WHEN** the user opens a log whose last record is cut off
- **THEN** every other record is available
- **AND** Studio doesn't warn, since this is normal when the robot is turned off

#### Scenario: Unreadable end of a log

- **GIVEN** a log whose last 66% is blocks the file system reserved but never wrote, which hold leftover data instead of records
- **AND** its readable part stops at 1:59.42
- **WHEN** the user opens it
- **THEN** every record before the damage is available
- **AND** Studio warns that the last 66% of the file is unreadable, and an estimate of how long that is after 1:59.42, from the rate the rest of the log was written

#### Scenario: Value that can't be decoded

- **GIVEN** a log with a struct value that doesn't match its schema, or a struct schema that can't be parsed
- **WHEN** the user opens it
- **THEN** only the values that can't be decoded are missing
- **AND** every record after them is still available

#### Scenario: Unreadable log

- **WHEN** the user opens a log that's empty, or so damaged that none of its entries can be read
- **THEN** Studio says it couldn't open the log, and why

### Requirement: Supported data types

Studio SHALL decode numeric, boolean, string, array, and WPILib struct entries. Entries of unsupported types MUST still be listed and marked as unsupported.

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

- **GIVEN** a source contains a protobuf-encoded entry
- **THEN** the entry appears in the entry browser marked as unsupported
- **AND** it cannot be bound to widgets

### Requirement: Embedded logs

Studio SHALL read logs embedded in a log's entries, which let one WPILOG file hold a robot's other logs, ex. vendor or coprocessor logs. An embedded log is a raw entry with a `log:<format>` type, ex. `log:hoot`, whose records joined in time order are the bytes of the embedded log's file. Studio MUST list the entries of embedded WPILOG, WPILOGXZ, and HOOT files under the entry they're embedded in, and MUST list embedded logs of other formats marked as unreadable.

#### Scenario: Embedded WPILOG file

- **GIVEN** a log with a coprocessor's WPILOG file embedded in `/WPILOG`, which has `/Arm/Angle`
- **WHEN** the user opens it
- **THEN** the entry browser lists `/WPILOG/Arm/Angle`, and widgets can show it like any other entry

#### Scenario: Embedded HOOT file

- **GIVEN** a log with a Phoenix 6 HOOT file embedded in `/Hoot`
- **THEN** the entry browser lists its signals under `/Hoot`, ex. `/Hoot/Phoenix6/TalonFX-5/Velocity`
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

Connect SHALL try the robot connection target and the simulator at the same time, connect to the robot if it is reachable and otherwise to the simulator, and MUST keep trying both until one is reachable without showing an error. Connect MUST NOT replace the live session unless it would connect to a different target, so the received data isn't thrown away. While a log is shown, Connect MUST show the live session if there is one, reading "Back to robot" or "Back to simulator".

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
- **THEN** the source control shows the connecting state
- **AND** Studio connects as soon as one becomes reachable

#### Scenario: No robot target

- **GIVEN** Settings has no valid robot connection target
- **WHEN** the user chooses Connect
- **THEN** Studio only tries the simulator

#### Scenario: Connect while connected

- **GIVEN** Studio is connected to the robot
- **WHEN** the user opens the source control menu
- **THEN** it offers Disconnect instead of Connect
- **AND** the Connect shortcut does nothing

#### Scenario: Connect while reconnecting

- **GIVEN** the connection to the robot dropped
- **AND** the simulator isn't running
- **WHEN** the user opens the source control menu
- **THEN** it offers Disconnect instead of Connect
- **AND** the Connect shortcut does nothing

#### Scenario: Switch targets while reconnecting

- **GIVEN** the connection to the robot dropped
- **AND** a simulator is running
- **WHEN** the user presses the Connect shortcut, or disconnects and chooses "Connect to simulator"
- **THEN** Studio connects to the simulator, replacing the robot's data

#### Scenario: Connect while a log is shown

- **GIVEN** the user opened `qual12.wpilog` while connected to the robot
- **WHEN** the user presses the Connect shortcut
- **THEN** every dashboard shows the live session

### Requirement: Connect target preview

The source control menu's Connect action SHALL show whether it would connect to the robot or the simulator. Studio SHALL check the targets when it starts and when the menu opens, and MUST NOT check them at any other time. Studio MUST NOT check a target when doing so would show a browser permission prompt.

#### Scenario: Robot available

- **GIVEN** the robot is reachable
- **WHEN** the user opens the source control menu
- **THEN** the Connect action reads "Connect to robot"

#### Scenario: Only the simulator is running

- **GIVEN** the robot is not reachable and a simulator is running
- **WHEN** the user opens the source control menu
- **THEN** the Connect action reads "Connect to simulator"

#### Scenario: Target available at startup

- **GIVEN** a simulator is running
- **WHEN** Studio starts and the user opens the source control menu
- **THEN** the Connect action reads "Connect to simulator" right away

#### Scenario: Local network permission not granted

- **GIVEN** the user is on the web app and hasn't granted Chrome's local network permission
- **WHEN** the user opens the source control menu
- **THEN** no permission prompt is shown
- **AND** the Connect action reads "Connect"
