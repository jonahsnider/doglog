# widgets Specification

## Purpose

Define the behavior shared by every widget: binding entries by name, filtering by accepted data type, following the time cursor, and handling missing data, so new widgets are cheap to add. Widgets that don't show entries, such as the notepad, accept no data types and are exempt from the entry binding requirements.

## Requirements

### Requirement: Read-only widgets

Widgets SHALL only display data and MUST NOT write to or modify any data source.

#### Scenario: No editing

- **GIVEN** a widget bound to a live NT entry
- **THEN** the widget offers no way to change the entry's value

### Requirement: Accepted data types

Each widget type SHALL declare the data types it accepts, which MAY be specific struct types such as `SwerveModuleState[]`, and only entries of accepted types MUST be bindable to it.

#### Scenario: Type mismatch on drop

- **GIVEN** a widget that only accepts strings
- **WHEN** the user drags a numeric entry onto it
- **THEN** the entry is not bound
- **AND** the user is shown that the type is not accepted

### Requirement: Edit entries button

Each widget that accepts entries SHALL have an Edit entries button in its pane header that starts editing its entries in the entry browser, or stops it if it's already being edited. The button MUST show as pressed while its widget is being edited.

#### Scenario: Start editing

- **GIVEN** a console widget
- **WHEN** the user presses its Edit entries button
- **THEN** the entry browser edits the console's entries

#### Scenario: Notepad

- **GIVEN** a notepad
- **THEN** its pane header has no Edit entries button

### Requirement: Edit entries from the context menu

A widget's context menu SHALL offer Edit entries and to remove a bound entry. Right-clicking the part of a widget that shows an entry, such as a values table row, MUST offer to remove that entry directly; elsewhere, bound entries MUST be listed as checkboxes in an "Entries" submenu, with their role when it's shown in the legend. Middle-clicking the part of a widget that shows an entry SHALL remove it, and only that binding of an entry bound more than once.

#### Scenario: Remove a values table row

- **GIVEN** a values table showing `/Arm/Angle`
- **WHEN** the user right-clicks the `/Arm/Angle` row and chooses "Remove /Arm/Angle"
- **THEN** the table stops showing `/Arm/Angle`

#### Scenario: Middle-click to remove

- **GIVEN** a values table showing `/Arm/Angle`
- **WHEN** the user middle-clicks the `/Arm/Angle` row
- **THEN** the table stops showing `/Arm/Angle`

#### Scenario: Remove one of two bindings

- **GIVEN** a field widget showing `/Drive/Pose` as a robot and as a ghost
- **WHEN** the user opens the context menu outside the drawings and unchecks "Entries", then "/Drive/Pose (Ghost)"
- **THEN** the widget only shows `/Drive/Pose` as a robot

### Requirement: Toggle several entries in one menu

On the web, the context menu's "Entries" submenu SHALL stay open while entries are toggled. Entries unchecked since the menu opened MUST stay listed, and checking one again MUST restore it in its original position.

#### Scenario: Restore an entry before closing the menu

- **GIVEN** a line chart showing `/Arm/Angle` then `/Arm/Voltage`
- **WHEN** the user unchecks `/Arm/Angle` in the "Entries" submenu, then checks it again without closing the menu
- **THEN** the chart shows `/Arm/Angle` then `/Arm/Voltage`

### Requirement: Bind by drag and drop

Users SHALL be able to bind an entry by dragging it from the entry browser onto a widget.

#### Scenario: Drag from entry browser

- **WHEN** the user drags an accepted entry from the entry browser onto a widget
- **THEN** the entry is bound to that widget

#### Scenario: Bind again

- **GIVEN** a widget showing `/Arm/Angle`
- **WHEN** the user drags `/Arm/Angle` onto it from the entry browser or another widget
- **THEN** the widget shows `/Arm/Angle` twice

### Requirement: Drag entries out of widgets

The part of a widget that shows an entry, such as a values table row or swerve legend item, SHALL be draggable. Dropping it on another entry of the same widget MUST move it to that entry's position, and dropping it on another widget MUST move it after that widget's entries. Rows whose other parts have their own interactions, such as selecting values, MUST be dragged by the entry name. Widgets that don't show entries individually, such as the console, are exempt.

#### Scenario: Reorder

- **GIVEN** a values table showing `/Arm/Angle` then `/Arm/Voltage`
- **WHEN** the user drags the `/Arm/Voltage` row onto the `/Arm/Angle` row
- **THEN** the table shows `/Arm/Voltage` then `/Arm/Angle`
- **AND** while dragging, a line marks where it will go

#### Scenario: Move to another widget

- **GIVEN** a values table and a discrete timeline showing `/Intake/HasPiece`
- **WHEN** the user drags the `/Intake/HasPiece` timeline row onto the values table
- **THEN** the values table shows `/Intake/HasPiece` and the discrete timeline doesn't

