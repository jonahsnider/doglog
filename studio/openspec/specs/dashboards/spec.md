# dashboards Specification

## Purpose

Define how users create, arrange, reorder, and close dashboards, which are source-agnostic layouts of widget panes that persist locally on the device.

## Requirements

### Requirement: Source-agnostic dashboards

Dashboards SHALL reference data only by entry name, so the same dashboard works with any data source.

#### Scenario: Same dashboard live and replayed

- **GIVEN** a dashboard built while connected to a robot
- **WHEN** the user opens a log from that robot
- **THEN** the dashboard's widgets show the matching entries from the log

### Requirement: Create a dashboard

Users SHALL be able to create a new, empty dashboard from the sidebar. New dashboards MUST be added to the top of the dashboard list.

#### Scenario: New dashboard

- **WHEN** the user presses New dashboard
- **THEN** an empty dashboard is added to the top of the list
- **AND** it is opened

### Requirement: Suggested names

A dashboard the user hasn't named SHALL be named after its contents, updating as they change. Each widget MUST contribute the first path segment of its entries, skipping the `/Robot`, `/RealOutputs`, `/AdvantageKit`, and `/AdvantageKit/RealOutputs` prefixes and capitalizing the first letter. A widget without entries, or with only its widget type's default entries, MUST contribute its widget type's name instead. Past three names, the rest MUST be counted.

#### Scenario: Name from entries

- **GIVEN** a dashboard the user hasn't named
- **WHEN** it shows `/Robot/Localization/Pose` and `/Robot/Intake/Speed`
- **THEN** it's named "Localization & Intake"

#### Scenario: Many topics

- **GIVEN** a dashboard the user hasn't named
- **WHEN** it shows entries from Swerve, Drive, Shooter, and Vision
- **THEN** it's named "Swerve, Drive & 2 more"

#### Scenario: Empty dashboard name

- **GIVEN** a dashboard the user hasn't named
- **WHEN** it has no widgets
- **THEN** it's named "Empty dashboard"

#### Scenario: Default console

- **GIVEN** a dashboard the user hasn't named
- **WHEN** it only has a console showing `/console` and `/messages`
- **THEN** it's named "Console"

#### Scenario: Named dashboards keep their name

- **GIVEN** a dashboard the user renamed to "Arm tuning"
- **WHEN** a widget is added to it
- **THEN** it's still named "Arm tuning"

### Requirement: Dashboard icons

A dashboard's icon in the sidebar SHALL be the icon of the widget in its biggest pane, the first one in layout order on ties. Empty panes MUST be ignored. A dashboard without widgets MUST show a generic dashboard icon.

#### Scenario: Icon follows contents

- **GIVEN** a dashboard with a console taking up most of it and two smaller values tables
- **THEN** its sidebar icon is the console's icon

### Requirement: Rename a dashboard

Users SHALL be able to rename a dashboard inline in the sidebar. The name field MUST show the suggested name as a placeholder, and a blank name MUST go back to the suggested name.

#### Scenario: Inline rename

- **WHEN** the user renames a dashboard to "Arm tuning"
- **THEN** the sidebar shows "Arm tuning"

#### Scenario: Clear a name

- **GIVEN** a dashboard the user renamed
- **WHEN** the user renames it to a blank name
- **THEN** it's named after its contents again

#### Scenario: Double-click to rename

- **WHEN** the user double-clicks a dashboard in the sidebar
- **THEN** its name becomes editable in place

### Requirement: Preview a dashboard

Hovering a dashboard in the sidebar SHALL show a miniature of its pane layout, with each pane showing its widget's icon. The selected dashboard MUST NOT show a preview, since it's already on screen. A dashboard whose layout is a single empty pane MUST NOT show a preview.

#### Scenario: Hover another dashboard

- **WHEN** the user hovers a dashboard that isn't selected
- **THEN** a miniature of its pane layout is shown next to it

#### Scenario: Hover the selected dashboard

- **WHEN** the user hovers the selected dashboard
- **THEN** no preview is shown

#### Scenario: Hover an empty dashboard

- **GIVEN** a dashboard whose only pane is empty
- **WHEN** the user hovers it
- **THEN** no preview is shown

### Requirement: Reorder dashboards

Users SHALL be able to reorder dashboards in the sidebar by dragging them.

#### Scenario: Drag to reorder

- **WHEN** the user drags a dashboard above another
- **THEN** the list order updates and is persisted

### Requirement: Close a dashboard

Closing a dashboard SHALL remove it from the sidebar without asking for confirmation, since it can be reopened.

#### Scenario: Close a dashboard

- **WHEN** the user closes a dashboard
- **THEN** it is removed from the sidebar

#### Scenario: Close the selected dashboard

- **GIVEN** the selected dashboard is not the only dashboard
- **WHEN** the user closes it
- **THEN** the dashboard below it in the sidebar is selected, or the one above it if it was last

### Requirement: Close several dashboards

Like browser tabs, a dashboard's menus SHALL offer to close every other dashboard, or every dashboard below it in the sidebar. Each option MUST be disabled when there's nothing for it to close. Like Dia, hovering the separator above the dashboards in the sidebar SHALL reveal a button to close every dashboard, hidden when there are none.

#### Scenario: Close other dashboards

- **WHEN** the user chooses Close other dashboards on a dashboard
- **THEN** every other dashboard is closed
- **AND** the remaining dashboard is selected

#### Scenario: Close dashboards below

- **WHEN** the user chooses Close dashboards below on a dashboard
- **THEN** every dashboard below it in the sidebar is closed
- **AND** if the selected dashboard was closed, that dashboard is selected

#### Scenario: Close all dashboards

