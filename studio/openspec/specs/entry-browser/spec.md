# entry-browser Specification

## Purpose

Define the entry browser, a collapsible panel listing every entry in the active source as a searchable tree, used to find entries and drag them onto widgets.

## Requirements

### Requirement: Entry tree

The entry browser SHALL list every entry in the active source as a tree grouped by path segments, showing each entry's type indicator and value at the cursor. Top-level groups MUST start expanded.

#### Scenario: Nested entries

- **GIVEN** the source has `/Arm/Angle` and `/Arm/Velocity`
- **THEN** both appear under an expandable `Arm` group

#### Scenario: Top-level groups start expanded

- **GIVEN** a DogLog log, where every entry is under `/Robot`
- **WHEN** the user opens it
- **THEN** the `Robot` group is expanded, showing the groups and entries in it

#### Scenario: Live announcements

- **GIVEN** a live source is active
- **WHEN** a new topic is announced
- **THEN** it appears in the tree

### Requirement: Compact groups

A chain of groups that each only have one group in them SHALL be shown as one row labeled with their names, ex. `Drive/Modules`, including chains left by a search, except for the tops of pinned and hidden groups. Rows without children MUST show their type indicator where the chevron would be.

#### Scenario: Group with one group in it

- **GIVEN** the source has `/Drive/Modules/0/Speed` and `/Drive/Modules/1/Speed`, and nothing else under `/Drive`
- **THEN** one `Drive/Modules` row holds the `0` and `1` groups

### Requirement: Indent guides

While the entry browser is hovered, each level SHALL show a guide line under its group's chevron. The guide of the group holding the row last clicked or moved to with the keyboard, or of that row when it's an expanded group, MUST always be shown and stand out from the others.

#### Scenario: Active group's guide

- **GIVEN** the user clicked `/Drive/Modules/0/Speed`
- **WHEN** the pointer leaves the entry browser
- **THEN** only the guide under `0` is shown

### Requirement: Sticky parent groups

The groups containing the rows at the top of the list SHALL stick there while their rows scroll under them, and clicking a stuck group MUST scroll back to it.

#### Scenario: Scrolling through a large group

- **GIVEN** `/Drive/Modules` is expanded and has more rows than fit in the entry browser
- **WHEN** the user scrolls past the `Drive/Modules` row
- **THEN** `Drive/Modules` stays at the top of the list until its last row scrolls by

### Requirement: Array elements and struct fields

Each element of an array entry and each field of a struct entry SHALL be listed under it as an entry of its own, named by its index or field name, so it can be found, dragged, and bound as if it was logged on its own. Elements of struct arrays and fields of nested structs MUST be listed the same way, as deep as they go.

#### Scenario: One swerve module's speed

- **GIVEN** the source has `/Drive/ModuleStates` of type `struct:SwerveModuleState[]` with four modules
- **THEN** `/Drive/ModuleStates` has rows `0` through `3`, each with `speed` and `angle` rows
- **WHEN** the user drags `/Drive/ModuleStates/1/speed` onto a graph
- **THEN** the graph plots the second module's speed

#### Scenario: One element of a number array

- **GIVEN** the source has `/Shooter/Velocities` of type `double[]`
- **WHEN** the user double-clicks `/Shooter/Velocities/0`
- **THEN** the first element is added to the dashboard like a `double` entry

### Requirement: Array elements over time

An array SHALL list as many elements as the longest value logged so far, and an element MUST only have values from when the array was long enough to include it. Elements MUST have their array's unit.

#### Scenario: Live arrays get longer

- **GIVEN** a live source where `/Vision/TargetIds` has only had one element
- **WHEN** a value with three elements arrives
- **THEN** `/Vision/TargetIds/1` and `/Vision/TargetIds/2` appear in the tree

### Requirement: Structs with one field

A struct with one field, like a Java enum logged as a struct or a `Rotation2d`, SHALL be shown as one row with the field's value instead of listing the field under it, nested as deep as single fields go. The row MUST still be the struct entry, except that dropping it on a widget that can't show the struct but can show the field, double-clicking it, and adding it from its context menu MUST use the field.

#### Scenario: Enum logged as a struct

