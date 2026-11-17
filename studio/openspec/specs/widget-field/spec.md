# widget-field Specification

## Purpose

Define the field widget, which draws robots and other field-relative poses on a top-down view of the current season's FRC field, so teams can see where the robot was and where it was trying to go. The widget works without any per-widget settings.

## Requirements

### Requirement: Field inputs

The field widget SHALL accept `Pose2d`, `Pose3d`, `Pose2d[]`, `Pose3d[]`, and `Translation2d[]` entries, and any number of them MAY be bound. Each bound entry's drawing MUST be inferred from its type and name: `Pose2d` and `Pose3d` entries are robots, `Translation2d[]` entries are paths, and `Pose2d[]` and `Pose3d[]` entries are paths when the last part of their name contains "path" or "trajectory" (ignoring case) and markers otherwise.

#### Scenario: Robot pose

- **WHEN** the user binds `/Drive/Pose`, a `Pose2d` entry
- **THEN** it is drawn as a robot

#### Scenario: Trajectory by name

- **WHEN** the user binds `/PathPlanner/ActivePath`, a `Pose2d[]` entry
- **THEN** it is drawn as a path

#### Scenario: Pose array markers

- **WHEN** the user binds `/Vision/TagPoses`, a `Pose3d[]` entry
- **THEN** each pose is drawn as a marker

### Requirement: Field view

The field widget SHALL draw the 2026 FRC field from a top-down render, fit to the widget, with the blue alliance on the left. The view MUST show the field boundary with the same small margin on every side, cropping the driver station areas. The field SHALL have the same neutral gray background in every theme. Poses MUST use WPILib's 2026 field coordinates: the origin is the bottom-left corner of the field boundary, +X points toward the red alliance, and +Y points up.

#### Scenario: Origin

- **GIVEN** a `Pose2d` entry at (0, 0) with a 0° rotation
- **THEN** the robot is centered on the bottom-left corner of the field boundary, facing right

#### Scenario: No entries

- **GIVEN** a field widget with no bound entries, or no source
- **THEN** the field is drawn instead of an empty state

### Requirement: Zoom and pan

Scrolling or pinching over the field SHALL zoom in and out around the pointer, from the whole view up to 8×. Dragging the zoomed field MUST pan it, and the field MUST NOT pan or zoom out past the edges of the view. Double-clicking SHALL reset the view. Robots, markers, and paths MUST zoom with the field. Robots MUST keep their look at every zoom, while marker and path lines keep their on-screen width.

#### Scenario: Zoom to a robot

- **WHEN** the user scrolls up with the pointer over a robot
- **THEN** the field zooms in and the robot stays under the pointer

#### Scenario: Reset

- **GIVEN** the user has zoomed in
- **WHEN** the user double-clicks the field
- **THEN** the whole field is shown again

### Requirement: Minimap

While the user zooms or pans a zoomed-in field, a minimap of the whole field SHALL appear in the top-right corner, outlining the part that's shown, and MUST fade out shortly after they stop. While the pointer is on the right side of the field, the minimap MUST move to the top-left corner so it doesn't cover what the user is zooming into, and it MUST NOT switch sides while the pointer is near the middle.

#### Scenario: Minimap

- **GIVEN** the user has zoomed in on the blue half of the field
- **WHEN** the user drags to pan
- **THEN** a minimap shows the whole field with the blue half outlined
- **AND** it fades out after the user stops panning

#### Scenario: Minimap avoids the pointer

- **GIVEN** the pointer is in the top-right of the field
- **WHEN** the user zooms
- **THEN** the minimap is in the top-left corner

### Requirement: Robots

Each robot SHALL be drawn as a 0.9 m square centered on its pose, rotated by its heading (counterclockwise positive), with bumpers in the entry's color around a dark body and a white arrow pointing toward its front. `Pose3d` robots MUST be drawn at their yaw, ignoring height, pitch, and roll.

#### Scenario: Turned left

