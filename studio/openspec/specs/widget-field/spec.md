# widget-field Specification

## Purpose

Define the field widget, which draws robots and other field-relative poses on the current season's FRC field, in a top-down 2D view or a 3D view, so teams can see where the robot was and where it was trying to go. 3D adds what 2D can't show: robot height and tilt, game pieces and vision poses above the floor, and the robot's CAD and mechanisms on the field. The widget works without any settings: each entry's role is inferred, and MAY be changed from the legend.

## Requirements

### Requirement: Field inputs

The field widget SHALL accept `Pose2d`, `Pose3d`, `Translation2d`, `Translation3d`, `Rectangle2d`, and `Ellipse2d` entries and arrays of them, and `Mechanism2d` entries, and any number of them MAY be bound.

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

### Requirement: 3D roles

Single `Pose3d` entries SHALL also offer a Camera role. `Pose3d` arrays SHALL offer a parts role, inferred instead of points or a path when the last part of their name contains "component" (ignoring case). Mechanisms SHALL offer the robot widget's plane roles, XZ plane first. Cameras, parts, and mechanisms MUST only be drawn in 3D, and the legend MUST mark them "3D only" in 2D.

#### Scenario: Component poses

- **WHEN** the user binds `/Robot/Components`, a `Pose3d[]` entry
- **THEN** its role is parts

### Requirement: Field view

In 2D, the field widget SHALL draw the 2026 FRC field from a top-down render, fit to the widget. The view MUST fill the space the widget has for it at any shape, rather than keeping the field's shape, so the room around the field can be used when zoomed in. The field MUST show its boundary with the same small margin on every side, cropping the driver station areas. The field SHALL have the same neutral gray background in every theme.

#### Scenario: Tall widget

- **GIVEN** a field widget in a tall, narrow pane
- **WHEN** the user zooms in
- **THEN** the field grows into the space above and below it until it fills the pane

#### Scenario: No entries

- **GIVEN** a field widget with no bound entries, or no source
- **THEN** the field is drawn instead of an empty state

### Requirement: View

The field widget SHALL have a View option with "2D" and "3D", which it MUST infer: 3D when it has a camera, parts, or mechanism binding, and 2D otherwise. A control for the View option SHALL be below the bottom-right corner of the view, shown like the measuring tool buttons, and in 3D a Reset view button MUST take the measuring tools' place. Switching views MUST keep the widget's bindings, roles, connections, colors, and options.

#### Scenario: Robot pose

- **WHEN** the user double-clicks `/Drive/Pose`, a `Pose2d` entry
- **THEN** a field widget shows it in 2D

#### Scenario: Add a mechanism

- **GIVEN** a field widget showing `/Drive/Pose` in 2D
- **WHEN** the user binds `/Robot/Arm/Mechanism`, a `Mechanism2d` entry
- **THEN** the widget switches to 3D

#### Scenario: Back to 2D

- **GIVEN** a field widget in 3D bound to `/Drive/Pose` and `/Robot/Components`, as parts
- **WHEN** the user picks 2D
- **THEN** `/Drive/Pose` is drawn on the top-down field
- **AND** `/Robot/Components` is marked "3D only" in the legend

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

The field widget SHALL have an Orientation dropdown with **Blue left**, **Red left**, **Blue top**, and **Red top**. The chosen alliance MUST appear at the named edge, with the field, its drawings, and the minimap rotated together. The cursor readout and measurements MUST still use the selected WPILib coordinates. Auto SHALL put +X down in the phone layout, and to the right elsewhere.

#### Scenario: Open a dashboard on a phone

- **GIVEN** a dashboard with two fields using 2026 coordinates, one set to Auto and the other to Red left
- **WHEN** Studio switches into the phone layout
- **THEN** the first field switches to Blue top and the second stays Red left

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

In 2D, scrolling or pinching over the field SHALL zoom in and out around the pointer, from the whole field up to 8×. Dragging the zoomed field MUST pan it. The field MUST NOT pan past the edges of the view, or leave empty the space it covers when it isn't zoomed. Double-clicking SHALL reset the view. Drawings MUST zoom with the field, including the width of their lines, so they keep their look at every zoom.

#### Scenario: Zoom to a robot

