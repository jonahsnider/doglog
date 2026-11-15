# widget-line-graph Specification

## Purpose

Define the line graph widget, which plots one or more numeric entries over time with a cursor line, configurable time windows, x-axis zoom, and optional sync with other graphs.

## Requirements

### Requirement: Numeric series

The line graph SHALL accept numeric entries and plot each bound entry as a separate series over time.

#### Scenario: Multiple series

- **WHEN** the user binds `/Drive/LeftVelocity` and `/Drive/RightVelocity`
- **THEN** both are plotted as distinct series with a legend

### Requirement: Cursor line and seeking

The line graph SHALL draw the global cursor as a vertical line, show a hover marker with values, and MUST move the cursor when the user clicks on the graph.

#### Scenario: Hover

- **WHEN** the user hovers over the graph
- **THEN** a marker shows each series' value at that time

#### Scenario: Click to seek

- **WHEN** the user clicks at 12 s on the graph
- **THEN** the global cursor moves to 12 s

### Requirement: Time window

The line graph SHALL show the full range by default for log sources and the last 30 seconds for live sources, and MUST offer sliding and fixed window options.

#### Scenario: Live default

- **GIVEN** a live source is active
- **THEN** a new graph shows the last 30 seconds and scrolls as data arrives

#### Scenario: Fixed window

- **WHEN** the user sets a fixed window from 10 s to 20 s
- **THEN** the graph shows only that range

### Requirement: Zoom and pan

Zooming SHALL affect only the x-axis by default, with a modifier key for the y-axis, and users MUST be able to reset the view by double-clicking or pressing `r`.

#### Scenario: Reset view

- **GIVEN** the user has zoomed in
- **WHEN** the user double-clicks the graph
- **THEN** the graph returns to its configured time window

### Requirement: Sync with other graphs

Each line graph SHALL have a "sync with other graphs" option, off by default, that keeps its x-axis range matched with other synced graphs.

#### Scenario: Synced zoom

- **GIVEN** two graphs with sync enabled
- **WHEN** the user zooms one graph
- **THEN** the other graph shows the same x-axis range
