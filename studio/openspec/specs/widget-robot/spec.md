# widget-robot Specification

## Purpose

Define the robot widget, which shows a robot's mechanisms and CAD model at the cursor, in 2D or 3D, so teams can see what the robot's mechanisms were doing. It's robot-relative: the robot never moves, and placing robots on the field is left to field widgets.

## Requirements

### Requirement: Robot inputs

The robot widget SHALL accept `Mechanism2d` entries and `Pose3d[]` entries, and any number of them MAY be bound.

#### Scenario: Mechanism and parts

- **WHEN** the user binds `/Robot/Arm/Mechanism`, a `Mechanism2d` entry, and `/Robot/Parts`, a `Pose3d[]` entry
- **THEN** both are listed in the widget's legend

### Requirement: View

The robot widget SHALL have a View option with "2D" and "3D", which it MUST infer: 2D when its entries are exactly one `Mechanism2d` entry, and 3D otherwise. The widget MUST also show a control for the View option inside the widget.

#### Scenario: One mechanism

- **WHEN** the user double-clicks `/Robot/Arm/Mechanism`, a `Mechanism2d` entry
- **THEN** a robot widget shows it in 2D

#### Scenario: Mechanism and parts

- **GIVEN** a robot widget showing `/Robot/Arm/Mechanism` in 2D
- **WHEN** the user binds `/Robot/Parts`, a `Pose3d[]` entry
- **THEN** the widget switches to 3D

#### Scenario: No entries

- **GIVEN** a robot widget with no bound entries, or no source
- **THEN** the robot is drawn in 3D instead of an empty state

### Requirement: Robot legend

The robot widget's legend SHALL list one entry per row in the top-left corner over the robot, only as large as its entries, so the robot MUST stay centered in the widget. A legend taller than about half the widget MUST scroll, and one wider than the widget beside the 3D view cube MUST shorten its names.

#### Scenario: Wide widget

- **GIVEN** a robot widget twice as wide as it is tall, with one mechanism
- **THEN** the mechanism is centered in the widget, with the legend in its top-left corner

### Requirement: 2D mechanism

In 2D, the robot widget SHALL draw the first `Mechanism2d` entry that isn't hidden, as WPILib's simulation GUI does: a canvas sized to the mechanism's dimensions, fit to the widget and filled with its background color. The legend MUST mark the widget's other entries "3D only".

#### Scenario: Show another mechanism

- **GIVEN** a robot widget in 2D showing `/Robot/Arm/Mechanism`, also bound to `/Robot/Elevator/Mechanism`
- **THEN** `/Robot/Elevator/Mechanism` is marked "3D only" in the legend
- **WHEN** the user hides `/Robot/Arm/Mechanism` from the legend
- **THEN** `/Robot/Elevator/Mechanism` is drawn

### Requirement: 2D ligaments

In 2D, each ligament SHALL be drawn as a line with rounded ends at its logged weight and color. Each root MUST start at its position, and each ligament MUST start at the end of its parent, at its angle counterclockwise from its parent's direction (from +X for ligaments on a root).

#### Scenario: Arm on a root

- **GIVEN** a `Mechanism2d` 3 wide and 2 tall, with a root at (1, 0.5) and a ligament on it 1 long at 90°
- **THEN** the ligament is drawn from (1, 0.5) straight up to (1, 1.5), with (0, 0) at the canvas's bottom-left corner

#### Scenario: Nested ligament

- **GIVEN** a ligament at 90° with a ligament on it at -90°
- **THEN** the second ligament points along +X

### Requirement: 2D zoom and pan

In 2D, scrolling or pinching over the mechanism SHALL zoom in and out around the pointer, from the whole canvas up to 8×. Dragging the zoomed mechanism MUST pan it, and it MUST NOT pan or zoom out past the edges of the canvas. Double-clicking SHALL reset the view. Lines MUST zoom with the mechanism, including their width.

#### Scenario: Reset

- **GIVEN** the user has zoomed in on a mechanism
- **WHEN** the user double-clicks it
- **THEN** the whole canvas is shown again

### Requirement: Robot controls reference