- **WHEN** the user scrolls up with the pointer over a robot
- **THEN** the field zooms in and the robot stays under the pointer

#### Scenario: Reset

- **GIVEN** the user has zoomed in
- **WHEN** the user double-clicks the field
- **THEN** the whole field is shown again

### Requirement: Field controls reference

An unbound Field SHALL show a compact, non-interactive controls reference in the lower-left of the scene. It MUST use short labels: touch gestures for a coarse primary pointer, or one set for mouse and trackpad otherwise. It MUST NOT show with any bound entries, during capture, or during a video camera match. It MAY be hidden if too narrow to read.

#### Scenario: Read the reference in 3D

- **GIVEN** the quick reference is visible in 3D
- **THEN** it describes how to orbit, pan, and zoom
- **AND** when the primary pointer is not coarse, it shows keyboard shortcuts as keycaps without a focus instruction

#### Scenario: Read the reference on a touch device

- **GIVEN** the quick reference is visible and the primary pointer is coarse
- **THEN** it shows touch gestures without mouse, trackpad, or keyboard hints

### Requirement: Field controls reference timing

For an unbound Field, the reference SHALL appear on creation and once more after about three seconds without input following a scene interaction. It SHALL fade out as soon as interaction resumes or after about five seconds on screen, whichever comes first. It MUST NOT reappear repeatedly while idle, react to incoming data or playback alone, or animate when reduced motion is enabled.

#### Scenario: Learn while exploring

- **WHEN** the user creates a Field widget without binding entries
- **THEN** the reference appears without needing any entries or pointer input
- **WHEN** the user starts dragging the view
- **THEN** the reference fades away
- **WHEN** the user stops interacting for about three seconds
- **THEN** the reference appears briefly, then fades away without repeating

### Requirement: Minimap

In 2D, while the user zooms or pans a zoomed-in field, a minimap of the whole field SHALL appear in the top-right corner beside or under the legend, outlining the part that's shown, and MUST fade out shortly after they stop. While the pointer is on the right side of the field, the minimap MUST move to the top-left corner so it doesn't cover what the user is zooming into, and it MUST NOT switch sides while the pointer is near the middle.

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

In 2D, each robot SHALL be drawn as a 0.9 m square centered on its pose, rotated by its heading (counterclockwise positive), with bumpers in the entry's color around a dark body and a white arrow pointing toward its front. Ghosts MUST be drawn like robots, but see-through. `Pose3d` robots and ghosts MUST be drawn at their yaw, ignoring height, pitch, and roll.

#### Scenario: Turned left

- **GIVEN** a `Pose2d` entry with a 90° rotation
- **THEN** the robot's front points toward the top of the widget

#### Scenario: 3D pose

- **GIVEN** a `Pose3d` entry 0.5 m off the floor, pitched 10°, with a 45° yaw
- **THEN** the robot is drawn at its X and Y position, rotated 45°

### Requirement: Points and paths

In 2D, each point SHALL be drawn as a 0.25 m dot in its binding's color. A pose point SHALL also have a solid arrow attached to the dot and pointing along its yaw. Both SHALL have a thin tonal outline derived from the binding's color. `Pose3d` and `Translation3d` entries MUST be drawn at their X and Y position, ignoring height. A path entry MUST be drawn as a line through its points in order. Lines SHALL keep the same on-screen width at any widget size.

#### Scenario: Turned pose point

- **GIVEN** a `Pose2d` entry drawn as a point with a 90° rotation in the default field orientation
- **THEN** its attached arrow points toward the top of the widget

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

### Requirement: Connect from the legend context menu

The Field legend row's context menu SHALL offer **Connect to…** next to **Disconnect** when both are available. It SHALL list only other rows that would produce a new valid connection by dragging from that row. Choosing a row MUST create the same connection, in the same direction, as dragging. The submenu MUST be omitted if there are no valid choices. Dragging the connection handle MUST still work.

#### Scenario: Connect without dragging

- **GIVEN** the Field shows `/Drive/Pose` as a robot and `/Vision/SeenTags` as points
- **WHEN** the user right-clicks `/Vision/SeenTags` in the legend and chooses **Connect to…** > `/Drive/Pose`
- **THEN** lines are drawn from the robot to the points
- **AND** that connection is no longer offered under **Connect to…**