#### Scenario: Dropped outside a widget

- **WHEN** the user drags a values table row and drops it outside any widget
- **THEN** the table is unchanged

### Requirement: Roles

A widget MAY show entries in different ways, called roles, such as the field drawing a `Pose2d` as a robot or a ghost. Each binding's role SHALL be inferred unless the user picks one, and unless the widget infers it from the bindings before it, a binding of an entry that's bound more than once MUST infer the first role none of the entry's other bindings have. A picked role the entry can't take, such as after opening a log where its type is different, MUST be kept but not used.

#### Scenario: Second binding

- **GIVEN** a field widget showing `/Drive/Pose` as a robot
- **WHEN** the user drags `/Drive/Pose` onto it again
- **THEN** the new binding is drawn as a ghost

#### Scenario: Picked role doesn't fit

- **GIVEN** a field widget showing `/Drive/Pose` as a ghost
- **WHEN** the user opens a log where `/Drive/Pose` is a `Translation2d`
- **THEN** it is drawn as a point
- **AND** it is drawn as a ghost again once a log where it's a `Pose2d` is opened

### Requirement: Connections

A widget MAY let bindings be connected to each other, such as the field drawing lines from a robot to the tags it sees. Connections MUST be saved with the dashboard, and MUST be removed when either binding is removed or moved to another widget.

#### Scenario: Source removed

- **GIVEN** a field widget where `/Drive/Pose` is connected to `/Vision/SeenTags`
- **WHEN** the user removes `/Drive/Pose`
- **THEN** `/Vision/SeenTags` isn't connected to anything

### Requirement: Pick a role

The legend SHALL show a binding's role after its name when the entry can take more than one role, or is bound more than once, and clicking the role MUST open a menu of the entry's roles to pick from. The role MUST take up the width of the entry's widest role, so picking another doesn't resize the legend or move what's beside it.

#### Scenario: Pick a role

- **GIVEN** a field widget showing `/Drive/Pose` as a robot
- **WHEN** the user clicks "Robot" in its legend item and chooses "Ghost"
- **THEN** `/Drive/Pose` is drawn as a ghost

#### Scenario: One role

- **GIVEN** a swerve widget showing `/Drive/MeasuredStates`, a `SwerveModuleState[]` entry, once
- **THEN** its legend item doesn't show a role

### Requirement: Hide entries

Clicking a binding's swatch in a widget's legend SHALL hide it, and clicking it again MUST show it. Hidden bindings MUST stay in the legend with a hollow swatch and a muted name, and MUST NOT be drawn or used, such as for the swerve widget's heading. Hiding a binding MUST NOT change the other bindings' colors or roles. Widgets without a legend SHALL show every binding.

#### Scenario: Hide a robot

- **GIVEN** a field widget showing `/Drive/Pose` and `/Vision/EstimatedPose`
- **WHEN** the user clicks the swatch next to `/Vision/EstimatedPose`
- **THEN** `/Vision/EstimatedPose` isn't drawn
- **AND** its legend item has a hollow swatch
- **AND** `/Drive/Pose` keeps its color

### Requirement: Widget options

A widget MAY declare a few options to override what it infers from its entries or pick what can't be inferred. Options MUST be listed in a Widget options popover, whose pane header button only widgets with options have, and MUST be saved with the dashboard. A widget MAY also show controls for its options inside the widget, which change the same saved value. Changing the widget type MUST reset its options.

#### Scenario: Pick an option

- **GIVEN** a field widget
- **WHEN** the user opens its options and picks "Red left" for Orientation
- **THEN** the field is drawn with the red alliance on the left
- **AND** the choice is kept when the dashboard is reopened

#### Scenario: Invalid saved option

- **GIVEN** a dashboard saved with an option value the widget doesn't have
- **THEN** the widget uses the option's inferred choice or its default

### Requirement: Auto options

An option the widget can infer SHALL offer an "Auto" choice, labeled with the inferred choice, which is used until another choice is picked.

#### Scenario: Auto

- **GIVEN** a widget with an option it infers from its entries
- **WHEN** the user opens its options
- **THEN** the option shows "Auto" with the choice it inferred, ex. "Auto (PS4)"
- **AND** picking "Auto" after picking another choice goes back to the inferred one

### Requirement: Pick entry colors

Bindings SHALL be colored automatically by default. Right-clicking a binding's swatch in a widget's legend MUST open a picker with "Auto" and the chart colors, and MUST show the binding's current choice. Picking a color MUST draw the binding in it and save it with the dashboard, and picking "Auto" MUST go back to the automatic color. Picking a binding's color MUST NOT change the other bindings' colors.

#### Scenario: Recolor a robot

