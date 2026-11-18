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

A dashboard the user hasn't named SHALL be named after its contents, updating as they change. Each widget MUST contribute the first path segment of its entries, skipping the `/Robot`, `/RealOutputs`, `/AdvantageKit`, and `/AdvantageKit/RealOutputs` prefixes and capitalizing the first letter. A widget without entries, or with only its widget type's default entries, MUST contribute its pane header's name instead, ex. "Console" or "Controller 1". Past three names, the rest MUST be counted.

#### Scenario: Name from entries

- **GIVEN** a dashboard the user hasn't named
- **WHEN** it shows `/Robot/Localization/Pose` and `/Robot/Intake/Speed`
- **THEN** it's named "Localization & Intake"

#### Scenario: Many topics

- **GIVEN** a dashboard the user hasn't named
- **WHEN** it shows entries from Swerve, Drive, Shooter, and Vision
- **THEN** it's named "Swerve, Drive, & 2 more"

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

Users SHALL be able to rename a dashboard inline in the sidebar. The name field MUST start with the dashboard's current name selected, and MUST show the suggested name as a placeholder when cleared. A blank name MUST go back to the suggested name, and keeping a suggested name unchanged MUST leave it following the dashboard's contents.

#### Scenario: Current name is prefilled

- **WHEN** the user starts renaming a dashboard
- **THEN** the name field contains its current name, all selected
- **AND** the dashboard's icon and name stay where they were

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

Users SHALL be able to reorder dashboards in the sidebar by dragging them. Dashboards MUST NOT show tooltips or previews while anything is being dragged.

#### Scenario: Drag to reorder

- **WHEN** the user drags a dashboard above another
- **THEN** the list order updates and is persisted

### Requirement: Combine dashboards

Like Dia's split view, dragging a dashboard from the sidebar over the open dashboard SHALL show Add left split and Add right split zones. Dropping it on a zone MUST put its panes beside the open dashboard's panes on that side, each taking half the width, and close the dragged dashboard. The zones MUST be disabled when the combined dashboard would have panes narrower than a quarter of it. Dragging the open dashboard MUST NOT show the zones.

#### Scenario: Add a right split

- **GIVEN** dashboard A is open
- **WHEN** the user drags dashboard B from the sidebar onto Add right split
- **THEN** A shows its panes on the left and B's panes on the right
- **AND** B is closed

#### Scenario: Too many side by side panes

- **GIVEN** the open dashboard already has three panes side by side
- **WHEN** the user drags another dashboard over it
- **THEN** the zones are shown disabled, and dropping on them does nothing

### Requirement: Select several dashboards

⌘ or Ctrl-clicking a dashboard in the sidebar SHALL add it to or remove it from a selection that starts with the open dashboard, and Shift-clicking SHALL select every dashboard between it and the last ⌘ or Ctrl-clicked dashboard, or the open dashboard. Selecting MUST NOT open the dashboard. Clicking a dashboard or the empty space below the dashboards, or pressing Escape, SHALL clear the selection.

#### Scenario: Shift-click a range

- **GIVEN** the first dashboard is open
- **WHEN** the user Shift-clicks the third dashboard
- **THEN** the first three dashboards are selected, and the first is still open

### Requirement: Act on selected dashboards

While two or more dashboards are selected, the menus of selected dashboards SHALL offer Open as split, Duplicate dashboards, and Close dashboards for the whole selection.

#### Scenario: Open as split

- **GIVEN** dashboards A, B, and C are selected, in that order in the sidebar
- **WHEN** the user chooses Open as split
- **THEN** A shows its panes, B's panes, and C's panes side by side, each taking a third of the width
- **AND** B and C are closed together, and A is opened

#### Scenario: Too many side by side panes to split

- **GIVEN** the selected dashboards would have panes narrower than a quarter of the combined dashboard
- **WHEN** the user opens a selected dashboard's menu
- **THEN** Open as split is disabled

#### Scenario: Close the selection

- **GIVEN** three dashboards are selected
- **WHEN** the user chooses Close 3 dashboards
- **THEN** they're closed together, and reopen together

### Requirement: Duplicate dashboards