### Requirement: Connections in the legend

The legend SHALL draw right-angled links to the right of the rows, over the handles and up to their centers, in the target's color. Links MUST NOT block drags from the handles. Vertically overlapping links MUST use separate lanes, with shorter spans routed first. Disjoint spans MAY share a lane. Hovering a vertical segment MUST highlight its link and fill both handles. Clicking it MUST remove only that link. A row's context menu SHALL offer to disconnect each of its links.

#### Scenario: Separate links from the same robot

- **GIVEN** `/Drive/Pose` is connected to `/Robot/Components` on the next row and `/Vision/SeenTags` two rows below
- **THEN** the link to `/Vision/SeenTags` bends farther out than the link to `/Robot/Components`
- **AND** either link can be removed without removing the other

#### Scenario: Remove a connection

- **GIVEN** `/Drive/Pose` is connected to `/Vision/SeenTags`
- **WHEN** the user clicks the link's vertical segment in the legend
- **THEN** the lines from the robot to the seen tags aren't drawn

### Requirement: Draw order

In 2D, shapes SHALL be drawn under paths, paths under connections, connections under points, points under ghosts, and ghosts under robots. Within a role, earlier bindings MUST be drawn on top of later ones.

#### Scenario: Robot over its path

- **GIVEN** a field widget showing `/Auto/Trajectory` as a path and `/Drive/Pose` as a robot on it
- **THEN** the robot is drawn on top of the path

### Requirement: Colors and legend

The field widget SHALL color each entry from the shared chart colors in binding order, and MUST show a legend listing each bound entry, one per line, with its color. Entries with no value at or before the cursor MUST be dimmed in the legend and not drawn.

#### Scenario: Entry without data

- **GIVEN** `/Vision/EstimatedPose` has no value before the cursor
- **THEN** it is dimmed in the legend
- **AND** nothing is drawn for it

#### Scenario: Remove a robot

- **WHEN** the user middle-clicks the robot drawn for `/Drive/Pose`
- **THEN** the widget stops showing `/Drive/Pose`

### Requirement: Legend layout in 2D

In 2D, the legend SHALL be above the field, unless the widget is wider than the field's shape, where it MUST be beside the field so the field isn't shrunk, and the field SHALL be centered in the widget unless the legend needs that space. Beside the field, the legend MUST be able to take all the width the field doesn't need at the widget's full height, and at least a third of the widget, so it only shortens names that don't fit there. The zoomed field MUST extend under the legend instead of leaving its side of the widget empty, and the legend MUST stay on top of it with an opaque background.

#### Scenario: Wide widget

- **GIVEN** a field widget in a short, wide pane
- **THEN** its legend is on the left of the field

#### Scenario: Very wide widget

- **GIVEN** a field widget much wider than the field, with room for the legend on either side of it
- **THEN** the field is centered in the widget, with the legend on its left

#### Scenario: Long names beside the field

- **GIVEN** a field widget much wider than the field, bound to entries with names wider than a third of the widget
- **THEN** the legend shows their full names beside the field
- **AND** the field isn't shrunk

#### Scenario: Zoomed under the legend

- **GIVEN** a field widget in a short, wide pane with its legend on the left
- **WHEN** the user zooms in
- **THEN** the field fills the widget, including behind the legend
- **AND** the legend stays readable over it

### Requirement: Legend layout in 3D

In 3D, the scene SHALL fill the widget, and the legend MUST be in its top-left corner over the scene, only as large as its entries, with an opaque background. It MAY be as wide as the widget, but MUST leave the top-right corner to the follow chip while following.

#### Scenario: Legend over the scene

- **GIVEN** a field widget in 3D showing `/Drive/Pose`
- **THEN** the field fills the widget, with the legend over its top-left corner

### Requirement: Cursor position

The field widget SHALL show the field position under the pointer, in meters, below the bottom-left corner of the view, fading in and out quickly as the pointer enters and leaves the field, followed by the copy shortcut. Pressing ⌘C (Ctrl+C on Windows and Linux) while the pointer is over the field MUST copy that position as `x, y`. The position SHALL briefly fade to a "Copied" label only if the copy succeeds.

