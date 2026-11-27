# widget-swerve Specification

## Purpose

Define the swerve widget, which draws a top-down view of a 4-module swerve drivetrain with each module's velocity and angle, so teams can compare measured and desired module states at a glance. The widget works without any settings.

## Requirements

### Requirement: Swerve inputs

The swerve widget SHALL accept `SwerveModuleState[]`, `SwerveModuleVelocity[]`, `SwerveModulePosition[]`, `ChassisSpeeds`, `ChassisVelocities`, `Rotation2d`, `Pose2d`, `Pose3d`, and numeric entries. Each bound entry's role MUST be inferred from its type: module arrays and chassis speeds are drawn, and the first shown `Rotation2d`, pose, or numeric entry is the robot heading. Any number of module array and chassis speeds entries MAY be bound.

#### Scenario: WPILib 2027 names

- **WHEN** the user binds a `SwerveModuleVelocity[]` or `ChassisVelocities` entry
- **THEN** it is drawn like a `SwerveModuleState[]` or `ChassisSpeeds` entry

#### Scenario: Measured and desired states

- **WHEN** the user binds `/Drive/MeasuredStates` and `/Drive/DesiredStates`
- **THEN** both are drawn on the same drivetrain in different colors

#### Scenario: Heading by type

- **WHEN** the user binds `/Drive/MeasuredStates` and `/Drive/Gyro/Yaw`, a `Rotation2d` entry
- **THEN** `/Drive/Gyro/Yaw` is used as the robot heading

#### Scenario: Extra heading entries

- **GIVEN** the widget already has a heading entry
- **WHEN** the user binds a second `Rotation2d` entry
- **THEN** the first heading entry is still used

### Requirement: Pose headings

A pose heading entry's heading SHALL be its rotation, or its yaw for `Pose3d`.

#### Scenario: Heading from a pose

- **WHEN** the user binds `/Drive/MeasuredStates` and `/Drive/Pose`, a `Pose2d` entry
- **THEN** the rotation of `/Drive/Pose` is used as the robot heading

### Requirement: Drivetrain layout