- **GIVEN** the source has `/Arm/State` of type `struct:ArmState`, whose only field is `enum {STOWED=0, SCORING=1} int8 variant`
- **THEN** the `State` row shows the variant's value, with no `variant` row under it
- **WHEN** the user drags `State` onto a graph
- **THEN** the graph shows `/Arm/State/variant`

#### Scenario: Struct widgets still get the struct

- **GIVEN** the source has `/Drive/Heading` of type `struct:Rotation2d`
- **WHEN** the user drags `Heading` onto a table
- **THEN** the table shows `/Drive/Heading`

### Requirement: Edit with structs with one field

While editing a widget that accepts a struct's only field but not the struct, the field SHALL be shown in the struct's place, labeled with the struct's name.

#### Scenario: Edit a graph's entries

- **GIVEN** the source has `/Arm/State` of type `struct:ArmState`, whose only field is `variant`
- **WHEN** the user starts editing a graph's entries
- **THEN** a `State` row is shown, and checking it binds `/Arm/State/variant`

### Requirement: Keyboard navigation

The entry tree SHALL follow the WAI-ARIA tree view pattern: it MUST be a single tab stop, the arrow keys MUST move between rows and expand or collapse groups, and typing MUST focus the next row whose label starts with the typed text. Keyboard navigation MUST reach rows scrolled out of view. Space MUST NOT pick up a row to drag it or scroll the tree.

#### Scenario: Expand with the keyboard

- **GIVEN** the `Arm` group is focused and collapsed
- **WHEN** the user presses Right Arrow
- **THEN** `Arm` expands

#### Scenario: Jump to the last row

- **GIVEN** the tree has more rows than fit in the panel
- **WHEN** the user presses End
- **THEN** the last row is scrolled into view and focused

#### Scenario: Typeahead

- **WHEN** the user types "v" while `Arm` is expanded and `Arm/Angle` is focused
- **THEN** `Velocity` is focused

#### Scenario: Space outside editing

- **GIVEN** no widget's entries are being edited and `Arm/Angle` is focused
- **WHEN** the user presses Space
- **THEN** nothing happens, the tree keeps its scroll position and `Arm/Angle` stays focused

### Requirement: Search

The entry browser SHALL provide a search box that filters the tree to entries whose names contain the query's characters in order, so abbreviations match and separators like `/`, `_`, `-`, and spaces can be skipped, and MUST highlight the matched characters in each entry's and group's name. Struct entries MUST also match their struct type. Primitive types like `boolean` or `double` MUST NOT match, since nearly every entry has one.

The search box SHALL show its `/` focus shortcut while it's empty and not focused.

Matching groups SHALL start expanded but MUST be collapsible.

#### Scenario: Search entries

- **WHEN** the user types "velocity"
- **THEN** only entries whose names match "velocity" and their parent groups are shown
- **AND** "Velocity" is highlighted in each matching entry

#### Scenario: Collapse a matching group

- **GIVEN** searching for "velocity" expands `Arm` and shows `Arm/Velocity`
- **WHEN** the user collapses `Arm`
- **THEN** `Arm` remains in the results with `Velocity` hidden
- **WHEN** the user reopens `Arm`
- **THEN** `Velocity` is shown again without changing the query

#### Scenario: Change or clear a search after collapsing a matching group

- **GIVEN** the user collapsed `Arm` while searching for "velocity"
- **WHEN** the user changes the search to "angle"
- **THEN** `Arm` starts expanded to show `Arm/Angle`
- **WHEN** the user clears the search
- **THEN** `Arm` returns to the state it had before searching

#### Scenario: Search with an abbreviation

- **GIVEN** the source has `/Swerve/ModuleStates` and `/Swerve/Module1/Current`
- **WHEN** the user types "swmodst"
- **THEN** `/Swerve/ModuleStates` is shown
- **WHEN** the user types "mod1"
- **THEN** `/Swerve/Module1/Current` is shown

#### Scenario: Search ignores separators

- **GIVEN** the source has `/Swerve/ModuleStates` and `/Swerve/module_states`
- **WHEN** the user types "SwerveModuleStates"
- **THEN** both entries are shown

#### Scenario: Search by struct type

- **GIVEN** the source has `/Drive/Pose` of type `struct:Pose2d`
- **WHEN** the user types "Pose2d"
- **THEN** `/Drive/Pose` is shown

### Requirement: Search arrays and structs