#### Scenario: Copy a position

- **GIVEN** the pointer is over the center of the field
- **WHEN** the user presses ⌘C
- **THEN** `8.27, 4.03` is copied

### Requirement: Copy coordinates from the field menu

When a right-click or long-press opens the field view's context menu over a valid field position in 2D or 3D, the menu SHALL offer "Copy coordinates". It MUST copy the position where the menu opened in the same `x, y` format as the shortcut. The item MUST be omitted if the menu opens without a valid position.

#### Scenario: Copy the point where the menu opened

- **GIVEN** the user opens the field view's context menu over the center of the field
- **WHEN** the user moves the pointer to "Copy coordinates" and selects it
- **THEN** `8.27, 4.03` is copied

### Requirement: Measuring tool buttons

In 2D, buttons below the bottom-right corner of the view SHALL show the distance and angle tools with their keys, toggle them when clicked, and show which one is active. On devices that support hover, the buttons SHALL only be visible while the field widget is hovered, focus is within it, or a measuring tool is selected.

#### Scenario: Leave an idle field

- **GIVEN** no measuring tool is selected and focus is outside the field widget
- **WHEN** the pointer leaves the widget
- **THEN** the measuring buttons and their shortcut hints are hidden without resizing the field

#### Scenario: Click to measure

- **WHEN** the user clicks the Distance button
- **THEN** dragging on the field measures distance
- **AND** the Distance button is shown as active

### Requirement: Measuring

In 2D, while the pointer is over the field, `M` SHALL start measuring distances and `A` angles. Dragging MUST then draw a line labeled with its length, or its angle counterclockwise from +X with an arc from +X, instead of panning. Drags only a few pixels long MUST be ignored as accidental clicks. The last measurement SHALL stay until the user starts another, presses the same key again, or presses Escape, which also stop measuring.

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

### Requirement: Pencil tool

In 2D and 3D, the Pencil button below the view SHALL toggle freehand drawing and show its `P` shortcut. Pressing `P` while the pointer is over the view MUST also toggle it. While Pencil is active, a primary drag MUST draw a freehand line on the field instead of panning or orbiting. The line SHALL stay anchored to the field as the view moves and SHALL NOT be saved with the dashboard.

#### Scenario: Sketch on the field

- **WHEN** the user presses `P` and drags along a curved route on the field
- **THEN** a line follows the route as they draw and stays visible after they release

#### Scenario: Replace or clear a sketch

- **GIVEN** Pencil is active and a line is visible
- **WHEN** the user draws again
- **THEN** the new line replaces the previous one
- **AND** toggling Pencil off, pressing Escape over the view, or switching views clears the line and restores the normal drag behavior

### Requirement: 3D field

In 3D, the field widget SHALL draw a 3D model of the same season's field as 2D, from FIRST's official field CAD, with its field elements, tape lines, and AprilTags. The carpet SHALL be the same neutral gray as the 2D field's background in every theme, and the space around the field MUST use the pane's background. The scene SHALL use the robot widget's lighting: soft, fixed as the camera moves, and low-gloss, keeping the model's colors.

#### Scenario: Field elements

- **GIVEN** a field widget in 3D
- **THEN** the field's elements, like the hubs and bumps, are drawn at their height

### Requirement: AprilTags in 3D

In 3D, each of the field's AprilTags SHALL show its 36h11 pattern, readable by AprilTag detectors, with its ID printed below it, at its pose in WPILib's AprilTag layout for the field, so the tags a robot's cameras see can be found on the field.

#### Scenario: Zoom to a hub

- **GIVEN** a field widget in 3D
- **WHEN** the user zooms in on the side of the blue hub facing the scoring table
- **THEN** tags 27 and 18 are drawn on it, left to right, each with its ID below it

### Requirement: Field border

In 3D, the driver station glass, the field perimeter's other clear plastic, and the human player outpost glass SHALL be clearer than in the field's CAD, so the field can be seen through them. The field widget SHALL have a Field border option, Solid by default, and See-through MUST draw the guardrails and alliance walls, including the driver stations, mostly clear. It MUST only apply in 3D.

#### Scenario: See-through border

