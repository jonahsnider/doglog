# shared-dashboards Specification

## Purpose

Define shared dashboards, which everyone connected to the same robot can see and edit together in real time, and the presence indicators that show where others are in them. Without an internet connection, shared dashboards sync through the robot's NetworkTables server.

## Requirements

### Requirement: Shared section

The sidebar SHALL list shared dashboards in a Shared section, above and separate from the dashboards that are only on the device. The section MUST show whether shared dashboards are syncing, ex. "Synced with 581" or "Disconnected".

#### Scenario: No shared dashboards

- **GIVEN** no dashboards are shared on the robot
- **THEN** the Shared section explains that dashboards dragged into it are shared

#### Scenario: Not connected

- **GIVEN** neither the robot nor the simulator is reachable
- **THEN** the Shared section shows "Disconnected"
- **AND** shared dashboards can still be edited, and the changes sync once connected

### Requirement: Share a dashboard

Users SHALL be able to share a dashboard by dragging it into the Shared section, by dropping a pane there, or with Share in the dashboard's menu. A shared dashboard MUST show up in the Shared section of everyone connected to the robot, without them doing anything.

#### Scenario: Drag a dashboard in

- **GIVEN** two laptops are connected to the robot
- **WHEN** a user drags a dashboard into the Shared section on one
- **THEN** the dashboard shows up in the Shared section of the other

#### Scenario: Drop a pane

- **WHEN** a user drops a pane on the Shared section
- **THEN** the pane moves to a new shared dashboard

### Requirement: Edit together

Every edit to a shared dashboard SHALL reach everyone connected to the robot within a second. Edits made by several people at once MUST all be kept, including edits to the same widget's entries. Only the dashboard is shared: each person keeps their own data source, timeline cursor, focused pane, and zoomed pane, and undo only undoes their own edits.

#### Scenario: Edit the same widget at once

- **GIVEN** two people have the same shared dashboard open
- **WHEN** one adds an entry to a graph while the other changes the color of another entry on it
- **THEN** both see the graph with the added entry and the changed color

#### Scenario: Split the same pane at once

- **WHEN** two people split the same pane at the same moment
- **THEN** both see the same layout, with every pane kept

#### Scenario: Different sources

- **GIVEN** two people have the same shared dashboard open, one connected live and one replaying a log
- **WHEN** one of them scrubs the timeline
- **THEN** the other's timeline doesn't move

### Requirement: Stop sharing

Dragging a shared dashboard out of the Shared section, or Stop sharing in its menu, SHALL stop sharing it for everyone: it disappears for others, and the user who stopped sharing it keeps a copy on their device.

#### Scenario: Drag a dashboard out

- **GIVEN** a dashboard is shared with two other laptops
- **WHEN** a user drags it out of the Shared section
- **THEN** it's listed with their other dashboards
- **AND** it disappears from the other laptops

### Requirement: Delete a shared dashboard

Closing a shared dashboard SHALL delete it for everyone. Reopening it with Reopen closed dashboard MUST bring it back for everyone. Devices that weren't connected when it was deleted MUST find out once they connect, for at least 30 days, instead of sharing it again.

#### Scenario: Delete and reopen

- **GIVEN** a dashboard is shared with another laptop
- **WHEN** a user closes it, then reopens it
- **THEN** it disappears from the other laptop, then comes back

#### Scenario: Deleted while away

- **GIVEN** a laptop with a shared dashboard is turned off
- **WHEN** someone deletes the dashboard, and the laptop reconnects the next day
- **THEN** the dashboard disappears from that laptop instead of coming back for everyone

### Requirement: Shared on a robot

Shared dashboards SHALL belong to the robot set in Settings. The robot and a simulator on the device MUST count as the same robot, and dashboards shared on another robot MUST NOT be shown or sent while connected to a different robot.

#### Scenario: Switch to the simulator

- **GIVEN** a user shared dashboards while connected to their robot
- **WHEN** they connect to the simulator instead
- **THEN** the same shared dashboards are in the Shared section

#### Scenario: Help another team

- **GIVEN** a user has dashboards shared on team 581's robot
- **WHEN** they change the robot connection to team 254
- **THEN** team 581's shared dashboards are hidden, and aren't sent to team 254's robot

### Requirement: Sync connection

Studio SHALL connect to the robot for sharing whenever the app is open, separately from the active data source, falling back to the simulator when the robot isn't reachable. It MUST NOT ask for local network access for sharing unless the user has shared dashboards.

#### Scenario: Reviewing a log in the pits

- **GIVEN** a user is replaying a log while the robot is on
- **THEN** shared dashboards stay in sync with others connected to the robot

### Requirement: Presence

Shared dashboards SHALL show who else is in them: stacked avatars on the dashboard in the sidebar, and on the header of the pane each person last interacted with. A user's own sessions MUST NOT be shown. People with several tabs or windows open MUST be shown once per tab or window, with only the one they focused or used last shown as active and the others grayed out. A tab or window MUST stop being shown once it closes, disconnects, or leaves the dashboard.

#### Scenario: Several windows

- **GIVEN** a user has a shared dashboard open in two windows
- **WHEN** they click in one window
- **THEN** others see that window's avatar as active and the other window's avatar grayed out

#### Scenario: Close a window

- **WHEN** a user closes a window showing a shared dashboard
- **THEN** its avatar disappears for others

### Requirement: Identity

Others SHALL see each user by the name set in Settings. Users without a name MUST be shown as "Anonymous" followed by a dog breed that stays the same on their device, and the first time they open a shared dashboard they MUST be prompted to set a name.

#### Scenario: No name set

- **GIVEN** the user hasn't set a name
- **WHEN** they open a shared dashboard for the first time
- **THEN** they're shown as, ex., "Anonymous Corgi"
- **AND** a toast offers to set their name