- **GIVEN** a `Pose2d` entry with a 90° rotation
- **THEN** the robot's front points toward the top of the widget

#### Scenario: 3D pose

- **GIVEN** a `Pose3d` entry 0.5 m off the floor, pitched 10°, with a 45° yaw
- **THEN** the robot is drawn at its X and Y position, rotated 45°

### Requirement: Markers and paths

Each pose in a marker entry SHALL be drawn as a dot with a short line toward its heading. A path entry MUST be drawn as a line through its points in order. Lines SHALL keep the same on-screen width at any widget size.

#### Scenario: Empty array

- **GIVEN** a `Pose2d[]` marker entry whose value at the cursor is empty
- **THEN** nothing is drawn for it
- **AND** it isn't dimmed in the legend

### Requirement: Colors and legend

The field widget SHALL color each entry from the shared chart colors in binding order, and MUST show a legend listing each bound entry, one per line, with its color. The legend SHALL be above the field, unless the widget is wider than the field's shape, where it MUST be beside the field so the field isn't shrunk. Paths SHALL be drawn under markers, and markers under robots. Entries with no value at or before the cursor MUST be dimmed in the legend and not drawn.

#### Scenario: Wide widget

- **GIVEN** a field widget in a short, wide pane
- **THEN** its legend is on the left of the field

#### Scenario: Entry without data

- **GIVEN** `/Vision/EstimatedPose` has no value before the cursor
- **THEN** it is dimmed in the legend
- **AND** nothing is drawn for it

#### Scenario: Remove a robot

- **WHEN** the user middle-clicks the robot drawn for `/Drive/Pose`
- **THEN** the widget stops showing `/Drive/Pose`

### Requirement: Cursor position

The field widget SHALL show the field position under the pointer, in meters, below the bottom-left corner of the field, fading in and out quickly as the pointer enters and leaves the field. Pressing ⌘C (Ctrl+C on Windows and Linux) while the pointer is over the field MUST copy that position as `x, y`, and the position SHALL briefly fade to a "Copied" label.

#### Scenario: Copy a position

- **GIVEN** the pointer is over the center of the field
- **WHEN** the user presses ⌘C
- **THEN** `8.27, 4.03` is copied

### Requirement: Measuring tool buttons

Buttons below the bottom-right corner of the field SHALL show the distance and angle tools with their keys, toggle them when clicked, and show which one is active.

#### Scenario: Click to measure

- **WHEN** the user clicks the Distance button
- **THEN** dragging on the field measures distance
- **AND** the Distance button is shown as active

### Requirement: Measuring

While the pointer is over the field, `M` SHALL start measuring distances and `A` angles. Dragging MUST then draw a line labeled with its length, or its angle counterclockwise from +X with an arc from +X, instead of panning. Drags only a few pixels long MUST be ignored as accidental clicks. The last measurement SHALL stay until the user starts another, presses the same key again, or presses Escape, which also stop measuring.

#### Scenario: Measure a distance

- **WHEN** the user presses `M` and drags from (2, 2) to (5, 6)
- **THEN** a line between them is labeled `5.00 m`

#### Scenario: Measure an angle

- **WHEN** the user presses `A` and drags from (2, 2) to (3, 3)
- **THEN** the line is labeled `45.0°`

#### Scenario: Accidental click

- **GIVEN** the user is measuring angles
- **WHEN** the user clicks the field without dragging
- **THEN** no measurement is shown

#### Scenario: Stop measuring

- **GIVEN** the user is measuring distances
- **WHEN** the user presses Escape
- **THEN** the measurement is removed and dragging pans again

### Requirement: Snap measurements

Holding Shift while dragging a measurement SHALL snap its line to the nearest multiple of 45° from its start, keeping its length.

#### Scenario: Snap to 45°

- **WHEN** the user presses `M` and drags from (2, 2) toward (5, 2.3) while holding Shift
- **THEN** the line ends level with (2, 2), at about (5.01, 2)