- **GIVEN** a field widget in 3D
- **WHEN** the user picks See-through for Field border
- **THEN** the guardrails and alliance walls are faint and the field and robots behind them are clearly visible
- **AND** the hubs, towers, and outposts are drawn as before

### Requirement: Staged game pieces

The field widget SHALL have a Staged game pieces option, on by default, that draws the game pieces where they're staged at the start of a match. It MUST only apply in 3D.

#### Scenario: Turn off staged game pieces

- **GIVEN** a field widget in 3D
- **WHEN** the user turns off Staged game pieces in its options
- **THEN** the field is drawn without the staged game pieces

### Requirement: Loading the 3D field

The app MUST bundle the 3D field model for offline use. When opening a dashboard with a 3D field, the model and renderer SHALL start loading in parallel without blocking the dashboard. In 2D, the widget SHALL start loading both shortly after it appears. If the model is still loading when the 3D scene can draw, the scene SHALL draw the top-down field render on its floor.

#### Scenario: Switch to 3D

- **GIVEN** a field widget has been open in 2D for a few seconds
- **WHEN** the user switches it to 3D
- **THEN** the 3D field is drawn right away

#### Scenario: Offline

- **GIVEN** the web app was installed and the device is offline
- **WHEN** the user switches a field widget to 3D
- **THEN** the 3D field is drawn

### Requirement: 3D camera

In 3D, the field widget SHALL use a camera with perspective. Dragging MUST orbit, right-dragging MUST pan, and scrolling or pinching MUST zoom, with the robot widget's keyboard controls and faster zoom and pan with Shift. Double-clicking and the Reset view button SHALL reset the camera, animating unless the system reduces motion. Right-clicking without dragging MUST open the context menu. The camera MUST keep its view while the app is open, but MUST NOT be saved with the dashboard.

#### Scenario: Reset the camera

- **GIVEN** the user has orbited the camera
- **WHEN** the user double-clicks the field
- **THEN** the camera goes back to its default view

#### Scenario: Split the pane

- **GIVEN** the user has orbited the camera
- **WHEN** the user splits the field widget's pane
- **THEN** the camera keeps its view

#### Scenario: Return to 3D

- **GIVEN** the user has orbited, panned, or zoomed the 3D camera
- **WHEN** the user switches to 2D and then back to 3D
- **THEN** the field is shown from the same viewpoint as before

### Requirement: 3D keyboard movement speed

Holding W, A, S, D, Q, or E MUST move the camera at a constant speed in meters per second, regardless of its position, unless it reaches a movement limit. Holding Shift MUST double that speed.

#### Scenario: Move sideways from near and far views

- **WHEN** the user holds D for the same amount of time from a zoomed-in and a zoomed-out view without reaching a movement limit
- **THEN** the camera travels the same distance in meters in both views

### Requirement: 3D default view

In 3D, the camera SHALL start a little above the side of the field, angled down, and turned so the field is oriented like the Orientation option's 2D view.

#### Scenario: Blue left

- **GIVEN** a field widget in 3D whose Orientation option is "Blue left"
- **THEN** the field is seen from the scoring table side, with the blue alliance on the left

#### Scenario: Red top

- **GIVEN** a field widget in 3D whose Orientation option is "Red top"
- **THEN** the field is seen from behind the blue alliance wall, with the red alliance farthest away

### Requirement: 3D camera limits

In 3D, scrolling SHALL zoom toward the pointer at a speed set only by how far the camera is from the field, faster from far away and steady near it. Panning without Shift MUST keep what's under the pointer under it, and orbiting MUST pivot around the center of the view, each treating anything past the field as at its far side. Inputs MUST keep the camera just above the floor and within about twice the default view's distance from the field's center, and MUST NOT otherwise stop it.

#### Scenario: Zoom into a hub

- **GIVEN** the default view
- **WHEN** the user scrolls to zoom in with the pointer on a hub
- **THEN** the camera moves toward the hub, quickly at first, then at a steady speed once it's near the field
- **AND** it keeps moving into the hub while the user keeps scrolling

#### Scenario: Zoom with the pointer over a robot

- **GIVEN** the camera is zoomed in near the field's center
- **WHEN** the user scrolls with the pointer on a nearby robot, then on the far alliance wall
- **THEN** the camera zooms at the same speed toward each