An unbound 3D Robot SHALL show a controls reference above its bottom controls. It MUST use the same [labels, input variants, and layout rules](../widget-field/spec.md#requirement-field-controls-reference) and [timing](../widget-field/spec.md#requirement-field-controls-reference-timing) as Field. It MUST NOT show in 2D, with any bound entries, or during capture.

#### Scenario: Learn the default 3D view

- **WHEN** the user creates a robot widget without binding any entries
- **THEN** the quick reference explains the 3D controls above the bottom controls
- **WHEN** the user starts orbiting the robot
- **THEN** the reference fades out, without blocking the drag

#### Scenario: Switch to 2D

- **WHEN** the user switches the Robot widget to 2D
- **THEN** it does not show the navigation reference, even in the empty state
- **AND** the 2D/3D toggle stays available

### Requirement: 3D scene

In 3D, the robot widget SHALL draw the robot at the origin, in WPILib's robot coordinates: the origin is the robot's center on the floor, +X points forward, +Y left, and +Z up. Distances in robot configs, poses, and mechanisms MUST be in meters. The scene SHALL show a 2.4 m grid on the floor, labeled "+X front" and "+Y left", over the pane's background, and its colors MUST follow the theme.

#### Scenario: Axes

- **GIVEN** a robot widget in 3D
- **THEN** the grid's labels show which way the robot's front and left are

### Requirement: 3D lighting

The scene SHALL use soft lighting that stays fixed as the camera moves. Imported robot models SHALL use low-gloss shading while keeping their exported base colors, opacity, and metalness.

#### Scenario: Orbit around a glossy robot

- **GIVEN** an imported robot whose CAD export uses glossy materials
- **WHEN** the user orbits the camera around it
- **THEN** the lighting stays fixed and the imported surfaces don't show sharp reflections that obscure detail

### Requirement: 3D camera

In 3D, the robot widget SHALL use a camera without perspective, starting from the robot's front right, a little above it. Dragging MUST orbit around the robot, including below the floor, right-dragging MUST pan, and scrolling or pinching MUST zoom, from 4× farther out to 16× closer than the default view. A Reset view button beside the View control and double-clicking SHALL reset the camera, animating unless the system reduces motion. The camera MUST NOT be saved with the dashboard.

#### Scenario: Pan with the right mouse button

- **WHEN** the user right-drags the scene
- **THEN** the view pans, with a move cursor while dragging
- **AND** the widget's context menu doesn't open

#### Scenario: Reset by double-clicking

- **GIVEN** the user has orbited the camera
- **WHEN** the user double-clicks the widget
- **THEN** the camera goes back to the robot's front right

### Requirement: 3D pan limit

Panning with any input MUST keep the camera's orbit target within 2.25 m of its default position, at any zoom level.

#### Scenario: Pan beyond the limit

- **WHEN** the user right-drags or holds a pan key to move beyond the limit
- **THEN** the target stops at the limit without changing the camera's angle or zoom

### Requirement: Faster 3D camera with Shift

Holding Shift SHALL make the robot widget's 3D camera zoom and pan twice as fast, including when scrolling a mouse wheel that the browser scrolls sideways while Shift is held.

#### Scenario: Zoom faster with Shift

- **WHEN** the user holds Shift and scrolls over the scene
- **THEN** the camera zooms twice as fast as scrolling without Shift

### Requirement: View cube

In 3D, the robot widget SHALL show a view cube in its top-right corner that turns with the camera and labels the robot's Front, Back, Left, Right, Top, and Bottom, with thin lines between each face's center and its edges and corners. Clicking a face, edge, or corner MUST turn the camera to look from that direction, keeping its zoom and what it's centered on, animating unless the system reduces motion.

#### Scenario: Top view

- **WHEN** the user clicks the view cube's Top face
- **THEN** the robot is shown from directly above, with its front pointing down

#### Scenario: Corner

- **WHEN** the user clicks the view cube's corner between Front, Left, and Top
- **THEN** the robot is shown from its front left, above it

### Requirement: 3D keyboard controls

While a robot widget in 3D is focused, holding the arrow keys SHALL orbit the camera, W and S MUST zoom in and out, A and D MUST pan sideways, and Q and E MUST lower and raise the view, moving smoothly until the key is released. Holding Shift MUST zoom and pan twice as fast, without changing how fast the arrow keys orbit.

#### Scenario: Zoom with the keyboard

- **GIVEN** a focused robot widget in 3D
- **WHEN** the user holds W
- **THEN** the camera zooms in until it's released

### Requirement: 3D mechanisms

In 3D, the robot widget SHALL draw every `Mechanism2d` entry that isn't hidden, each ligament as a box as long as the ligament and 1 cm thick per unit of weight, in its logged color. Mechanism backgrounds MUST NOT be drawn in 3D.

#### Scenario: Several mechanisms

- **GIVEN** a robot widget in 3D bound to `/Robot/Arm/Mechanism` and `/Robot/Elevator/Mechanism`
- **THEN** both mechanisms are drawn on the robot

### Requirement: Mechanism planes

In 3D, the center of a mechanism canvas's bottom edge SHALL be at the robot's origin, on a plane picked by the entry's role in the legend: XZ plane (seen from the robot's right), the inferred role, YZ plane (seen from the robot's front), or XY plane (the floor, seen from above with the robot's front up). The legend MUST NOT show planes in 2D.

