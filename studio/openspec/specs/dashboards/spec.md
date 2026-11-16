# dashboards Specification

## Purpose

Define how users create, arrange, reorder, and delete dashboards, which are source-agnostic layouts of widget panes that persist locally on the device.

## Requirements

### Requirement: Source-agnostic dashboards

Dashboards SHALL reference data only by entry name, so the same dashboard works with any data source.

#### Scenario: Same dashboard live and replayed

- **GIVEN** a dashboard built while connected to a robot
- **WHEN** the user opens a log from that robot
- **THEN** the dashboard's widgets show the matching entries from the log

### Requirement: Create a dashboard

Users SHALL be able to create a new, empty dashboard from the sidebar. New dashboards MUST be auto-named and added to the top of the dashboard list.

#### Scenario: New dashboard

- **WHEN** the user presses New dashboard
- **THEN** an empty, auto-named dashboard is added to the top of the list
- **AND** it is opened

### Requirement: Rename a dashboard

Users SHALL be able to rename a dashboard inline in the sidebar.

#### Scenario: Inline rename

- **WHEN** the user renames a dashboard to "Arm tuning"
- **THEN** the sidebar shows "Arm tuning"

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

### Requirement: Delete a dashboard

Closing a dashboard SHALL permanently delete it. Studio MUST ask for confirmation first, unless the dashboard has no widgets.

#### Scenario: Confirmed close

- **WHEN** the user closes a dashboard and confirms
- **THEN** the dashboard is permanently deleted

#### Scenario: Cancelled close

- **WHEN** the user closes a dashboard and cancels the confirmation
- **THEN** the dashboard is unchanged

#### Scenario: Close an empty dashboard

- **GIVEN** a dashboard with no widgets
- **WHEN** the user closes it
- **THEN** it is deleted without a confirmation

#### Scenario: Close the selected dashboard

- **GIVEN** the selected dashboard is not the only dashboard
- **WHEN** the user closes it
- **THEN** the dashboard below it in the sidebar is selected, or the one above it if it was last

### Requirement: Close several dashboards

Like browser tabs, a dashboard's menus SHALL offer to close every other dashboard, or every dashboard below it in the sidebar. These follow the same confirmation rule as closing one dashboard: Studio MUST ask once if any of them have widgets. Each option MUST be disabled when there's nothing for it to close.

#### Scenario: Close other dashboards

- **WHEN** the user chooses Close other dashboards on a dashboard and confirms
- **THEN** every other dashboard is permanently deleted
- **AND** the remaining dashboard is selected

#### Scenario: Close dashboards below

- **WHEN** the user chooses Close dashboards below on a dashboard and confirms
- **THEN** every dashboard below it in the sidebar is permanently deleted
- **AND** if the selected dashboard was deleted, that dashboard is selected

#### Scenario: Last dashboard in the list

- **GIVEN** a dashboard at the bottom of the sidebar
- **WHEN** the user opens its menu
- **THEN** Close dashboards below is disabled

#### Scenario: Only dashboard

- **GIVEN** a single dashboard
- **WHEN** the user opens its menu
- **THEN** Close other dashboards is disabled

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

- **GIVEN** the user has deleted every dashboard
- **THEN** the main area shows a New dashboard prompt

### Requirement: Local persistence

Every dashboard change MUST be saved on the device immediately, so dashboards survive reloads, restarts, and crashes.

#### Scenario: Survive a crash

- **GIVEN** the user split a pane and bound a widget
- **WHEN** the app crashes and is reopened
- **THEN** the dashboard has the split pane and binding

### Requirement: Dashboard context menu

Right-clicking a dashboard in the sidebar SHALL open a context menu with Rename and Delete.

#### Scenario: Delete from the context menu

- **WHEN** the user right-clicks a dashboard and chooses Delete
- **THEN** it is closed the same way as any other dashboard close, including the confirmation rules

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