#### Scenario: Grab the field

- **WHEN** the user right-drags from a point on the field without reaching a movement limit
- **THEN** that point follows the pointer one-to-one at any zoom level

#### Scenario: Pan from beyond the field

- **GIVEN** the camera is low beside the field
- **WHEN** the user right-drags from a point near the horizon, past the field
- **THEN** the field moves with the pointer as if grabbed at its far side

#### Scenario: Orbit below the floor

- **WHEN** the user drags to orbit the camera down past the floor
- **THEN** the camera stops just above the floor

### Requirement: Follow a robot

In 3D, a robot's or ghost's context menu, on the field or in the legend, SHALL offer to follow it. While following, the camera MUST move with the robot without turning, keeping the user's view direction, and orbiting and zooming MUST work around the robot. Panning MUST move the view relative to the robot and keep following it. A chip in the widget SHALL show which entry is followed, with a button to stop. Following MUST stop when the user resets the view, or hides or removes the followed entry.

#### Scenario: Follow a turning robot

- **GIVEN** the user follows `/Drive/Pose`
- **WHEN** the robot drives forward and turns 90°
- **THEN** the camera moves with the robot
- **AND** the view direction doesn't change

#### Scenario: Pan while following

- **GIVEN** the user follows `/Drive/Pose`
- **WHEN** the user right-drags the scene to put the robot in the corner of the view
- **AND** the robot drives forward
- **THEN** the camera moves with the robot, keeping it in the corner

### Requirement: Follow from a driver station

In 3D, a robot's or ghost's context menu SHALL also offer to follow it from any of the six driver stations, marking the robot's own when NetworkTables' FMSInfo logs it. The camera MUST stay at a driver's eye height behind the station and turn smoothly to keep the robot centered, so noise in its pose doesn't shake the view. The chip SHALL name the station. Orbiting, panning, or zooming MUST stop following, moving the camera from where it is.

#### Scenario: Watch from the driver station

- **GIVEN** a log where FMSInfo says the robot is in Red 1
- **WHEN** the user follows `/Drive/Pose` from the robot's driver station
- **THEN** the field is seen from behind the red alliance wall, on its scoring table side
- **AND** the camera turns as the robot drives so it stays in the center of the view

#### Scenario: Zoom to stop following

- **GIVEN** the user follows `/Drive/Pose` from Blue 2
- **WHEN** the user scrolls the scene
- **THEN** the camera zooms from Blue 2 and stops following the robot

#### Scenario: Click while following

- **GIVEN** the user follows `/Drive/Pose` from Blue 2
- **WHEN** the user clicks or right-clicks the scene without dragging
- **THEN** the camera keeps following the robot from Blue 2

### Requirement: Follow from the legend

In 3D, each robot's and ghost's legend row SHALL have a camera button after its robot that opens the same follow choices as its context menu's Follow submenu, with the current one checked and the button highlighted while it's followed. Unchecking the current one MUST stop following. It MUST NOT be shown while the camera is matched to video.

#### Scenario: Follow from the legend

- **GIVEN** a field widget in 3D showing `/Drive/Pose`
- **WHEN** the user clicks the camera button on its legend row and picks Blue 2
- **THEN** the camera follows `/Drive/Pose` from Blue 2
- **AND** the button is highlighted

### Requirement: Field of view

The field widget SHALL have a Field of view option for the 3D camera's vertical field of view: 30°, 45°, 60°, 75°, or 90°, 45° by default. Changing it MUST keep the camera where it is, and the default view MUST frame the field at any field of view. A camera matched from a video frame MUST use the video's field of view instead.

#### Scenario: Narrow field of view

- **GIVEN** a field widget in 3D following `/Drive/Pose` from Blue 2
- **WHEN** the user picks a 30° field of view
- **THEN** the robot looks larger, seen from the same place

### Requirement: Live feeds on the 3D field

A Camera binding SHALL use its `Pose3d` as the camera's field-relative pose, with +X forward and +Z up in camera coordinates. In 3D, the widget SHALL show the latest frame on a plane 0.5 m forward of the lens, with lines from the lens to the corners. It MUST keep the frame's aspect ratio without cropping or correcting lens distortion.

#### Scenario: Two live cameras

