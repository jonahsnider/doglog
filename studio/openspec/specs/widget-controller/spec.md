# widget-controller Specification

## Purpose

Define the controller widget, which draws a Driver Station controller with its buttons, sticks, triggers, and D-pad as they were at the cursor, so teams can see what the drivers were pressing. It reads the controller data WPILib and AdvantageKit log, and shows one controller without binding entries.

## Requirements

### Requirement: Controller data

The controller widget SHALL show one of the Driver Station's 6 controllers, picked with a Controller option. It MUST read the controller from the first of these that the source has: AdvantageKit's `/DriverStation/JoystickN` entries, AdvantageKit's entries streamed or logged from NetworkTables (`/AdvantageKit/DriverStation/JoystickN` or `/NT:/AdvantageKit/DriverStation/JoystickN`), or WPILib's `/DS:joystickN` entries. Buttons MUST be read from WPILib's `boolean[]` or AdvantageKit's bitmask.

#### Scenario: WPILib log

- **GIVEN** a log with `/DS:joystick0/buttons`, `/DS:joystick0/axes`, and `/DS:joystick0/povs`
- **WHEN** the user shows controller 0
- **THEN** the widget draws its buttons, sticks, triggers, and D-pad from those entries

#### Scenario: AdvantageKit log

- **GIVEN** a log with `/DriverStation/Joystick1/ButtonValues` set to 2
- **WHEN** the user shows controller 1
- **THEN** B is drawn pressed

### Requirement: Button numbering

The controller widget SHALL read the NI Driver Station's button and axis numbering, with the D-pad as a POV in degrees, and the FRC Driver Station's numbering (2027 onward), with the D-pad as buttons. The FRC Driver Station's numbering MUST be used when the source has `/DS:opMode` or the controller has AdvantageKit's `ButtonsAvailable` entry.

#### Scenario: 2027 log

- **GIVEN** a log with `/DS:opMode` and button 11 of `/DS:joystick0/buttons` pressed
- **WHEN** the user shows controller 0
- **THEN** D-pad up is drawn pressed

### Requirement: No entries

The controller widget SHALL NOT bind entries, so it has no Edit entries button or legend. Dropping any entry of a controller on the widget, ex. `/DS:joystick2/axes`, MUST show that controller instead, and other entries MUST be rejected. The pane header and suggested dashboard names MUST call the widget "Controller N".

#### Scenario: Drop a controller's entry

- **GIVEN** a controller widget showing controller 0
- **WHEN** the user drops `/DriverStation/Joystick2/POVs` on it
- **THEN** it shows controller 2
- **AND** its pane header says "Controller 2"

#### Scenario: Drop another entry

- **WHEN** the user drags `/Drive/Pose` over a controller widget
- **THEN** the widget shows that it doesn't accept the entry

### Requirement: Next controller

A newly added controller widget SHALL show the first controller that no other controller widget on the dashboard shows, preferring controllers that were plugged in. Logs record every controller as empty arrays until one is plugged in. A controller widget added from a controller's entry, ex. by double-clicking it, MUST show that controller, and MUST focus a controller widget already showing it instead of adding another.

#### Scenario: Driver and operator

- **GIVEN** a log with controllers plugged into ports 1 and 4
- **WHEN** the user adds two controller widgets
- **THEN** the first shows controller 1 and the second shows controller 4

### Requirement: Controller layouts

The controller widget SHALL draw an Xbox or a PlayStation controller, picked with a Layout option. Its Auto choice MUST use AdvantageKit's controller name and Xbox flag, then the button count (PS4 controllers report 14 buttons, Xbox controllers 10 or 16), and Xbox otherwise.

#### Scenario: PS4 controller in a WPILib log

- **GIVEN** controller 1's `/DS:joystick1/buttons` has 14 buttons
- **WHEN** the user shows controller 1
- **THEN** it is drawn as a PlayStation controller

#### Scenario: Xbox controller with 16 buttons

- **GIVEN** controller 0's `/DS:joystick0/buttons` has 16 buttons
- **WHEN** the user shows controller 0
- **THEN** it is drawn as an Xbox controller

#### Scenario: Pick a layout

- **GIVEN** a 2027 log, which doesn't tell layouts apart
- **WHEN** the user picks "PlayStation" for Layout
- **THEN** the controller is drawn as a PlayStation controller

### Requirement: Drawn controls

Both layouts SHALL draw the face buttons, bumpers, triggers, both sticks and their clicks, the D-pad, and the Back and Start buttons, which the PlayStation layout calls Share and Options. Other buttons and axes MUST NOT be drawn.

#### Scenario: Extra buttons

- **GIVEN** an Xbox controller reporting 16 buttons
- **THEN** buttons 11 to 16 aren't drawn

### Requirement: Controller drawing

The controller widget SHALL draw pressed buttons, bumpers, and D-pad directions filled with the primary color, triggers as bars filled by how far they're pressed, and sticks as a dot moved within a circle, highlighted while the stick is clicked. Face buttons MUST be labeled A, B, X, and Y on Xbox controllers and △, ○, ✕, and □ on PlayStation controllers. Diagonal D-pad directions MUST press two directions. Inputs without a sample at the cursor MUST be drawn released or centered.

#### Scenario: Diagonal D-pad

- **GIVEN** controller 0's POV is 45° at the cursor
- **THEN** D-pad up and right are drawn pressed

### Requirement: Axis values

The controller widget SHALL offer a Show axis values option, off by default. When on, a footer below the drawing MUST show the X and Y values of each stick and the value of each trigger at the cursor, grouped by side. It MUST show the same axis values as the drawing, to two decimal places, using the trigger labels for the selected layout.

#### Scenario: Read the axes while scrubbing

- **GIVEN** Show axis values is on and the left stick is at X = 0.04 and Y = -0.02 at the cursor
- **THEN** the left column shows X +0.04 and Y -0.02
- **WHEN** the cursor moves to a sample with different axis values
- **THEN** the footer updates with the drawing

### Requirement: Missing controller

When the source has no entries for the shown controller, or only empty values because nothing was plugged in, the controller widget SHALL show the shared no-data message instead of a controller.

#### Scenario: Nothing plugged in

- **GIVEN** a log where `/DS:joystick3/axes` is always empty
- **WHEN** the user shows controller 3
- **THEN** the widget says the source doesn't have controller 3