- **WHEN** the user hovers the separator above the dashboards in the expanded sidebar and chooses Close all
- **THEN** every dashboard is closed together
- **AND** the main area shows a New dashboard prompt

#### Scenario: Last dashboard in the list

- **GIVEN** a dashboard at the bottom of the sidebar
- **WHEN** the user opens its menu
- **THEN** Close dashboards below is disabled

#### Scenario: Only dashboard

- **GIVEN** a single dashboard
- **WHEN** the user opens its menu
- **THEN** Close other dashboards is disabled

### Requirement: Reopen closed dashboards

Like browser tabs, users SHALL be able to reopen the most recently closed dashboards, back to where they were in the sidebar. Dashboards closed together MUST reopen together. Closed dashboards MUST be remembered on the device, up to the last 25 closes.

#### Scenario: Reopen a dashboard

- **GIVEN** the user closed the second dashboard in the sidebar
- **WHEN** the user reopens closed dashboards
- **THEN** it is the second dashboard again
- **AND** it is selected

#### Scenario: Reopen dashboards closed together

- **GIVEN** the user chose Close dashboards below
- **WHEN** the user reopens closed dashboards
- **THEN** every dashboard that was below it is back

#### Scenario: Reopen after a restart

- **GIVEN** the user closed a dashboard and restarted Studio
- **WHEN** the user reopens closed dashboards
- **THEN** the dashboard is back

### Requirement: Undo and redo

Users SHALL be able to undo and redo changes to the current dashboard, including its panes, widgets, divider positions, and name. Each dashboard MUST have its own history, kept until Studio is closed, including while the dashboard is closed. Undoing a change MUST also restore which pane was focused before it. Focusing a pane MUST NOT be a change of its own.

#### Scenario: Undo closing a pane

- **GIVEN** a dashboard with two panes
- **WHEN** the user closes a pane and then undoes
- **THEN** the pane is back with its widget, and focused

#### Scenario: Redo

- **GIVEN** the user undid splitting a pane
- **WHEN** the user redoes
- **THEN** the pane is split again

#### Scenario: Histories are per dashboard

- **GIVEN** the user changed dashboard A and then switched to dashboard B
- **WHEN** the user undoes
- **THEN** only dashboard B's changes are undone

#### Scenario: Undo in a reopened dashboard

- **GIVEN** the user removed every pane from a dashboard and then closed it
- **WHEN** the user reopens it and undoes
- **THEN** its last removed pane is back

### Requirement: Pane layout

A dashboard SHALL be a layout of panes, each holding exactly one widget. Users MUST be able to split panes horizontally or vertically, resize them, and close them.

#### Scenario: First widget fills the dashboard

- **GIVEN** an empty dashboard
- **WHEN** the user adds a widget
- **THEN** the widget fills the whole dashboard area

#### Scenario: Split a pane

- **WHEN** the user splits a pane vertically
- **THEN** the pane is divided into two side-by-side panes
- **AND** the divider between them can be dragged to resize

#### Scenario: Reset a divider

- **WHEN** the user double-clicks the divider between two panes
- **THEN** the panes return to equal sizes

#### Scenario: Close a pane

- **WHEN** the user closes one of two panes
- **THEN** the remaining pane expands to fill the space

### Requirement: Empty states

Studio SHALL guide users from empty states to a usable dashboard.

#### Scenario: First launch

- **WHEN** a user opens Studio for the first time
- **THEN** one empty dashboard is created and opened

#### Scenario: Empty pane

- **GIVEN** a pane with no widget
- **THEN** it shows an Add widget prompt with a two-column grid of tiles, one per widget type
- **AND** clicking a tile adds that widget to the pane

#### Scenario: Double-click an empty pane

- **GIVEN** a pane with no widget
- **WHEN** the user double-clicks the pane outside the widget tiles
- **THEN** an empty discrete timeline is added to the pane

#### Scenario: No dashboards

- **GIVEN** the user has closed every dashboard
- **THEN** the main area shows a New dashboard prompt

### Requirement: Local persistence

Every dashboard change MUST be saved on the device immediately, so dashboards survive reloads, restarts, and crashes.

#### Scenario: Survive a crash

- **GIVEN** the user split a pane and bound a widget
- **WHEN** the app crashes and is reopened
- **THEN** the dashboard has the split pane and binding

### Requirement: Shared across windows

Dashboards and closed dashboards MUST be shared by every open Studio tab or window on the device. A change in one MUST appear in the others immediately, without overwriting changes made elsewhere.

#### Scenario: Edit in another tab

- **GIVEN** Studio is open in two tabs
- **WHEN** the user renames a dashboard in one tab and splits a pane in the other
- **THEN** both tabs show the renamed dashboard with the split pane

### Requirement: Dashboard context menu

Right-clicking a dashboard in the sidebar SHALL open a context menu with Rename, Close dashboard, Close other dashboards, and Close dashboards below.

#### Scenario: Close from the context menu

- **WHEN** the user right-clicks a dashboard and chooses Close dashboard
- **THEN** it is closed the same way as any other dashboard close

### Requirement: Focused pane

The pane the user last clicked or interacted with SHALL be the focused pane, and it MUST be visually indicated.

#### Scenario: Focus follows interaction

- **GIVEN** a dashboard with two panes
- **WHEN** the user clicks inside the second pane
- **THEN** the second pane is shown as focused

### Requirement: Pane context menu

Right-clicking a pane SHALL open a context menu with Split right, Split down, Change widget, Widget options, and Close.

#### Scenario: Split from the context menu

- **WHEN** the user right-clicks a pane and chooses Split right
- **THEN** the pane is split into two side-by-side panes

#### Scenario: Change widget

- **WHEN** the user right-clicks a pane with a console and chooses Change widget
- **THEN** the user can pick a different widget type for that pane