- **GIVEN** two `Pose3d` entries set to Camera with different advertised feeds
- **WHEN** the 3D field follows live data
- **THEN** each feed is drawn in front of its own pose
- **AND** changing one camera's horizontal field of view resizes only that feed's plane and frustum, without moving the field viewer

### Requirement: Camera entry options

A Camera binding's legend options SHALL pick a CameraServer feed by name from those advertised on the selected live connection and set a horizontal field of view, defaulting to 70°. Each binding MUST save its own camera name and field of view with the dashboard, not a stream URL.

#### Scenario: Reopen a shared dashboard

- **GIVEN** a dashboard link with a Camera binding set to `Front` at 81°
- **WHEN** the recipient connects to a robot that advertises `Front` at a different URL
- **THEN** Studio uses the newly advertised feed and draws it at 81°

### Requirement: Camera entry availability

The image and frustum MUST only appear while the binding and pane are visible, the timeline follows live data, and both the pose and feed are available. The legend SHALL explain why a configured camera is not showing. Studio MUST NOT record frames or show them in video exports.

#### Scenario: Pause the live timeline

- **GIVEN** a 3D field showing a live camera
- **WHEN** the user pauses live follow
- **THEN** the frame and frustum disappear, the legend indicates the feed is live only, and other field drawings remain available
- **AND** resuming live follow shows the next available frame without changing the saved camera settings

### Requirement: 3D robots

In 3D, each robot and ghost SHALL be drawn at its pose, including height, pitch, and roll for `Pose3d` entries, as its binding's Robot. Ghosts MUST be drawn see-through, tinted all over in their entry's color with one opacity. Middle-clicking a robot or ghost MUST stop showing its binding, as in 2D.

#### Scenario: Tipped robot

- **GIVEN** a `Pose3d` robot 0.2 m off the floor, rolled 15°
- **THEN** the robot is drawn 0.2 m off the floor, tipped 15° onto its side

### Requirement: Robot per binding

In 3D, each robot and ghost binding's legend row SHALL pick its role and Robot in one dropdown, with the same Robot choices, "Add project…", and "Remove project" as the robot widget's Robot option. A binding without one MUST use the first robot binding's Robot, then the field robot default. A Robot whose project isn't added on this device MUST be drawn as the swerve drivebase, with a note on its legend row in 3D. A binding's Robot MUST only change how it's drawn in 3D.

#### Scenario: Setpoint ghost

- **GIVEN** a field widget showing `/Drive/Pose` as the robot "581 2026"
- **WHEN** the user binds `/Drive/Setpoint`, a `Pose2d` entry
- **THEN** it's drawn as a see-through "581 2026" robot in its entry's color

#### Scenario: Two robots

- **GIVEN** a field widget showing `/Drive/Pose` as the robot "581 2026"
- **WHEN** the user picks "Swerve drivebase" in the legend row of `/Opponent/Pose`
- **THEN** `/Drive/Pose` is still drawn as "581 2026"

### Requirement: Field robot default

A new field widget SHALL save the robot picked last on the device, as a new robot widget does, so others see the same robot. Robots and ghosts without a Robot, when the first robot binding has none either, MUST be drawn as it, or as the built-in swerve drivebase when it has none.

#### Scenario: Last picked robot

- **GIVEN** the user picked the robot "581 2026" in a robot widget
- **WHEN** they add a field widget showing `/Drive/Pose` in 3D
- **THEN** `/Drive/Pose` is drawn as "581 2026" without picking it

### Requirement: Appearance in the legend context menu

The Field legend row's context menu SHALL offer **Show as** when the binding has multiple valid roles. Its choices MUST be single-select and indicate the current role. In 3D, robots and ghosts SHALL also offer an adjacent **Robot model** submenu with the same choices and current selection as their legend dropdown. The dropdown's role section SHALL also be labeled **Show as**. These menus MUST affect only the selected binding.

#### Scenario: Draw a robot pose as a point

- **GIVEN** the Field shows `/Drive/Pose` as a robot
- **WHEN** the user right-clicks its legend row and chooses **Show as** > **Point**
- **THEN** the binding is drawn as a point rather than a robot
- **AND** **Point** is now the selected role