Users SHALL be able to duplicate a dashboard, or every selected dashboard, from their menus. Each copy MUST go right below its original with the same name and panes, and the first copy MUST be opened. Copies MUST be able to be combined with their originals.

#### Scenario: Duplicate a dashboard

- **WHEN** the user chooses Duplicate on the second dashboard
- **THEN** a copy of it is the third dashboard, and is opened

### Requirement: Move panes

Like Rex, users SHALL be able to drag a pane by its title, which shows a move icon and a background while hovered, empty panes included, and drop it on the half of another pane nearest the pointer. That half MUST be highlighted, moving between sides without animating. The dragged pane MUST go on that side, each taking half the space, and its sibling MUST take its old space. Sides where panes would end up too small MUST be shown as unavailable.

#### Scenario: Not enough room

- **GIVEN** a dashboard with four panes side by side
- **WHEN** the user drags one onto the left half of another
- **THEN** the half is shown as unavailable, and dropping there does nothing

#### Scenario: Move a pane beside another

- **GIVEN** a dashboard with a values table on the left and a console above a swerve on the right
- **WHEN** the user drags the swerve's title onto the top half of the values table
- **THEN** the swerve is above the values table, and the console fills the right side

### Requirement: Other panes stay still while moving a pane

Other panes MUST NOT scroll or react to hovering while a pane is moved.

#### Scenario: Drag past a scrollable pane

- **GIVEN** a dashboard with two consoles
- **WHEN** the user drags one console near the bottom edge of the other
- **THEN** the other console doesn't scroll

### Requirement: Move a pane to a new dashboard

Dropping a pane on the sidebar's dashboards SHALL move it into a new dashboard. Dropping a dashboard's only pane there SHALL move the dashboard instead. A placeholder MUST show where the new dashboard will be added, following the pointer between dashboards.

#### Scenario: Split a pane into a new dashboard

- **GIVEN** a dashboard with two panes
- **WHEN** the user drags one pane's title between the first and second dashboards in the sidebar
- **THEN** a new dashboard with that pane is added between them
- **AND** the other pane fills the original dashboard

#### Scenario: Move a dashboard by its only pane

- **GIVEN** a dashboard with a single pane
- **WHEN** the user drags the pane's title between two other dashboards in the sidebar
- **THEN** the dashboard moves there

### Requirement: Close a dashboard

Closing a dashboard SHALL remove it from the sidebar without asking for confirmation, since it can be reopened. Closing a shared dashboard deletes it for everyone (see the shared-dashboards spec). Like browser tabs, middle-clicking a dashboard in the sidebar SHALL close it.

#### Scenario: Close a dashboard

- **WHEN** the user closes a dashboard
- **THEN** it is removed from the sidebar

#### Scenario: Close the selected dashboard

- **GIVEN** the selected dashboard is not the only dashboard
- **WHEN** the user closes it
- **THEN** the dashboard below it in the sidebar is selected, or the one above it if it was last

#### Scenario: Close a new dashboard right away

- **GIVEN** the user opened a new dashboard from Settings
- **WHEN** the user closes it without selecting anything else first
- **THEN** Settings is shown again, like closing a browser tab returns to the tab that opened it
- **AND** if the user came from a dashboard that's since been closed, the neighboring dashboard is selected instead

### Requirement: Close several dashboards

Like browser tabs, a dashboard's menus SHALL offer to close every other dashboard, or every dashboard below it in the sidebar. Each option MUST be disabled when there's nothing for it to close. Like Dia, hovering the Dashboards label in the sidebar SHALL reveal a button to close every dashboard, hidden when there are none.

#### Scenario: Close other dashboards

- **WHEN** the user chooses Close other dashboards on a dashboard
- **THEN** every other dashboard is closed
- **AND** the remaining dashboard is selected

#### Scenario: Close dashboards below

- **WHEN** the user chooses Close dashboards below on a dashboard
- **THEN** every dashboard below it in the sidebar is closed
- **AND** if the selected dashboard was closed, that dashboard is selected

#### Scenario: Close all dashboards

- **WHEN** the user hovers the Dashboards label in the expanded sidebar and chooses Close all
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

