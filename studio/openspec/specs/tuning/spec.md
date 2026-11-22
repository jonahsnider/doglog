# tuning Specification

## Purpose

Define the Tuning page, where users change the robot's tunable values while connected to it and watch the result in graphs beside them. It's the only place Studio writes to a data source.

## Requirements

### Requirement: Layout

The Tuning page SHALL show a Tuning widget's pane on its left half and other panes on its right half, with the entry browser beside them like on a dashboard. The right half MUST hold one widget, or two stacked vertically. The panes are kept when the user leaves the page or reloads Studio, and SHALL start with an empty Tuning widget and an empty graph. The page MUST NOT be listed with the dashboards.

#### Scenario: First visit

- **WHEN** the user opens the Tuning page for the first time
- **THEN** the left half shows the Tuning widget, asking the user to pick values to tune, and the right half shows a graph

#### Scenario: Split the panes

- **GIVEN** the Tuning page has one pane beside the Tuning pane
- **WHEN** the user splits it down
- **THEN** two panes are stacked on the right half
- **AND** neither pane can be split again, and Split right is unavailable

#### Scenario: Add a graph

- **WHEN** the user double-clicks `/Elevator/Position` in the entry browser on the Tuning page
- **THEN** it's added to the Tuning page's panes, not to a dashboard

### Requirement: Panes

The Tuning pane MUST NOT be closed, split, dragged, or changed to another widget, and the Tuning widget MUST NOT be offered anywhere else. Pane shortcuts, ex. splitting, zooming, and closing panes, MUST act on the Tuning page's panes while it's shown.

#### Scenario: Tuning pane

- **GIVEN** the Tuning page is shown
- **THEN** the Tuning pane has no controls to close or split it, and can't be dragged
- **AND** the Tuning widget isn't offered when changing another pane's widget

#### Scenario: Close a graph

- **GIVEN** the Tuning page is shown, and the graph beside the Tuning pane is focused
- **WHEN** the user presses the shortcut to close a pane
- **THEN** the graph is closed

### Requirement: Connect on open

Opening the Tuning page MUST connect like Connect does, unless the live session is already shown and connecting or connected.

#### Scenario: Open Tuning with a log shown

- **GIVEN** `qual12.wpilog` is shown
- **WHEN** the user opens the Tuning page
- **THEN** Studio connects to the robot and shows the live session
- **AND** the Tuning widget says it's connecting until it's connected

### Requirement: Live only

The Tuning widget SHALL only show tunable values while the live session is shown, once it has connected. While it's reconnecting or disconnected, the widget MUST keep showing the values the robot last sent, with staged values and what's typed kept and still editable, and MUST NOT apply until it's connected again, saying it's reconnecting or disconnected.

#### Scenario: Disconnected on the Tuning page

- **GIVEN** the Tuning page is shown, and Elevator kP is staged as 12
- **WHEN** the user disconnects
- **THEN** Studio doesn't reconnect on its own, and the Tuning widget still lists kP staged as 12, says it's disconnected, and can't apply
- **WHEN** the user reconnects
- **THEN** kP is still staged as 12 and can be applied

#### Scenario: Robot drops out

- **GIVEN** the Tuning page is shown and connected
- **WHEN** the connection drops
- **THEN** the Tuning widget keeps its values and says it's reconnecting until the robot is back

### Requirement: Tunable values