#### Scenario: XZ plane

- **GIVEN** a `Mechanism2d` 2 wide, with a root at (1, 0) and a ligament on it 0.5 long at 90°
- **THEN** the ligament is drawn as a box from the robot's origin straight up to 0.5 m

#### Scenario: YZ plane

- **GIVEN** the same mechanism on the YZ plane, and its ligament at 0°
- **THEN** the ligament is drawn along the floor from the robot's origin toward its left

### Requirement: Robot

The robot widget SHALL have a Robot option, whose default is "Swerve drivebase": a 0.9 m square frame with bumpers and four swerve modules, drawn without a model. Its other choices SHALL be the robots of the projects added on the device, shared by every widget and dashboard. The option's menu MUST offer "Add project…", and "Remove project" to remove the picked robot's project with all its robots. Robots MUST only be drawn in 3D.

#### Scenario: Default robot

- **GIVEN** a robot widget in 3D, with no robot picked
- **THEN** the swerve drivebase is drawn

#### Scenario: Add a project

- **WHEN** the user picks "Add project…" from the Robot option and chooses a robot project
- **THEN** the project's robots are added to the Robot option's choices, and its first robot is picked

#### Scenario: Robot not added on this device

- **GIVEN** a shared dashboard with a robot widget showing the robot "581 2026"
- **WHEN** a teammate who hasn't added that robot's project opens it
- **THEN** the swerve drivebase is drawn, with a note that "581 2026" isn't added on this device

### Requirement: Last picked robot

A new robot widget SHALL start with the robot picked last on the device, from a Robot option, a field robot's legend row or Robot model menu, or adding a project, saved in the widget so others see the same robot. Before a robot is picked, or after that robot's project is removed, it MUST start with the swerve drivebase.

#### Scenario: Last picked robot

- **GIVEN** the user picked the robot "581 2026" in a robot widget
- **WHEN** they add a robot widget to another dashboard
- **THEN** it shows "581 2026"

### Requirement: Robot projects

A robot project SHALL be a folder with a `doglog.jsonc` or `doglog.json` file in it, and `doglog.jsonc` MUST be used when both are present. Both MUST allow comments and trailing commas, and a published JSON schema MUST describe them so editors can validate them. Project files MUST be read where they are, so changes to them are used the next time the robot is loaded without adding the project again.

#### Scenario: Robot code repository

- **GIVEN** a robot project with `doglog.jsonc` next to `build.gradle`, and models in a `cad` folder
- **WHEN** the user adds the project
- **THEN** its robot is drawn using the models in `cad`

### Requirement: Pick a robot project's folder

Adding a robot project SHALL ask for its folder, and MUST say so, since browsers don't give access to a chosen file's folder.

#### Scenario: Add from Settings

- **WHEN** the user presses Add project in Settings
- **THEN** a folder picker opens, and the Add a project row says to choose the project's folder

### Requirement: Several robots in a project

A project's robots SHALL be read from the `robots` array, and each robot MUST have a different name. Adding a project again MUST replace the robots it added before.

#### Scenario: Competition and practice robots

- **GIVEN** a `doglog.jsonc` with a competition robot and a practice robot
- **WHEN** the user adds the project
- **THEN** both robots are added to the Robot option's choices

### Requirement: Drop robot projects