Users SHALL be able to undo and redo changes to the current dashboard, including its panes, widgets, divider positions, and name. Each dashboard MUST have its own history, kept until the tab or window is closed, including while the dashboard is closed. Like undo in collaborative editors, each tab or window MUST only undo its own changes, never changes made in another one. Undoing a change MUST also restore which pane was focused before it. Focusing a pane MUST NOT be a change of its own.

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

#### Scenario: Undo in another tab

- **GIVEN** Studio is open in two tabs
- **WHEN** the user splits a pane in one tab and undoes in the other
- **THEN** the split is kept in both tabs

### Requirement: Edit in several tabs

Dashboards SHALL stay the same in every open Studio tab and window. Changes made to a dashboard in several tabs at once MUST all be kept.

#### Scenario: Edit in two tabs at once

- **GIVEN** Studio is open in two tabs
- **WHEN** the user adds a widget to a pane in one tab while renaming the dashboard in the other
- **THEN** both tabs show the renamed dashboard with the new widget

### Requirement: Pane layout

A dashboard SHALL be a layout of panes, each holding exactly one widget. Users MUST be able to split panes horizontally or vertically, resize them, and close them. Resizing MUST NOT make a pane narrower or shorter than a quarter of the dashboard, or than 200 by 120 pixels unless the dashboard is too small for each pane to be that size.

#### Scenario: First widget fills the dashboard

- **GIVEN** an empty dashboard
- **WHEN** the user adds a widget
- **THEN** the widget fills the whole dashboard area

#### Scenario: Split a pane

- **WHEN** the user splits a pane vertically
- **THEN** the pane is divided into two side-by-side panes
- **AND** the divider between them can be dragged to resize

#### Scenario: Animate splitting and closing panes

- **WHEN** the user splits a pane right
- **THEN** the new pane grows in from the right edge as the divider slides to the middle
- **AND** a closed pane shrinks away as the remaining pane expands into its space
- **AND** the remaining pane's content takes its new size right away instead of resizing as the divider moves
- **AND** panes appear and disappear instantly when the system is set to reduce motion

#### Scenario: Resize a pane holding a split

- **GIVEN** a pane split into two columns, beside another pane
- **WHEN** the user drags the divider to shrink the split pane
- **THEN** it stops once each column is a quarter of the dashboard's width

#### Scenario: Resize a pane in a narrow dashboard

- **GIVEN** a dashboard 600 pixels wide with two panes side by side
- **WHEN** the user drags the divider between them
- **THEN** it stops once a pane is 200 pixels wide

#### Scenario: Divider that can't move

- **GIVEN** a dashboard with four panes side by side
- **WHEN** the user hovers a divider between them
- **THEN** it isn't highlighted and doesn't show a resize cursor

#### Scenario: Close a pane

- **WHEN** the user closes one of two panes
- **THEN** the remaining pane expands to fill the space

#### Scenario: Middle-click a pane header

- **WHEN** the user middle-clicks the header of one of two panes
- **THEN** that pane is closed

### Requirement: Pane sizes

Like Rex, splitting a pane in the same direction as the panes beside it SHALL add a pane to that row or column rather than splitting the pane in two. Panes the user hasn't resized MUST share their row or column's space evenly, while resized panes keep their size, and splitting a resized pane MUST share its size with the new pane. Releasing a divider close to where it would be with the panes beside it sharing their space evenly MUST snap it there.

#### Scenario: Split a pane again

- **GIVEN** a dashboard with one pane
- **WHEN** the user presses ⌘D three times
- **THEN** the dashboard has four equal panes side by side

#### Scenario: Split a resized pane

- **GIVEN** two panes side by side, resized to 40% and 60% of the dashboard's width
- **WHEN** the user splits the right pane right
- **THEN** the panes are 40%, 30%, and 30% of the width

#### Scenario: Snap a divider

- **GIVEN** two panes side by side
- **WHEN** the user drags the divider between them and releases it a few pixels from the middle
- **THEN** it snaps to the middle, and the panes share their space evenly again

#### Scenario: Reset a divider

- **WHEN** the user double-clicks the divider between two panes
- **THEN** the two panes share their space evenly again

### Requirement: Zoom pane