Array elements and struct fields SHALL NOT match a search when the query only matched the part of their name that's their array's or struct's name, and that array or struct matched too, so searching for an array doesn't list every element.

#### Scenario: Search for an array

- **GIVEN** the source has `/Drive/ModuleStates` of type `struct:SwerveModuleState[]`
- **WHEN** the user types "modulestates"
- **THEN** `/Drive/ModuleStates` is shown without its modules
- **WHEN** the user types "modulestates 1 speed"
- **THEN** `/Drive/ModuleStates/1/speed` is shown

### Requirement: Collapsible panel

The entry browser SHALL be a collapsible panel on the right side of the dashboard view, toggled by a button or keyboard shortcut, and its open state MUST persist. Users MUST be able to resize it by dragging the divider between it and the panes, and its width MUST persist.

#### Scenario: Toggle and remember

- **WHEN** the user collapses the entry browser and reopens Studio
- **THEN** the entry browser is still collapsed

#### Scenario: Resize the entry browser

- **WHEN** the user drags the divider between the panes and the entry browser
- **THEN** the entry browser's width changes
- **AND** the panes resize to fill the remaining space

#### Scenario: Reset the width

- **WHEN** the user double-clicks the divider between the panes and the entry browser
- **THEN** the entry browser returns to its default width

#### Scenario: Remember the width

- **WHEN** the user resizes the entry browser and reopens Studio
- **THEN** the entry browser has the same width

#### Scenario: Resize the window

- **WHEN** the user resizes the window
- **THEN** the entry browser keeps its width and the panes absorb the change

#### Scenario: Widen past the panes' minimum width

- **GIVEN** the desktop app
- **WHEN** the user drags the entry browser's divider toward the panes
- **THEN** it stops once the panes are at their minimum width (see the dashboards spec)

### Requirement: Drag to bind

Users SHALL be able to drag entries from the entry browser onto widgets to bind them.

#### Scenario: Drag an entry

- **WHEN** the user drags `/Arm/Angle` onto a table
- **THEN** the table binds `/Arm/Angle`

### Requirement: Type indicators

The entry browser SHALL show each entry's type as a compact icon that is visually distinct from its value, and MUST show the full type name in a tooltip.

#### Scenario: Integer entry

- **GIVEN** the source has an `int64` entry
- **THEN** its row shows an integer type icon instead of the text `int64`
- **AND** hovering the icon shows `int64`

#### Scenario: Struct entry

- **GIVEN** the source has a `struct:Pose2d` entry
- **THEN** its row shows a struct type icon
- **AND** hovering the icon shows `Pose2d`

### Requirement: Double-click to add

Double-clicking a bindable entry SHALL add it to the open dashboard using the entry's default widget. If the dashboard already has a widget of that type, the entry MUST be added to it instead of creating a new pane, preferring the focused pane's widget, unless that widget already shows the entry.

#### Scenario: Add to a matching widget

- **GIVEN** the focused pane shows a graph bound to `/Intake/HasGamePiece`
- **WHEN** the user double-clicks the boolean entry `/Arm/AtSetpoint`
- **THEN** the same graph shows both entries
- **AND** no new pane is created

#### Scenario: Already shown

- **GIVEN** the focused pane shows a graph bound to `/Arm/AtSetpoint`
- **WHEN** the user double-clicks `/Arm/AtSetpoint`
- **THEN** the graph still shows it once

#### Scenario: Add to a matching widget that isn't focused

- **GIVEN** the dashboard has a graph and a console, and the console's pane is focused
- **WHEN** the user double-clicks a boolean entry
- **THEN** the entry is added to the graph
- **AND** the graph's pane becomes focused

#### Scenario: Add to a dashboard without a matching widget

- **GIVEN** no pane shows the default widget for `/Arm/Angle`, and the focused pane has a widget
- **WHEN** the user double-clicks `/Arm/Angle`
- **THEN** the focused pane is split and the new pane shows the default widget for `/Arm/Angle`, bound to it

#### Scenario: Add to an empty dashboard

- **GIVEN** the open dashboard has a single empty pane
- **WHEN** the user double-clicks `/console`
- **THEN** the empty pane shows a console widget bound to `/console`

#### Scenario: Unsupported entry

- **WHEN** the user double-clicks an entry marked as unsupported
- **THEN** nothing is added

### Requirement: Known groups

