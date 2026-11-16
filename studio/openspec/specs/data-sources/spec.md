# data-sources Specification

## Purpose

Define how users load data into Studio, either by opening a WPILOG file or connecting to a live NetworkTables 4 server, and how Studio behaves when sources fail or disconnect.

## Requirements

### Requirement: Single active source

Studio SHALL have at most one active data source at a time, shared by every dashboard and widget.

#### Scenario: Replacing the source

- **GIVEN** a log file is the active source
- **WHEN** the user connects to a robot
- **THEN** the robot connection becomes the active source
- **AND** every dashboard shows data from the robot connection
- **AND** no dashboard layout or widget binding changes

### Requirement: Source control

The source control at the top of the sidebar SHALL show the active source and its state, and MUST offer actions to open a log and to connect.

#### Scenario: Log source shown

- **GIVEN** the user opened `qual12.wpilog`
- **THEN** the source control shows `qual12.wpilog`

#### Scenario: Live source shown

- **GIVEN** the user is connected to `10.5.81.2`
- **THEN** the source control shows the address and the connection state (connecting, connected, or disconnected)

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

Studio MUST keep all data received from a live source when the connection drops, and SHALL reconnect automatically.

#### Scenario: Robot reboots mid-session

- **GIVEN** Studio is connected and has received data
- **WHEN** the connection drops
- **THEN** the source control shows the disconnected state
- **AND** all previously received data remains viewable
- **AND** Studio keeps trying to reconnect

#### Scenario: Reconnect

- **GIVEN** the connection dropped
- **WHEN** the server becomes reachable again
- **THEN** Studio reconnects without user action
- **AND** new data is added to the same session history

### Requirement: Damaged log tolerance

When a log is corrupt or truncated, Studio MUST load every readable record and warn the user instead of failing to open the log.

#### Scenario: Truncated log from a power loss

- **WHEN** the user opens a log whose final records are cut off
- **THEN** all complete records are available
- **AND** Studio shows a warning that the log is damaged

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

#### Scenario: Protobuf entry

- **GIVEN** a source contains a protobuf-encoded entry
- **THEN** the entry appears in the entry browser marked as unsupported
- **AND** it cannot be bound to widgets

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

### Requirement: Connect target selection

Connect SHALL try the robot connection target and the simulator at the same time, connect to the robot if it is reachable and otherwise to the simulator, and MUST keep trying both until one is reachable without showing an error.

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
