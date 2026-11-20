# widget-field Specification

## Purpose

Define the field widget, which draws robots and other field-relative poses on a top-down view of the current season's FRC field, so teams can see where the robot was and where it was trying to go. The widget works without any settings: each entry's role is inferred, and MAY be changed from the legend.

## Requirements

### Requirement: Field inputs

The field widget SHALL accept `Pose2d`, `Pose3d`, `Translation2d`, `Translation3d`, `Rectangle2d`, and `Ellipse2d` entries and arrays of them, and any number of them MAY be bound.

#### Scenario: Several entries

- **WHEN** the user binds `/Drive/Pose`, a `Pose2d` entry, and `/Auto/ShootingZone`, a `Rectangle2d` entry
- **THEN** both are drawn on the field

### Requirement: Field roles

The field widget SHALL offer these roles, the inferred one first: single poses are a robot, ghost, or point; pose arrays are points or a path; single translations are a point; translation arrays are a path or points; and rectangles and ellipses are shapes. The first single pose in the legend MUST infer a robot and later ones a ghost, and pose arrays MUST infer a path instead when the last part of their name contains "path" or "trajectory" (ignoring case).

#### Scenario: Robot pose

- **WHEN** the user binds `/Drive/Pose`, a `Pose2d` entry
- **THEN** it is drawn as a robot

#### Scenario: Trajectory by name

- **WHEN** the user binds `/PathPlanner/ActivePath`, a `Pose2d[]` entry
- **THEN** it is drawn as a path

#### Scenario: Pose array points

- **WHEN** the user binds `/Vision/TagPoses`, a `Pose3d[]` entry
- **THEN** each pose is drawn as a point

#### Scenario: Game piece position

- **WHEN** the user binds `/Vision/NotePosition`, a `Translation3d` entry
- **THEN** it is drawn as a point without a heading line

#### Scenario: Zone

- **WHEN** the user binds `/Auto/ShootingZone`, a `Rectangle2d` entry
- **THEN** it is drawn as a shape

### Requirement: Field view

The field widget SHALL draw the 2026 FRC field from a top-down render, fit to the widget. The view MUST show the field boundary with the same small margin on every side, cropping the driver station areas. The field SHALL have the same neutral gray background in every theme.

#### Scenario: No entries

- **GIVEN** a field widget with no bound entries, or no source
- **THEN** the field is drawn instead of an empty state

### Requirement: WPILib coordinates

The field widget SHALL have a WPILib coordinates option for the convention poses are logged in. "2026" MUST put the origin at the blue alliance wall's corner on the scoring table side, with +X toward the red alliance. "2027" MUST put the origin at the center of the field, with +X toward the blue alliance. Measurements and the cursor position readout MUST use the same coordinates as poses.

#### Scenario: 2026 origin

- **GIVEN** the WPILib coordinates option is "2026" and the Orientation option is "Blue left"
- **AND** a `Pose2d` entry at (0, 0) with a 0° rotation
- **THEN** the robot is centered on the bottom-left corner of the field boundary, facing right

#### Scenario: 2027 origin

- **GIVEN** the WPILib coordinates option is "2027" and the Orientation option is "Red left"
- **AND** a `Pose2d` entry at (0, 0) with a 0° rotation
- **THEN** the robot is centered on the center of the field, facing right toward the blue alliance

### Requirement: Inferred coordinates

The WPILib coordinates option SHALL be inferred from the WPILib version the robot published, to NetworkTables by WPILib or in its system stats by AdvantageKit: "2027" from WPILib 2027's first beta onward, since its alphas still used 2026's coordinates, and "2026" otherwise.

#### Scenario: Inferred from a 2027 log

- **GIVEN** a log where `/Robot/WPILibVersion` is `2027.0.0-beta-1`
- **THEN** the WPILib coordinates option is "Auto (2027)"

#### Scenario: Inferred from an AdvantageKit log

- **GIVEN** an AdvantageKit log where `/SystemStats/Versions/WPILib` is `2027.0.0-beta-1`
- **THEN** the WPILib coordinates option is "Auto (2027)"

#### Scenario: Inferred from an alpha log

- **GIVEN** a log where `/Robot/WPILibVersion` is `2027.0.0-alpha-8`
- **THEN** the WPILib coordinates option is "Auto (2026)"

### Requirement: Orientation

The field widget SHALL have an Orientation dropdown with **Blue left**, **Red left**, **Blue top**, and **Red top**. The chosen alliance MUST appear at the named edge, with the field, its drawings, and the minimap rotated together. The cursor readout and measurements MUST still use the selected WPILib coordinates. Auto SHALL put +X on the right, like WPILib's field images: "Blue left" with 2026 coordinates and "Red left" with 2027 coordinates.

#### Scenario: Red left

- **GIVEN** the WPILib coordinates option is "2026" and the Orientation option is "Red left"
- **AND** a `Pose2d` entry at (0, 0) with a 0° rotation
- **THEN** the red alliance is on the left
- **AND** the robot is centered on the top-right corner of the field boundary, facing left
- **AND** the cursor position readout still shows field coordinates

#### Scenario: Blue top

- **GIVEN** the WPILib coordinates option is "2026" and the Orientation option is "Blue top"
- **AND** a `Pose2d` entry at (0, 0) with a 0° rotation
- **THEN** the blue alliance is at the top of the portrait field
- **AND** the robot is centered on the top-left corner of the field boundary, facing down

### Requirement: Zoom and pan