Dropping a robot project's folder anywhere on the app window SHALL add it as "Add project…" does, and MUST say which robots were added. When only its `doglog.jsonc` or `doglog.json` file is dropped, the desktop app MUST add the file's folder, showing that dropping it adds a robot project while it's dragged, and the web app MUST say to drop the project's folder instead.

#### Scenario: Drop a config file on desktop

- **GIVEN** the desktop app
- **WHEN** the user drops a robot project's `doglog.jsonc` on the window
- **THEN** the project's robots are added, and a message names them

#### Scenario: Drop a config file on the web

- **GIVEN** the web app
- **WHEN** the user drops a robot project's `doglog.jsonc` on the window
- **THEN** nothing is added, and a message says to drop the robot project's folder instead

### Requirement: Dropped folders

A dropped folder with a `doglog.jsonc` or `doglog.json`, or an AdvantageScope robot's `config.json` and `model.glb`, SHALL be added as a robot project instead of opening logs in it. A dropped folder that has no logs and isn't a robot project MUST say so instead of doing nothing.

#### Scenario: Drop a folder that isn't a project

- **WHEN** the user drops a folder with no logs, `doglog.jsonc`, `doglog.json`, or AdvantageScope robot files on the window
- **THEN** nothing is added, and a message says the folder has no logs and isn't a robot project

### Requirement: Create a config from AdvantageScope robots

When an added or dropped folder has no `doglog.jsonc`, `doglog.json`, or `config.json`, but has AdvantageScope robot folders (`Robot_` folders with a `config.json`) in it or in its folders, Studio SHALL offer to create a `doglog.jsonc` that draws them as AdvantageScope does, then add the project. It MUST NOT replace an existing `doglog.jsonc`.

#### Scenario: Robot code with AdvantageScope assets

- **GIVEN** robot code with `ascope_assets/Robot_2026/config.json` and no `doglog.jsonc`
- **WHEN** the user adds the robot code's folder and accepts the offer
- **THEN** `doglog.jsonc` is created in the robot code with the robot "2026" using `ascope_assets/Robot_2026/model.glb`
- **AND** the project is added with that robot

### Requirement: Robot projects on the web

The web app SHALL only add robot projects in browsers that can keep access to folders, and MUST say why "Add project…" is unavailable in others. When the browser asks to allow access to a project's folder again, ex. after it's reopened, the widget MUST offer a button to allow it, then draw the robot.

#### Scenario: Reopened web app

- **GIVEN** a robot widget showing a robot project in the web app
- **WHEN** the user reopens the web app and the browser hasn't kept access to the project's folder
- **THEN** the swerve drivebase is drawn, with a note and an "Allow access" button
- **WHEN** the user presses it and allows access
- **THEN** the project's robot is drawn

### Requirement: Invalid robot projects

A robot project whose files aren't valid SHALL NOT be drawn, and the widget MUST say which file and key are wrong instead, drawing the swerve drivebase.

#### Scenario: Folder without a config

- **WHEN** the user picks "Add project…" and chooses a folder without `doglog.jsonc`, `doglog.json`, or an AdvantageScope robot's `config.json`
- **THEN** nothing is added, and a message says the folder doesn't have a `doglog.jsonc`

#### Scenario: Unknown key

- **GIVEN** a `doglog.jsonc` whose first robot has a `colour` key
- **THEN** the widget says `robots.0.colour` in `doglog.jsonc` isn't a known key
- **AND** the swerve drivebase is drawn

### Requirement: Robot config

Each of a project's robots SHALL have a `name`, an optional glTF binary `model` of the robot's body, drawing the swerve drivebase without one, an optional `mount`, and an optional list of `parts`, each with its own `model` and `origin`. Model paths MUST be relative to the project's folder. `mount` MUST move every model from the CAD's coordinates into the robot's, and each part's `origin` MUST be the pose of its pivot in the robot's coordinates, where the CAD placed it.

```jsonc
{
	"$schema": "https://doglog.studio/doglog.schema.json",
	"robots": [
		{
			"name": "581 2026",
			"model": "cad/robot.glb",
			"mount": { "z": 0.05, "roll": 90 },
			"parts": [
				{ "model": "cad/elevator.glb", "origin": { "x": 0.1, "z": 0.2 } },
				{ "model": "cad/arm.glb", "origin": { "x": 0.1, "z": 0.9 } },
			],
		},
	],
}
```