The Tuning widget SHALL show the tunable values bound to it, picked by editing its entries in the entry browser like any widget's. It MUST only accept the values the robot publishes under NetworkTables' `/Tunables` table (including DogLog's), or `/Tunable` for DogLog releases before 2027, that are numbers, booleans, or strings, or arrays of them. Robust tunables, which take changes on a separate topic, aren't supported.

#### Scenario: DogLog before 2027

- **GIVEN** a robot with DogLog 2026 publishes `/Tunable/Intake/Voltage`, and the Tuning widget is bound to it
- **THEN** the widget lists Voltage in the Intake section

### Requirement: Sections

Values MUST be grouped in sections by table, with a heading for each table's path that's at least as prominent as the values' names, and values at the top level of `/Tunables` MUST come first, without a heading.

#### Scenario: Bind a whole table

- **GIVEN** the robot publishes `/Tunables/Shooter/TargetRPM`, `/Tunables/Shooter/Left/kP`, and `/Tunables/Shooter/Left/MotionMagic/Acceleration`
- **WHEN** the user edits the Tuning widget's entries and checks the `Shooter` group
- **THEN** the widget lists TargetRPM under a Shooter heading, then kP under a Shooter / Left heading, then Acceleration under a Shooter / Left / MotionMagic heading

### Requirement: Value fields

Values MUST be listed with their units, booleans as switches. When the robot publishes a tunable's value in its code as the topic's `default` property, an empty field MUST show it as a placeholder, or each element's for arrays. Values the robot marks as not mutable MUST NOT be editable.

#### Scenario: Default value

- **GIVEN** `/Tunables/Intake/Voltage` is 6 and its `default` property is 4.5
- **WHEN** the user clears its field
- **THEN** the field shows 4.5 as a placeholder and is marked invalid

### Requirement: Arrays

Each array SHALL get its own section, after the values of its table, headed by its path with a picker for how it's edited: as a list of values, or as rows of pairs or triplets, ex. an interpolating map's x, y points. Arrays MUST start as pairs or triplets when the robot sets the topic's `tupleSize` property to 2 or 3, and as a list otherwise. The picked layout SHALL be kept with the Tuning page's panes.

#### Scenario: Interpolating map

- **GIVEN** the robot publishes `/Tunables/Shooter/DistanceToRPM` as `[1.5, 2000, 3, 2500]` with a `tupleSize` of 2
- **THEN** the Tuning widget shows it as 2 rows of pairs, 1.5 and 2000, then 3 and 2500

#### Scenario: Edit as a list

- **GIVEN** `DistanceToRPM` is shown as pairs
- **WHEN** the user picks List
- **THEN** it's shown as 4 rows of one value each, and stays that way when the user comes back to the Tuning page

### Requirement: Array rows

Each row of an array MUST be numbered and have a field for each of its values, and the user MUST be able to remove a row and add one at the end, starting with empty fields that are focused. An array is staged as a whole once every value in it is valid. When its length isn't a whole number of rows, the section MUST say so.

#### Scenario: Add a point

- **GIVEN** `DistanceToRPM` is shown as pairs
- **WHEN** the user adds a pair and types 4.5 and `2500 + 600`
- **THEN** `DistanceToRPM` is staged as `[1.5, 2000, 3, 2500, 4.5, 3100]`

#### Scenario: Incomplete row

- **GIVEN** `DistanceToRPM` is shown as pairs
- **WHEN** the user adds a pair and only types its first value
- **THEN** the empty field is marked invalid and `DistanceToRPM` isn't staged

### Requirement: Apply changes together

Values SHALL be staged as soon as what's typed is valid for their type, and stay staged until the user applies them, so several values reach the robot at once. While a value is staged, the applied value MUST be shown beside it. Mod+Enter anywhere in the Tuning widget MUST apply, and Escape in a value MUST unstage it. Discard SHALL unstage every value and clear invalid ones, and MUST be available while there are either.

#### Scenario: Apply two gains

- **GIVEN** Elevator kP is 8 and kD is 0
- **WHEN** the user types 12 for kP and 0.3 for kD, then presses Mod+Enter
- **THEN** the robot receives both values
- **AND** nothing is staged

#### Scenario: Invalid value

- **WHEN** the user types `abc` for kP
- **THEN** the field is marked invalid and kP isn't staged
- **WHEN** the user clicks Discard
- **THEN** the field shows kP's value again

### Requirement: Number input

Numbers MAY be typed as arithmetic with `+ - * /` and parentheses, computed exactly until the result, and with a unit after a number that's converted to the value's unit, ex. `5 ft` for a length in meters. The result SHALL be shown beside the field until Enter or leaving the field replaces what's typed with it. A fraction, ex. `2/3`, MUST stay as it's typed, also once it's applied, until the value changes another way.

#### Scenario: Arithmetic

- **GIVEN** Elevator kP is 8
- **WHEN** the user types `8 + 1.5` for kP
- **THEN** kP is staged as 9.5, shown beside the field
- **WHEN** the user presses Enter
- **THEN** the field shows 9.5

#### Scenario: Units

- **GIVEN** `/Tunables/Drive/MaxSpeedMetersPerSecond` is in meters per second
- **WHEN** the user types `3 ft/s + 6 in/s`
- **THEN** it's staged as 1.0668, shown beside the field
- **WHEN** the user types `3 V`
- **THEN** the field is marked invalid, since volts aren't a speed

#### Scenario: Fraction

- **WHEN** the user types `2 / 3` for kV and presses Enter
- **THEN** kV is staged as the number nearest to 2/3, and the field shows `2/3` with `= 0.67` beside it

### Requirement: Rounding

Numbers MUST be rounded to 2 decimal places, or 2 significant digits for smaller numbers, ex. `0.00012`, except in the focused field, which shows the whole number.

#### Scenario: Rounded until focused

- **GIVEN** the robot's kV is 0.6666666666666666
- **THEN** the field shows `0.67`
- **WHEN** the user focuses it
- **THEN** it shows `0.6666666666666666`

### Requirement: Write only when asked

Studio SHALL publish a tunable's topic only while sending a value the user applied, so a robot that restarts goes back to the values in its code.

#### Scenario: Robot restarts

- **GIVEN** the user applied kP 12
- **WHEN** the robot restarts
- **THEN** kP is the robot's default again

### Requirement: Previous values

Each value applied in this session SHALL show what it was before it was last applied, until Studio reloads.

#### Scenario: After applying

- **GIVEN** Elevator kP is 8
- **WHEN** the user applies 12
- **THEN** kP shows 12, and that it was 8