- **GIVEN** a field widget showing `/Drive/Pose` and `/Vision/EstimatedPose`
- **WHEN** the user right-clicks the swatch next to `/Vision/EstimatedPose` and picks a green color
- **THEN** `/Vision/EstimatedPose` and its swatch are green
- **AND** `/Drive/Pose` keeps its color

### Requirement: Follow the cursor

Widgets SHALL reflect the global time cursor. Value-style widgets MUST show the latest value at or before the cursor; time-series widgets MUST mark the cursor position.

#### Scenario: Latest value at cursor

- **GIVEN** an entry was set to 3 at 10 s and 5 at 20 s
- **WHEN** the cursor is at 15 s
- **THEN** a value-style widget shows 3

### Requirement: Missing data

When a bound entry doesn't exist in the active source, or no source is active, the widget SHALL show a "no data" state instead of an error and MUST keep the binding.

#### Scenario: Entry missing from source

- **GIVEN** a widget bound to `/Arm/Angle`
- **WHEN** the user opens a log without `/Arm/Angle`
- **THEN** the widget shows "no data" for that entry
- **AND** the binding is kept for future sources

### Requirement: Shortened entry names

Widgets SHALL shorten the `/Robot`, `/RealOutputs`, `/AdvantageKit`, `/AdvantageKit/RealOutputs`, and `/AdvantageKit/DriverStation` prefixes of entry names to their slashes and capital letters, shown dimmed, and MUST show the full prefix when the shortened prefix has been hovered for a short delay. `/ReplayOutputs` MUST NOT be shortened, so replayed outputs stand out from real ones.

#### Scenario: Shortened name

- **GIVEN** a widget bound to `/Robot/Arm/Angle`
- **THEN** the widget shows `/R/Arm/Angle` with `/R` dimmed

#### Scenario: Shortened AdvantageKit name

- **GIVEN** a widget bound to `/AdvantageKit/RealOutputs/Arm/Angle`
- **THEN** the widget shows `/AK/RO/Arm/Angle` with `/AK/RO` dimmed

#### Scenario: Hover to expand

- **WHEN** the user hovers `/R` in `/R/Arm/Angle`
- **THEN** after a short delay it grows to show `/Robot/Arm/Angle`

#### Scenario: Hovering the rest of the name

- **WHEN** the user hovers `/Arm/Angle` in `/R/Arm/Angle`
- **THEN** the prefix stays shortened

### Requirement: Long names in legends

When a legend has no room for an entry's full name, it SHALL also shorten the first segment after any shortened prefix the same way, unless that segment is the last one, and MUST NOT dim its letters. Names that still don't fit MUST be cut off, and MUST scroll to show the rest while hovered. The name SHALL go back to its full form once there's room for it.

#### Scenario: Collapsed segment

- **GIVEN** a narrow field legend bound to `/Robot/Localization/EstimatedPose`
- **THEN** the legend shows `/R/L/EstimatedPose` with `/R` and the slashes dimmed, but not `L`

#### Scenario: Scroll the rest of the name

- **GIVEN** a legend too narrow for `/R/L/EstimatedPose`
- **WHEN** the user hovers the name
- **THEN** it scrolls back and forth to show the rest of the name

### Requirement: Dimmed slashes in entry names

Widgets and the entry browser SHALL show the slashes in full entry names dimmed, so the name's segments stand out.

#### Scenario: Dimmed slashes

- **GIVEN** a widget bound to `/Drive/Module/Angle`
- **THEN** the widget shows `Drive`, `Module`, and `Angle` with the slashes between them dimmed

### Requirement: Default widget for an entry

Each bindable entry SHALL have a default widget, used when the entry is added without choosing a widget: numeric entries use the line graph, `/console` and `/messages` use the console, other string and boolean entries use the discrete timeline, `SwerveModuleState[]` and `SwerveModuleVelocity[]` entries use the swerve widget, entries the field widget accepts use the field widget, and all other entries use the values table.

#### Scenario: Numeric entry

- **WHEN** a `double` entry is added by double-clicking it
- **THEN** it is shown in a line graph

#### Scenario: Console entry

- **WHEN** `/messages` is added by double-clicking it
- **THEN** it is shown in a console

#### Scenario: Boolean entry

- **WHEN** a boolean entry is added by double-clicking it
- **THEN** it is shown in a discrete timeline

#### Scenario: Swerve module states

- **WHEN** a `SwerveModuleState[]` entry is added by double-clicking it
- **THEN** it is shown in a swerve widget

#### Scenario: Pose entry

- **WHEN** a `struct:Pose2d` entry is added by double-clicking it
- **THEN** it is shown in a field widget

#### Scenario: Struct entry

- **WHEN** a `struct:ChassisSpeeds` entry is added by double-clicking it
- **THEN** it is shown in a values table