Like Rex, users SHALL be able to zoom a pane so it fills the dashboard, hiding the other panes until it's restored. Zooming MUST slide the other panes off the dashboard, away from the zoomed pane, and restoring MUST slide them back. Panes on the same side of the zoomed pane MUST move together, however the dashboard is split. Splitting or closing any pane MUST restore the other panes. Zooming MUST NOT be an undo step, and a dashboard MUST stay zoomed when it's reopened.

#### Scenario: Zoom a pane

- **GIVEN** a dashboard with two panes
- **WHEN** the user presses Zoom pane in the first pane's header
- **THEN** the second pane slides away, uncovering the first pane, which already fills the dashboard
- **AND** its header only shows its widget's buttons, a highlighted Restore pane button, and close

#### Scenario: Restore a zoomed pane

- **GIVEN** a zoomed pane
- **WHEN** the user presses Restore pane or ⇧⌘↩
- **THEN** the other panes slide back in to their previous sizes
- **AND** the restored pane takes its previous size right away

#### Scenario: Restore the right-most of four panes

- **GIVEN** four panes side by side, the right-most one zoomed
- **WHEN** the user restores it
- **THEN** the other three panes slide in from the left together

#### Scenario: Only pane

- **GIVEN** a dashboard with one pane
- **THEN** Zoom pane is disabled

#### Scenario: Split a zoomed pane

- **GIVEN** a zoomed pane
- **WHEN** the user presses ⇧⌘D
- **THEN** the other panes are restored and the pane splits down

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
- **THEN** an empty graph is added to the pane

#### Scenario: Add a widget with its key

- **GIVEN** the focused pane has no widget
- **WHEN** the user presses `S`
- **THEN** a swerve widget is added to the pane
- **AND** each widget tile shows its key: `V` for values table, `C` for console, `D` for discrete timeline, `S` for swerve, and `F` for field

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

Right-clicking a dashboard in the sidebar SHALL open a context menu with Rename, Duplicate, Close dashboard, Close other dashboards, and Close dashboards below. A dashboard selected along with others SHALL show the selection's menu instead.

#### Scenario: Close from the context menu

- **WHEN** the user right-clicks a dashboard and chooses Close dashboard
- **THEN** it is closed the same way as any other dashboard close

### Requirement: Focused pane

The pane the user last clicked or interacted with SHALL be the focused pane. The focused pane MUST NOT be outlined; showing its header controls is the only indication.

#### Scenario: Focus follows interaction

- **GIVEN** a dashboard with two panes
- **WHEN** the user clicks inside the second pane
- **THEN** the second pane becomes focused and its header buttons stay shown

### Requirement: Pane header controls

A pane's header buttons, like Edit entries, split, and close, SHALL only be shown while the pane is hovered or focused.

#### Scenario: Unfocused pane

- **GIVEN** a dashboard with two panes, the first focused
- **WHEN** the user isn't hovering the second pane
- **THEN** the second pane's header buttons are hidden, and the first pane's are shown

#### Scenario: Hover an unfocused pane

- **GIVEN** a dashboard with two panes, the first focused
- **WHEN** the user hovers the second pane
- **THEN** the second pane's header buttons are shown

### Requirement: Pane context menu

Right-clicking a pane SHALL open a context menu with Split right, Split down, Zoom pane (Restore pane while zoomed), Change widget (Add widget in an empty pane), Edit entries, and Close.

#### Scenario: Split from the context menu

- **WHEN** the user right-clicks a pane and chooses Split right
- **THEN** the pane is split into two side-by-side panes

#### Scenario: Change widget

- **WHEN** the user right-clicks a pane with a console and chooses Change widget
- **THEN** the user can pick a different widget type for that pane

#### Scenario: Add widget from the context menu

- **WHEN** the user right-clicks an empty pane and chooses Add widget, then Graph
- **THEN** the pane shows a graph

#### Scenario: Change widget with its key

- **GIVEN** the user opened a pane's context menu and Change widget is expanded
- **WHEN** the user presses `S`
- **THEN** the pane's widget changes to swerve and the menu closes
- **AND** each widget type in Change widget shows its key, the same keys as the Add widget tiles