The entry browser SHALL mark groups that a known device or library logs (controllers, Limelights, PhotonVision, Team 581's Spot and Trailblazer, and DogLog's tunable values) with an icon at the end of the group's row, where entries show their values, and MUST show what the group is in a tooltip. Brand logos MUST be drawn in a single color like the other icons.

#### Scenario: Limelight group

- **GIVEN** the source has entries in `/NT:/limelight-front`
- **THEN** the `limelight-front` row shows Limelight's logo at its end
- **AND** hovering the logo shows `Limelight`

#### Scenario: Controller groups

- **GIVEN** the source has WPILib's `/DS:joystick2` or AdvantageKit's `/AdvantageKit/DriverStation/Joystick2` entries
- **THEN** the group's row shows a controller icon, and hovering it shows `Controller 2`

#### Scenario: Team 581's libraries

- **GIVEN** the source has Spot's `/NT:/Spot` entries and Trailblazer's `/Robot/Trailblazer` entries
- **THEN** the `Spot` row shows Spot's logo, and the `Trailblazer` row shows a flame icon

#### Scenario: Tunable values

- **GIVEN** the source has DogLog's tunable values in `/Tunables`, `/NT:/Tunables`, or `/Robot/Tunable` (DogLog releases before 2027)
- **THEN** the group's row shows a sliders icon

### Requirement: Edit a widget's entries

The entry browser SHALL be able to edit one widget's entries, started from the widget's Edit entries button or context menu. While editing, its header MUST name the widget with a button that stops editing, the widget's pane MUST be marked, and its search box MUST be focused. Entries the widget doesn't accept, and groups left empty, MUST be hidden, with a note saying how many are hidden. A collapsed entry browser MUST open while editing and collapse again after.

#### Scenario: Only accepted entries

- **GIVEN** a source with `/Drive/Pose` of type `struct:Pose2d` and `/Arm/Angle` of type `double`
- **WHEN** the user starts editing a field widget's entries
- **THEN** the entry browser shows `/Drive/Pose`
- **AND** `/Arm` and `/Arm/Angle` are hidden

#### Scenario: Collapsed entry browser

- **GIVEN** the entry browser is collapsed
- **WHEN** the user starts editing a widget's entries, then stops
- **THEN** the entry browser opens, then collapses again

### Requirement: Start editing from a widget

Users SHALL also be able to edit a widget's entries by double-clicking its title, or by pressing ⌘E (Ctrl+E on Windows and Linux) to toggle editing the focused widget's entries. Neither MUST do anything for widgets that don't accept entries.

#### Scenario: Double-click the title

- **WHEN** the user double-clicks a graph widget's title
- **THEN** the entry browser edits the graph's entries

#### Scenario: Focused widget shortcut

- **GIVEN** the focused pane has a table
- **WHEN** the user presses ⌘E
- **THEN** the entry browser edits the table's entries
- **AND** pressing ⌘E again stops editing

### Requirement: Toggle entries while editing

While editing a widget's entries, each entry the widget shows SHALL show a checkmark in place of its type indicator, so editing doesn't move the entries' names. Clicking an entry, or pressing Space or Enter on it, MUST bind or unbind it, and unbinding MUST remove every binding of an entry bound more than once. Pressing Enter in the search box MUST toggle the first matching entry, keeping the search. Double-clicking MUST NOT add the entry to the dashboard, and entries MUST still be draggable.

#### Scenario: Bind by clicking

- **GIVEN** the entry browser is editing a table's entries
- **WHEN** the user clicks `/Arm/Angle`
- **THEN** the table shows `/Arm/Angle` and its row shows a checkmark instead of its type
- **WHEN** the user clicks `/Arm/Angle` again
- **THEN** the table stops showing it

#### Scenario: Bind from search

- **GIVEN** the entry browser is editing a console's entries
- **WHEN** the user types "msg" and presses Enter
- **THEN** the console shows the first entry matching "msg"
- **AND** the search stays "msg"

### Requirement: Active entries while editing

While editing a widget's entries, the entry browser SHALL list the entries the widget showed when editing started in an Active section at the top, labeled with their full paths, and MUST keep them in their places in the tree too. Unbinding an entry MUST keep it in the Active section until editing stops or switches widgets. The groups leading to those entries MUST be expanded when editing starts. Entries the widget shows MUST be colored, and groups containing them MUST be marked with a dot.

