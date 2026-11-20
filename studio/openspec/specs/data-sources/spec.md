# data-sources Specification

## Purpose

Define how users load data into Studio, by opening a WPILOG file and connecting to a live NetworkTables 4 server, how they switch between the two, and how Studio behaves when sources fail or disconnect.

## Requirements

### Requirement: Log and live session

Each window SHALL have at most one open log and one live session, and MUST show one of them in every dashboard and widget. The live session SHALL last until the window closes, receiving data whether or not it's shown, and the log MUST stay loaded while the live session is shown, so switching between them is instant.

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

The source control at the top of the sidebar SHALL show the shown source and its state, and MUST offer actions to open a log and to connect. While a log is shown, it MUST also show the live session's connection state with a status dot.

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

Users SHALL be able to open a WPILOG file with a file picker or by dropping it anywhere on the app window.

#### Scenario: Open with the file picker

- **WHEN** the user chooses Open log and selects a `.wpilog` file
- **THEN** that log becomes the active source

#### Scenario: Drag and drop

- **WHEN** the user drops a `.wpilog` file anywhere on the app window
- **THEN** that log becomes the active source

#### Scenario: Dragging a file over the window

- **WHEN** the user drags a file over the app window
- **THEN** an overlay shows that dropping it opens the log
- **AND** the overlay hides when the file is dropped or dragged out of the window

#### Scenario: Values set before logging started

- **GIVEN** a log with NetworkTables values a coprocessor set before the robot started logging, which are logged with negative timestamps
- **WHEN** the user opens it
- **THEN** each of those entries has the latest of those values at the start of the log, unless it was also logged right at the start
- **AND** the log ends at its last record

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

### Requirement: Live connection resilience

Studio MUST keep all data received from a live source when the connection drops, and SHALL reconnect automatically. Received data MUST be kept until the window closes, the user clears the live session, or Connect replaces it with another target.

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

The source control menu's live section SHALL offer one action for the live session's state: Connect without a session, Disconnect while it's connecting, connected, or reconnecting, and once disconnected, Reconnect and Clear. Disconnect MUST stop reconnecting and keep the received data, and Reconnect MUST continue the same session. Clear MUST close the live session and throw away its data.

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

### Requirement: Studio's own topics

Entries under `/DogLogStudio/`, which Studio uses to share dashboards, SHALL NOT be shown, whether they come from a live NT4 server or from a log that recorded NetworkTables (ex. `NT:/DogLogStudio/`).

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