The swerve widget SHALL draw a chassis shaped like its [Robot's](#requirement-swerve-robot) dimensions, centered and fit to the widget, with 4 modules in front-left, front-right, back-left, back-right order matching the module array order. Each module MUST be labeled `FL`, `FR`, `BL`, or `BR`, and labels SHALL stay upright when the drivetrain rotates. A module array whose length isn't 4 MUST NOT be drawn, and its legend item SHALL say how many modules were expected and received.

#### Scenario: Module labels

- **GIVEN** the heading entry is 180°
- **THEN** the `FL` and `FR` labels are at the bottom of the widget
- **AND** the labels are upright

#### Scenario: Long robot

- **GIVEN** a swerve widget whose Robot's `dimensions` are 1.1 m long and 0.7 m wide
- **AND** no heading entry
- **THEN** the chassis is taller than it is wide, with the robot's front pointing up

#### Scenario: Wrong module count

- **GIVEN** the widget is bound to a `SwerveModuleState[]` entry with 3 elements
- **THEN** that entry is not drawn
- **AND** its legend item shows "expected 4 modules, got 3"

### Requirement: Swerve robot

The swerve widget SHALL have a Robot option with the same choices, "Add project…", "Remove project", and default as the [robot widget's](../widget-robot/spec.md#requirement-robot), and a new swerve widget MUST start with the [last picked robot](../widget-robot/spec.md#requirement-last-picked-robot). The Robot MUST only change the chassis's shape, from its [dimensions](../widget-robot/spec.md#requirement-robot-dimensions).

#### Scenario: Pick a project's robot

- **GIVEN** a swerve widget showing the swerve drivebase
- **WHEN** the user picks the robot "581 2026", whose `dimensions` are 0.7 m long and 0.8 m wide
- **THEN** the chassis is wider than it is tall

### Requirement: Module state arrows

For each bound `SwerveModuleState[]` or `SwerveModuleVelocity[]` entry, the swerve widget SHALL draw an arrow from each module's center showing that module's velocity. A negative speed MUST draw the arrow opposite the module angle so it always shows the actual direction of travel. Arrow length MUST grow linearly with speed, from a short base length at zero speed to the full length at the largest speed in any bound entry's history.

#### Scenario: Optimized state

- **GIVEN** one entry has a module at 0° with speed 2 m/s
- **AND** another entry has the same module at 180° with speed -2 m/s
- **THEN** both arrows point the same direction with the same length

#### Scenario: Scale from history

- **GIVEN** the fastest module speed anywhere in the bound entries is 4 m/s
- **WHEN** a module is moving at 2 m/s
- **THEN** its arrow is halfway between the base length and the full length

#### Scenario: Stopped module

- **GIVEN** a module's speed is 0 for one sample while the robot is moving
- **THEN** that module shows a short arrow instead of no arrow

### Requirement: Module positions

For each bound `SwerveModulePosition[]` entry, the swerve widget SHALL draw a fixed-length line without an arrowhead along each module's angle. Distance values are ignored.

#### Scenario: Position angles

- **GIVEN** the widget is bound to a `SwerveModulePosition[]` entry with every module at 90°
- **THEN** each module shows a line pointing toward the robot's left

### Requirement: Wheels

The swerve widget SHALL draw a wheel at each module, rotated to that module's angle in the first bound module array entry. Each later module array entry MUST also draw a semi-transparent wheel in its color at each module, rotated to its own module angles, so wheel angles can be compared.

#### Scenario: Wheel follows the first entry

- **GIVEN** the widget is bound to `/Drive/MeasuredStates` and then `/Drive/DesiredStates`
- **THEN** the solid wheels are rotated to the measured module angles
- **AND** semi-transparent wheels in `/Drive/DesiredStates`'s color are rotated to the desired module angles

### Requirement: Chassis speeds

For each bound `ChassisSpeeds` or `ChassisVelocities` entry, the swerve widget SHALL draw an arrow from the chassis center for its translational velocity, on the same scale as module arrows, and an arc arrow around the center for its rotational velocity. Counterclockwise rotation MUST draw a counterclockwise arc. Arc length SHALL be proportional to rotational speed, scaled to the fastest rotation in the entry's history.

#### Scenario: Driving forward while turning left

- **GIVEN** a `ChassisSpeeds` entry with a positive forward velocity and positive rotational velocity
- **THEN** an arrow points toward the robot's front
- **AND** a counterclockwise arc is drawn around the center

#### Scenario: Chassis speeds count toward the scale

- **GIVEN** a `ChassisSpeeds` entry reaches 5 m/s and no module exceeds 4 m/s
- **THEN** 5 m/s is the full arrow length for both chassis and module arrows

### Requirement: Chassis speeds frame

Chassis speeds entries SHALL be robot-relative unless the last part of their name contains "field", case-insensitively, and the user MAY switch each one between robot-relative and field-relative. Field-relative chassis speeds MUST be rotated by the robot heading, so their arrow points the direction the robot moves on the field. Without a heading sample, they SHALL be drawn as if the heading is 0.

#### Scenario: Field-relative by name

- **WHEN** the user binds `/Drive/FieldRelativeSpeeds`, a `ChassisSpeeds` entry
- **THEN** it is drawn as field-relative speeds

#### Scenario: Field-relative speeds

- **GIVEN** the heading entry is 90°
- **AND** a field-relative `ChassisSpeeds` entry with a positive X velocity and zero Y velocity
- **THEN** the arrow points up, toward field +X
- **AND** it points toward the robot's right side

### Requirement: Field-relative heading

Without a heading entry, the swerve widget SHALL draw the robot with its front pointing up. With a heading entry, it MUST rotate the drivetrain so field +X points up and the robot is rotated by its heading, counterclockwise positive. Numeric headings SHALL be interpreted using the entry's inferred angle unit.

#### Scenario: Robot-relative

- **GIVEN** no heading entry is bound
- **THEN** the robot's front points up

#### Scenario: Turned left

- **GIVEN** the heading entry is 90°
- **THEN** the robot's front points left

#### Scenario: No heading sample yet

- **GIVEN** a heading entry is bound but has no value at or before the cursor
- **THEN** the robot's front points up

### Requirement: Field perspective

When the heading entry is a pose, or a field of one such as `/Drive/Pose/rotation`, and a field widget on the same dashboard shows that pose, the swerve widget MUST turn the drivetrain so field +X points the same way on screen as on that field widget, so the robot faces the same way in both. The field widget's orientation and WPILib coordinates options SHALL both be followed. With several such field widgets, the first in the layout SHALL be used. Without one, field +X points up.

#### Scenario: Matches the field

- **GIVEN** a field widget showing `/Drive/Pose` with the Orientation option "Blue left" and the WPILib coordinates option "2026"
- **AND** a swerve widget whose heading entry is `/Drive/Pose`
- **WHEN** the robot's heading is 0°
- **THEN** the robot's front points right in both widgets

#### Scenario: Heading from a pose field

- **GIVEN** a field widget showing `/Drive/Pose` with the Orientation option "Blue top"
- **AND** a swerve widget whose heading entry is `/Drive/Pose/rotation`
- **WHEN** the robot's heading is 0°
- **THEN** the robot's front points down in both widgets

#### Scenario: Field removed

- **GIVEN** the swerve widget matches a field widget showing `/Drive/Pose`
- **WHEN** the field widget stops showing `/Drive/Pose`
- **THEN** field +X points up in the swerve widget again

### Requirement: Colors and legend

The swerve widget SHALL color each drawn entry from the shared chart colors in binding order, and MUST show a legend naming each bound entry with its color. The heading entry's legend item SHALL show its inferred angle unit. Entries with no value at or before the cursor MUST be dimmed in the legend and not drawn.

#### Scenario: Heading unit

- **GIVEN** `/Drive/Gyro/YawDegrees` is the heading entry
- **THEN** its legend item shows that it is read as degrees

#### Scenario: Entry without data

- **GIVEN** `/Drive/DesiredStates` has no value before the cursor
- **THEN** it is dimmed in the legend
- **AND** nothing is drawn for it