### Requirement: Parts and mechanisms on robots

Parts and mechanism bindings SHALL be drawn on the robots or ghosts they're connected from, as the robot widget draws them: parts move the Robot's parts by index, and mechanisms are drawn on their plane. Connecting from the legend MUST attach them instead of drawing lines. With exactly one robot, unconnected parts and mechanisms MUST be drawn on it, and otherwise not drawn, with a note to connect them. A robot MUST use its first parts binding that isn't hidden.

#### Scenario: One robot

- **GIVEN** a field widget showing `/Drive/Pose` as its only robot
- **WHEN** the user binds `/Robot/Arm/Mechanism`, a `Mechanism2d` entry
- **THEN** the mechanism is drawn on the robot, moving with it

#### Scenario: Attach to a ghost

- **GIVEN** a field widget showing `/Drive/Pose` as a robot and `/Drive/Setpoint` as a ghost
- **WHEN** the user drags the handle of `/Robot/SetpointComponents`, as parts, onto `/Drive/Setpoint`
- **THEN** the ghost's parts are moved by `/Robot/SetpointComponents`

#### Scenario: Attach parts to an already linked robot

- **GIVEN** `/Drive/Pose` is a robot connected to `/Vision/SeenTags`
- **WHEN** the user drags between the handles of `/Drive/Pose` and `/Robot/Components`, as parts, in either direction
- **THEN** `/Robot/Components` is attached to the robot
- **AND** the connection to `/Vision/SeenTags` is kept

### Requirement: 3D drawings

In 3D, 2D types SHALL be drawn on the floor, and `Pose3d` and `Translation3d` points and paths at their height. Shapes and paths on the floor MUST be drawn just above it, so they don't flicker into it. Lines SHALL keep the same on-screen width, as in 2D. Connections MUST run between the drawn positions, from a robot's center.

#### Scenario: Path on the carpet

- **GIVEN** a `Translation2d[]` entry drawn as a path
- **THEN** its line follows the carpet without flickering into it

### Requirement: 3D point markers

3D points MUST be 0.25 m dots in their binding's color. Floor dots MUST rest on the carpet at their position. Elevated dots SHALL have a faint line down to the floor. Pose points MUST have an attached, solid arrow pointing along their full 3D heading. Dots and arrows SHALL use the same thin tonal outline color as in 2D. The arrow SHALL have a fixed size in the scene and foreshorten with the view.

#### Scenario: Game piece in the air

- **GIVEN** a `Translation3d` point at (4, 4, 1.5)
- **THEN** an outlined dot is drawn 1.5 m above (4, 4), with a line down to the floor
- **AND** it appears larger on screen as the camera moves closer

#### Scenario: Pose point on the floor

- **GIVEN** a `Pose3d` point on the floor
- **WHEN** the user orbits around it
- **THEN** its heading arrow stays attached to the dot

#### Scenario: Pitched pose point

- **GIVEN** a `Pose3d` point whose forward direction is pitched up
- **THEN** the arrow points up along that direction rather than lying flat on the field

### Requirement: Hidden drawings

In 3D, drawings MUST be hidden behind field elements and robots in front of them, like real objects.

#### Scenario: Path behind a hub

- **GIVEN** a path that passes behind a hub as seen from the camera
- **THEN** the part of the path behind the hub is hidden

### Requirement: Cursor position in 3D

In 3D, the cursor position SHALL be where the pointer's line of sight meets the floor, ignoring field elements in the way, and MUST only be shown within the field boundary.

#### Scenario: Pointer over a hub

- **GIVEN** a field widget in 3D
- **WHEN** the pointer is over the top of a hub
- **THEN** the cursor position shows the point on the floor behind it

### Requirement: Camera matched to video

A field widget matched from a video frame SHALL switch to 3D and show the estimated camera position, orientation, field of view, and frame aspect ratio. The camera MUST stay there while the timeline and its drawings update. The match MUST NOT be saved with the dashboard. "Exit camera match" and double-click SHALL return to the ordinary 3D camera, and switching to 2D SHALL clear the match.

#### Scenario: Compare a log with video

- **GIVEN** a field widget matched to a video frame
- **WHEN** the user scrubs the log
- **THEN** the drawings update without moving the matched camera