Scrolling or pinching over the field SHALL zoom in and out around the pointer, from the whole view up to 8×. Dragging the zoomed field MUST pan it, and the field MUST NOT pan or zoom out past the edges of the view. Double-clicking SHALL reset the view. Drawings MUST zoom with the field, including the width of their lines, so they keep their look at every zoom.

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

Each robot SHALL be drawn as a 0.9 m square centered on its pose, rotated by its heading (counterclockwise positive), with bumpers in the entry's color around a dark body and a white arrow pointing toward its front. Ghosts MUST be drawn like robots, but see-through. `Pose3d` robots and ghosts MUST be drawn at their yaw, ignoring height, pitch, and roll.

#### Scenario: Turned left

- **GIVEN** a `Pose2d` entry with a 90° rotation
- **THEN** the robot's front points toward the top of the widget

#### Scenario: 3D pose

- **GIVEN** a `Pose3d` entry 0.5 m off the floor, pitched 10°, with a 45° yaw
- **THEN** the robot is drawn at its X and Y position, rotated 45°

### Requirement: Points and paths

Each point SHALL be drawn as a dot, with a short line toward its heading if it's a pose. `Translation3d` entries MUST be drawn at their X and Y position, ignoring height. A path entry MUST be drawn as a line through its points in order. Lines SHALL keep the same on-screen width at any widget size.

#### Scenario: Empty array

- **GIVEN** a `Pose2d[]` entry drawn as points whose value at the cursor is empty
- **THEN** nothing is drawn for it
- **AND** it isn't dimmed in the legend

### Requirement: Shapes

Each `Rectangle2d` or `Ellipse2d` SHALL be drawn at its size as an outline over a light fill in the entry's color, centered on its center pose and rotated by its heading. Array entries MUST draw every shape in the array.

#### Scenario: Rotated rectangle

- **GIVEN** a `Rectangle2d` entry centered at (4, 2) with a 90° rotation, 2 m along its X and 1 m along its Y
- **THEN** a rectangle 1 m wide and 2 m tall is drawn centered on (4, 2)

### Requirement: Connections

A binding connected to a single pose or translation, its source, SHALL be drawn as usual, with a line from the source to each of its poses or translations in its color. A binding MAY be connected to from any number of sources. The lines MUST NOT be drawn while the source is hidden or has no value at the cursor.

#### Scenario: Seen tags

- **GIVEN** a field widget showing `/Drive/Pose` as a robot, and `/Vision/SeenTags`, a `Pose3d[]` entry, as points
- **WHEN** the user connects `/Drive/Pose` to `/Vision/SeenTags`
- **THEN** each seen tag is drawn as a point, with a line from the robot to it

#### Scenario: Hidden source

- **GIVEN** `/Drive/Pose` is connected to `/Vision/SeenTags`
- **WHEN** the user hides `/Drive/Pose`
- **THEN** the lines aren't drawn
- **AND** the connection is kept

### Requirement: Connect from the legend

Each field legend row of a binding that can be connected SHALL have a handle on its right edge, and dragging a handle onto another row MUST connect them, from the dragged row to the one it's dropped on. Dragging from an array onto a single pose or translation MUST connect the other way, since lines start at single positions, and dropping an array onto another array or a shape MUST do nothing. Dropping onto bindings that are already connected MUST do nothing.

#### Scenario: Connect a setpoint

- **GIVEN** a field widget showing `/Drive/Pose` as a robot and `/Drive/Setpoint` as a ghost
- **WHEN** the user drags the handle of `/Drive/Pose` onto `/Drive/Setpoint`
- **THEN** a line is drawn from the robot to the ghost

#### Scenario: Drag from an array

- **WHEN** the user drags the handle of `/Vision/SeenTags` onto `/Drive/Pose`
- **THEN** lines are drawn from the robot to each seen tag

### Requirement: Connections in the legend

The field legend SHALL draw each connection to the right of its rows, as straight lines with right angles from the source's handle to the target's, in the target's color, with each source in its own lane so links don't overlap. Hovering a link MUST highlight it and fill the handles at its ends, and clicking it MUST remove the connection. Right-clicking a row SHALL offer to disconnect it from each binding it's connected to.

#### Scenario: Remove a connection

- **GIVEN** `/Drive/Pose` is connected to `/Vision/SeenTags`
- **WHEN** the user clicks the link between them in the legend
- **THEN** the lines from the robot to the seen tags aren't drawn

### Requirement: Draw order

Shapes SHALL be drawn under paths, paths under connections, connections under points, points under ghosts, and ghosts under robots. Within a role, earlier bindings MUST be drawn on top of later ones.

#### Scenario: Robot over its path

- **GIVEN** a field widget showing `/Auto/Trajectory` as a path and `/Drive/Pose` as a robot on it
- **THEN** the robot is drawn on top of the path

### Requirement: Colors and legend

The field widget SHALL color each entry from the shared chart colors in binding order, and MUST show a legend listing each bound entry, one per line, with its color. The legend SHALL be above the field, unless the widget is wider than the field's shape, where it MUST be beside the field so the field isn't shrunk, and the field SHALL be centered in the widget unless the legend needs that space. Entries with no value at or before the cursor MUST be dimmed in the legend and not drawn.

#### Scenario: Wide widget

- **GIVEN** a field widget in a short, wide pane
- **THEN** its legend is on the left of the field

#### Scenario: Very wide widget

- **GIVEN** a field widget much wider than the field, with room for the legend on either side of it
- **THEN** the field is centered in the widget, with the legend on its left

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
