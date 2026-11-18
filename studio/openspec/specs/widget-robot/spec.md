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

The robot widget's legend SHALL list one entry per row above the robot, and MUST move beside it when the widget is at least one and a half times as wide as it is tall. A legend too long for its space MUST scroll.

#### Scenario: Wide widget

- **GIVEN** a robot widget twice as wide as it is tall, with several mechanisms
- **THEN** the legend is a column on the left of the robot

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

### Requirement: 3D scene

In 3D, the robot widget SHALL draw the robot at the origin, in WPILib's robot coordinates: the origin is the robot's center on the floor, +X points forward, +Y left, and +Z up. Distances in robot configs, poses, and mechanisms MUST be in meters. The scene SHALL show a 2.4 m grid on the floor, labeled "+X front" and "+Y left", over the pane's background, and its colors MUST follow the theme.

#### Scenario: Axes

- **GIVEN** a robot widget in 3D
- **THEN** the grid's labels show which way the robot's front and left are

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

### Requirement: View cube

In 3D, the robot widget SHALL show a view cube in its top-right corner that turns with the camera and labels the robot's Front, Back, Left, Right, Top, and Bottom, with thin lines between each face's center and its edges and corners. Clicking a face, edge, or corner MUST turn the camera to look from that direction, keeping its zoom and what it's centered on, animating unless the system reduces motion.

#### Scenario: Top view

- **WHEN** the user clicks the view cube's Top face
- **THEN** the robot is shown from directly above, with its front pointing down

#### Scenario: Corner

- **WHEN** the user clicks the view cube's corner between Front, Left, and Top
- **THEN** the robot is shown from its front left, above it

### Requirement: 3D keyboard controls

While a robot widget in 3D is focused, holding the arrow keys SHALL orbit the camera, W and S MUST zoom in and out, A and D MUST pan sideways, and Q and E MUST lower and raise the view, moving smoothly until the key is released.

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

The robot widget SHALL have a Robot option, which MUST default to a simple swerve robot drawn without a model: a 0.9 m square frame with bumpers and four swerve modules. Its other choices SHALL be the robots of the projects the user added. The option's menu MUST offer "Add project…" and "Remove project" for the picked robot. Robots MUST only be drawn in 3D.

#### Scenario: Default robot

- **GIVEN** a robot widget in 3D, with no robot picked
- **THEN** the simple swerve robot is drawn

#### Scenario: Add a project

- **WHEN** the user picks "Add project…" from the Robot option and chooses a robot project's folder
- **THEN** the project's robot is added to the Robot option's choices and picked

#### Scenario: Robot not added on this device

- **GIVEN** a shared dashboard with a robot widget showing the robot "581 2026"
- **WHEN** a teammate who hasn't added that robot's project opens it
- **THEN** the simple swerve robot is drawn, with a note that "581 2026" isn't added on this device

### Requirement: Robot projects

A robot project SHALL be a folder with a `doglog.jsonc` or `doglog.json` file in it, and `doglog.jsonc` MUST be used when both are present. Both MUST allow comments and trailing commas, and a published JSON schema MUST describe them so editors can validate them. A project's robot MUST be read from the `robot` key, and project files MUST be read where they are, so changes to them are used the next time the robot is loaded without adding the project again.

#### Scenario: Robot code repository

- **GIVEN** a robot project with `doglog.jsonc` next to `build.gradle`, and models in a `cad` folder
- **WHEN** the user adds the project
- **THEN** its robot is drawn using the models in `cad`

### Requirement: Robot projects on the web

The web app SHALL only add robot projects in browsers that can keep access to folders, and MUST say why "Add project…" is unavailable in others. When the browser asks to allow access to a project's folder again, ex. after it's reopened, the widget MUST offer a button to allow it, then draw the robot.

#### Scenario: Reopened web app

- **GIVEN** a robot widget showing a robot project in the web app
- **WHEN** the user reopens the web app and the browser hasn't kept access to the project's folder
- **THEN** the simple swerve robot is drawn, with a note and an "Allow access" button
- **WHEN** the user presses it and allows access
- **THEN** the project's robot is drawn

### Requirement: Invalid robot projects

A robot project whose files aren't valid SHALL NOT be drawn, and the widget MUST say which file and key are wrong instead, drawing the simple swerve robot.

#### Scenario: Unknown key

- **GIVEN** a `doglog.jsonc` whose robot has a `colour` key
- **THEN** the widget says `robot.colour` in `doglog.jsonc` isn't a known key
- **AND** the simple swerve robot is drawn

### Requirement: Robot config

A project's robot SHALL have a `name`, the glTF binary `model` of the robot's body, an optional `mount`, and an optional list of `parts`, each with its own `model` and `origin`. Model paths MUST be relative to the project's folder. `mount` MUST move every model from the CAD's coordinates into the robot's, and each part's `origin` MUST be the pose of its pivot in the robot's coordinates, where the CAD placed it.

```jsonc
{
	"$schema": "https://studio.doglog.dev/doglog.schema.json",
	"robot": {
		"name": "581 2026",
		"model": "cad/robot.glb",
		"mount": { "z": 0.05, "roll": 90 },
		"parts": [
			{ "model": "cad/elevator.glb", "origin": { "x": 0.1, "z": 0.2 } },
			{ "model": "cad/arm.glb", "origin": { "x": 0.1, "z": 0.9 } },
		],
	},
}
```

#### Scenario: CAD placement

- **GIVEN** a robot with an arm part, and no `Pose3d[]` entry bound
- **THEN** the arm is drawn where the CAD placed it

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