#### Scenario: Active section

- **GIVEN** a graph bound to `/Arm/Angle`
- **WHEN** the user starts editing the graph's entries
- **THEN** `/Arm/Angle` is listed in the Active section, checked
- **AND** the `Arm` group is expanded, showing `Angle` checked
- **WHEN** the user unbinds `/Arm/Angle`
- **THEN** it stays in the Active section, unchecked

#### Scenario: Collapsed group with an active entry

- **GIVEN** the entry browser is editing a widget that shows `/Arm/Angle`
- **WHEN** the user collapses the `Arm` group
- **THEN** the `Arm` group is marked with a dot

### Requirement: Stop editing

Editing a widget's entries SHALL stop when the user presses Esc, presses the header's stop button, the widget's Edit entries button, or ⌘E, closes the widget's pane, changes it to a widget that doesn't accept entries, or opens another dashboard. Focusing another pane MUST switch to editing its widget's entries, keeping the search, or stop editing if its widget doesn't accept entries.

#### Scenario: Switch widgets

- **GIVEN** the entry browser is editing a table's entries with the search "arm"
- **WHEN** the user clicks a field widget in another pane
- **THEN** the entry browser edits the field's entries, still searching "arm"

#### Scenario: Focus a notepad

- **GIVEN** the entry browser is editing a widget's entries
- **WHEN** the user clicks a notepad
- **THEN** editing stops

### Requirement: Pinned and hidden entries

Users SHALL be able to pin and hide entries and groups. Pinned ones MUST be moved to a Pinned section at the top of the tree, and hidden ones to a collapsed Hidden section kept at the bottom of the entry browser, each labeled with its full path and set apart by a divider. Entries in a pinned or hidden group MUST move with it unless placed themselves. They MUST persist across sources and launches, MUST NOT be part of dashboards, and MUST be included in search.

#### Scenario: Pin an entry

- **WHEN** the user right-clicks `/Arm/Angle` and chooses Pin
- **THEN** `/Arm/Angle` appears in the Pinned section at the top of the tree
- **AND** it no longer appears under the `Arm` group

#### Scenario: Hide a group

- **WHEN** the user right-clicks the `SystemStats` group and chooses Hide
- **THEN** `/SystemStats` and everything in it moves to the collapsed Hidden section at the bottom of the entry browser

#### Scenario: Remember across logs

- **GIVEN** `/Arm/Angle` is pinned
- **WHEN** the user opens another log with `/Arm/Angle`
- **THEN** `/Arm/Angle` is in the Pinned section

### Requirement: Drag to pin and hide

Users SHALL be able to drag entries and groups between the Pinned section, the Hidden section, and the rest of the tree to pin, hide, or restore them. Empty sections MUST NOT be shown, except while a row is being dragged so it can be dropped there.

#### Scenario: Unhide by dragging

- **GIVEN** `/SystemStats` is hidden
- **WHEN** the user drags it from the Hidden section onto a row outside the Pinned and Hidden sections
- **THEN** `/SystemStats` is shown in the tree again

#### Scenario: Pin by dragging

- **GIVEN** nothing is pinned
- **WHEN** the user starts dragging `/Arm/Angle`
- **THEN** an empty Pinned section appears at the top of the tree
- **WHEN** the user drops it on the Pinned section
- **THEN** `/Arm/Angle` is pinned

#### Scenario: Empty sections

- **GIVEN** nothing is pinned or hidden
- **THEN** neither the Pinned nor the Hidden section is shown

### Requirement: Entry context menu

Right-clicking an entry SHALL open a context menu with Add to dashboard, Copy name, Copy value, and actions to pin or unpin and hide or unhide it. Right-clicking a group SHALL open a context menu with the pin and hide actions.

#### Scenario: Copy name

- **WHEN** the user right-clicks `/Arm/Angle` and chooses Copy name
- **THEN** `/Arm/Angle` is copied to the clipboard

#### Scenario: Copy value

- **WHEN** the user right-clicks an entry and chooses Copy value
- **THEN** its value at the cursor is copied to the clipboard as JSON, except plain strings which are copied without quotes

#### Scenario: Add to dashboard

- **WHEN** the user right-clicks a bindable entry and chooses Add to dashboard
- **THEN** it is added the same way as double-clicking it
