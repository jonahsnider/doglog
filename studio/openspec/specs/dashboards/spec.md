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

### Requirement: Reorder dashboards

Users SHALL be able to reorder dashboards in the sidebar by dragging them.

#### Scenario: Drag to reorder

- **WHEN** the user drags a dashboard above another
- **THEN** the list order updates and is persisted

### Requirement: Delete a dashboard

Closing a dashboard SHALL permanently delete it, and Studio MUST ask for confirmation first.

#### Scenario: Confirmed close

- **WHEN** the user closes a dashboard and confirms
- **THEN** the dashboard is permanently deleted

#### Scenario: Cancelled close

- **WHEN** the user closes a dashboard and cancels the confirmation
- **THEN** the dashboard is unchanged

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
- **THEN** it shows an Add widget prompt

#### Scenario: No dashboards

- **GIVEN** the user has deleted every dashboard
- **THEN** the main area shows a New dashboard prompt

### Requirement: Local persistence

Every dashboard change MUST be saved on the device immediately, so dashboards survive reloads, restarts, and crashes.

#### Scenario: Survive a crash

- **GIVEN** the user split a pane and bound a widget
- **WHEN** the app crashes and is reopened
- **THEN** the dashboard has the split pane and binding