#### Scenario: CAD placement

- **GIVEN** a robot with an arm part, and no `Pose3d[]` entry bound
- **THEN** the arm is drawn where the CAD placed it

### Requirement: Device names

A robot config SHALL name the robot's CAN devices for HOOT logs in an optional `devices`, by CAN bus, then by model and ID as HOOT logs name them, with an ID from 0 to 62. A name MAY have `/` to group devices. Each of a robot's devices MUST have a different name, and a name MUST NOT be a group of another, ex. `Shooter` beside `Shooter/Left`.

```jsonc
"devices": {
	"rio": { "TalonFX-11": "Shooter/Left", "TalonFX-12": "Shooter/Right", "CANcoder-11": "Shooter/Encoder" },
	"drive": { "Pigeon2-0": "Gyro" },
}
```

#### Scenario: Same name twice

- **GIVEN** a robot that names `TalonFX-11` and `TalonFX-12` on `rio` both `Shooter`
- **THEN** the robot project is invalid, and says `robots.0.devices` in `doglog.jsonc` names two devices `Shooter`

#### Scenario: Robot without a model

- **GIVEN** a robot with a `name` and `devices`, and no `model`
- **THEN** the project can be added, and robot widgets draw the swerve drivebase for it

### Requirement: Compressed models

The 3D widgets SHALL accept glTF binary models with Draco or Meshopt geometry compression and KTX2/Basis Universal textures. The app MUST bundle the decoders for offline use.

#### Scenario: Compressed robot project

- **GIVEN** a robot project whose body and parts use different compression formats
- **WHEN** the user selects the project in a 3D widget while offline
- **THEN** the widget draws the body and parts, including their textures

### Requirement: Flush CAD faces

Where faces of a robot's models overlap in the same plane, the robot widget SHALL draw the smaller part's face, and it MUST NOT flicker between them as the camera moves. Faces behind others MUST NOT show through.

#### Scenario: Insert in a plate

- **GIVEN** a robot whose CAD has an insert flush with the face of a plate
- **WHEN** the user orbits the camera
- **THEN** the insert's face is drawn over the plate's without flickering

#### Scenario: See-through panel

- **GIVEN** a robot whose CAD has a translucent polycarbonate panel mounted flush to a plate
- **THEN** the plate is drawn through the panel without streaks

### Requirement: Transforms in robot configs

Transforms in robot configs (`mount` and `origin`) SHALL be written as `x`, `y`, and `z` in meters and `roll`, `pitch`, and `yaw` in degrees, each 0 when left out. Rotations MUST mean the same as WPILib's `Rotation3d` with the same roll, pitch, and yaw.

#### Scenario: Yaw

- **GIVEN** a robot whose `mount` has a `yaw` of 90
- **THEN** the front of the CAD model faces the robot's left

### Requirement: Robot parts

The first `Pose3d[]` entry that isn't hidden SHALL move the robot's parts: the pose at each index MUST place the pivot of the part at the same index, in the robot's coordinates, as AdvantageScope's component poses do. Parts without a pose MUST be drawn where the CAD placed them, and poses without a part MUST be ignored. The legend MUST mark the widget's other `Pose3d[]` entries "Unused".

#### Scenario: Raise the arm

- **GIVEN** a robot whose second part is an arm with its `origin` at (0.1, 0, 0.9)
- **AND** a `Pose3d[]` entry whose second pose is at (0.1, 0, 0.9) with a pitch of -30°
- **THEN** the arm is drawn rotated 30° up around its pivot

#### Scenario: Too few poses

- **GIVEN** a robot with two parts, and a `Pose3d[]` entry with one pose
- **THEN** the second part is drawn where the CAD placed it

### Requirement: AdvantageScope robots

A folder with an AdvantageScope robot `config.json` and no `doglog.jsonc` or `doglog.json` SHALL be accepted as a robot project, and drawn as AdvantageScope draws it, with its `model.glb` as the body and each `model_N.glb` as part N. Its cameras MUST be ignored.

#### Scenario: AdvantageScope robot folder

- **GIVEN** a `Robot_Example` folder with `config.json`, `model.glb`, `model_0.glb`, and `model_1.glb`
- **WHEN** the user adds it as a project
- **THEN** its robot is drawn with two parts, moved by the widget's `Pose3d[]` entry
