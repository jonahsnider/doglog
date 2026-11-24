# widget-graph Specification

## Purpose

Define the graph widget, which plots numeric entries as lines and shows boolean, string, and other discrete entries as colored bands, all over one shared time axis.

## Requirements

### Requirement: Sections

The graph SHALL accept numeric, boolean, and string entries and show each in one of three sections, picked as its role: the left axis, the right axis, or the discrete bands. Numeric entries MUST default to the left axis, or to the right axis when their unit's measure differs from the left axis's. Boolean and string entries MUST only be shown as discrete bands, and numeric entries MAY be moved to any section.

#### Scenario: Mixed entries

- **WHEN** the user binds `/Drive/LeftVelocity`, `/Drive/RightVelocity`, and `/Intake/HasGamePiece`
- **THEN** both velocities are plotted as lines on the left axis
- **AND** `/Intake/HasGamePiece` is shown as a row of bands

#### Scenario: Different measures

- **GIVEN** the graph shows `/Drive/VelocityMetersPerSec` on the left axis
- **WHEN** the user binds `/Drive/CurrentAmps`
- **THEN** `/Drive/CurrentAmps` is plotted on the right axis

### Requirement: Move entries between sections

Users SHALL be able to move an entry to another section by dragging it there, or from its context menu. Like splitting a pane, dragging one of the graph's entries, or another entry over the graph, MUST cover the graph with labeled zones for the sections the entry fits in: the left and right halves for the axes, and the bands at the bottom.

#### Scenario: Drag to the right axis

- **GIVEN** the graph shows `/Drive/Velocity` and `/Drive/Current` on the left axis
- **WHEN** the user drags `/Drive/Current` from the legend
- **THEN** Left axis, Right axis, and Bands zones cover the graph
- **WHEN** the user drops it on the right half
- **THEN** `/Drive/Current` is plotted on the right axis

#### Scenario: Strings only go in bands

- **WHEN** the user drags a string entry over the graph
- **THEN** a single Bands zone covers the graph

### Requirement: Lines

The graph SHALL draw each numeric entry as a step line that holds each value until the next sample, matching the values shown at the cursor, and MUST hold the last value until the end of the source, except across time a live session was disconnected, where the line breaks.

#### Scenario: Value logged on change

- **GIVEN** `/Arm/Setpoint` is 0 at 0 s and 100 at 5 s
- **THEN** the line stays at 0 until 5 s, then jumps to 100

### Requirement: Dense and sparse lines

Where many samples fall in one pixel column, the line SHALL span their minimum and maximum, so short spikes stay visible at any zoom. When zoomed in until samples are at least 16 px apart, each sample MUST be marked with a dot, so held values can be told apart from logged ones.

#### Scenario: Spike while zoomed out

- **GIVEN** a full match is shown and `/Drive/Current` spikes for one sample
- **THEN** the spike is drawn

#### Scenario: Zoomed in

- **WHEN** the user zooms in until samples are far apart
- **THEN** each logged sample has a dot
- **AND** dots stay on their lines as either y-axis adjusts during zooming or panning

### Requirement: Discrete bands

Each discrete entry SHALL show its name above a row with a band per period of unchanged value, labeled with the value when it fits. Bands MUST NOT mark individual samples. Hovering a band SHALL show its value, time range, and a swatch matching the band color. Where a value changes more than once within a pixel, the band MUST be hatched in a neutral color and the tooltip MUST show a change count instead of a value or swatch.

#### Scenario: Enum-like string entry

- **GIVEN** the graph shows `/Arm/State` with values `STOWED`, `INTAKING`, and `SCORING`
- **THEN** each distinct value has its own color
- **AND** hovering `SCORING` shows a swatch matching the `SCORING` band

#### Scenario: Fast changes while zoomed out

- **GIVEN** `/Vision/HasTarget` flickers 12 times within one pixel
- **THEN** that pixel is hatched, and hovering it says "12 changes"

#### Scenario: Narrow boolean band

- **GIVEN** `/Intake/HasGamePiece` is true for a band too narrow to fit "true"
- **THEN** the band is labeled "t"

### Requirement: Band colors

String values SHALL use colors whose hues are spaced evenly around the hue wheel starting from the theme color's hue (Tailwind's blue for the Neutral preset). True uses the theme's success color, and false uses a near-gray tinted with the theme color. Band colors MUST share one lightness that keeps black value labels readable on every band in both light and dark variants.

#### Scenario: Theme color changes

- **GIVEN** the graph shows `/Arm/State`
- **WHEN** the user picks a different theme color
- **THEN** the bands are redrawn with colors based on the new theme color

### Requirement: Layout

The graph SHALL show a legend at the top, with left axis entries on the left and right axis entries on the right, each side wrapping within up to half the width, then the plot, then the discrete rows, and a time axis at the bottom labeled like the timeline. Gridlines MUST be faint, with a stronger line at zero, and the first and last time labels MUST NOT be cut off. The plot MUST be left out when no entries are plotted, and the discrete rows when there are none.

#### Scenario: Only discrete entries

- **GIVEN** the graph only shows boolean entries
- **THEN** it shows their bands and the time axis without a plot

### Requirement: Graph controls in the empty state

The graph's **No entries** message SHALL show a short guide to seeking, measuring, panning, and zooming below the instructions for adding entries, without requiring the user to open it. The guide MUST NOT appear in the pane menu or when the graph has any bound entries, even if the current source has no data for them.

#### Scenario: Learn the controls before adding an entry

- **GIVEN** a graph with no bound entries
- **THEN** the **No entries** message shows how to seek, measure a range, pan, and zoom without any interaction

#### Scenario: Add the first entry

- **GIVEN** a graph showing the **No entries** message
- **WHEN** the user adds an entry
- **THEN** the guide is no longer shown

### Requirement: Fade hidden lines

Hiding or showing a plotted entry SHALL fade its line out or in, instantly when the system is set to reduce motion. A hidden line MUST stay in place while it fades out, and its axis MUST only ease to fit the other lines once it has.

#### Scenario: Hide a line

- **WHEN** the user hides `/Drive/Velocity` from its swatch
- **THEN** its line fades out instead of disappearing at once

### Requirement: Long legends

A legend with many entries SHALL scroll instead of taking up more than about a third of the graph, so the plot keeps most of it.

#### Scenario: Twelve entries

- **GIVEN** the graph plots twelve entries in a short pane
- **THEN** the legend scrolls and the plot fills the rest

### Requirement: Short legend names

The legend SHALL show each entry's full name when there's room for it. When there isn't, it SHALL name the entry by the fewest last segments that tell it apart from the graph's other plotted entries, shortening the segments before them like long names in other legends. A segment that would shorten the same as another entry's segment under the same parent MUST stay in full. The legend MUST NOT show roles.

#### Scenario: Room for full names

- **GIVEN** a wide graph plotting `/Robot/Drive/LeftVelocity` and `/Robot/Arm/Velocity`
- **THEN** the legend shows `/R/Drive/LeftVelocity` and `/R/Arm/Velocity`

#### Scenario: Siblings

- **GIVEN** a narrow graph plotting `/Robot/Drive/LeftVelocity` and `/Robot/Arm/Velocity`
- **THEN** the legend shows `/R/D/LeftVelocity` and `/R/A/Velocity`

#### Scenario: Segments that shorten the same

- **GIVEN** a narrow graph plotting `/Robot/Swerve/Speed` and `/Robot/Shooter/Angle`
- **THEN** the legend shows `/R/Swerve/Speed` and `/R/Shooter/Angle`

### Requirement: Hover tooltip

Hovering the graph SHALL show a tooltip diagonally off the pointer, toward the middle of the graph, with the hovered time, the robot's mode then, and each plotted entry's value at that time with its unit, and SHALL mark where each line crosses the hovered time. The legend MUST only name the entries. The tooltip MUST only switch sides of the pointer once it's well past the middle of the graph, so it doesn't flip back and forth there.

#### Scenario: Hover

- **WHEN** the user hovers the graph at 12 s during teleop
- **THEN** a tooltip shows `0:12.00 · Teleop` and each plotted entry's value at 12 s
- **AND** each line is marked where it crosses 12 s

#### Scenario: Move the tooltip off a line

- **GIVEN** the tooltip covers part of a line
- **WHEN** the user moves the pointer down
- **THEN** the tooltip moves down with the pointer

### Requirement: Time offset from the cursor

The hovered graph SHALL draw a bracket between the global cursor and the hover line with the signed time offset in seconds. The bracket MUST only appear when both marks are visible and separate, and MUST be hidden when a drag measurement is shown. The tooltip MUST NOT repeat the offset.

#### Scenario: Compare a hovered time with the cursor

- **GIVEN** the global cursor is at 10.5 s
- **WHEN** the user hovers the graph at 12 s
- **THEN** a bracket between the two lines in the graph is labeled `+1.50 s`

### Requirement: Tooltip placement

The graph's tooltip SHALL be drawn over other panes rather than cut off at the graph's pane, and MUST stay within the window, covering the pointer if it has to. It MUST NOT show while the graph's pane is hidden by another zoomed pane.

#### Scenario: Narrow pane

- **GIVEN** a graph in a pane narrower than its tooltip
- **WHEN** the user hovers it
- **THEN** the whole tooltip shows, over the panes beside it

#### Scenario: Zoom another pane

- **GIVEN** the graph's tooltip is kept shown at the cursor
- **WHEN** the user zooms another pane
- **THEN** no tooltip shows until the graph's pane is restored

### Requirement: Robot mode

The graph SHALL show the robot's mode along the top of its time axis, in the timeline's colors, with the spans the timeline compresses hatched like on the timeline.

#### Scenario: Autonomous period

- **GIVEN** a log where the robot was in autonomous from 2 s to 17 s
- **THEN** the time axis is marked in the autonomous color from 2 s to 17 s

### Requirement: Cursor and seeking

The graph SHALL draw the global cursor as a vertical line across the plot and bands. Clicking without dragging MUST move the cursor there and keep the tooltip shown at the cursor, and clicking again MUST stop showing it. The kept tooltip MUST be hidden while another graph or the timeline is hovered. Hovering or clicking within a few pixels of the cursor MUST snap to it.

#### Scenario: Click to seek

- **WHEN** the user clicks the graph at 12 s, then moves the pointer away
- **THEN** the global cursor moves to 12 s
- **AND** the tooltip stays shown at 12 s

#### Scenario: Hover another graph

- **GIVEN** the user clicked the first of two graphs at 12 s
- **WHEN** the user hovers the second graph
- **THEN** only the second graph's tooltip shows

### Requirement: Shared hover

Hovering a graph SHALL show a line at the hovered time in every other graph and on the timeline, and hovering the timeline SHALL show it in every graph.

#### Scenario: Two graphs

- **GIVEN** two graphs
- **WHEN** the user hovers the first at 12 s
- **THEN** the second graph and the timeline mark 12 s

### Requirement: Shared time range

All graphs SHALL show the same time range. Logs MUST start showing their whole range when opened, and live sources the newest 30 seconds, scrolling as data arrives. Switching between the log and the live session MUST keep how much time is shown, around the cursor in the log and ending at the newest data live. The range MUST NOT be saved, so it's reset when Studio is reopened.

#### Scenario: Zoom one graph

- **GIVEN** two graphs
- **WHEN** the user zooms the first
- **THEN** the second shows the same time range

#### Scenario: Switch to live

- **GIVEN** graphs show 10 seconds of a log
- **WHEN** the user goes back to the live session
- **THEN** graphs show the newest 10 seconds of live data

### Requirement: Zoom and pan

Scrolling vertically or pinching SHALL zoom the time axis toward the pointer, and scrolling sideways or dragging with Shift held MUST pan it. Whether a scroll pans or zooms MUST follow its recent direction, so a mostly sideways swipe never zooms, and turning it switches without lifting. Holding Shift while scrolling, or scrolling over a y-axis, MUST zoom that y-axis instead. Zooming MUST stop at the source's whole range and at 1 ms.

#### Scenario: Slightly diagonal swipe

- **WHEN** the user swipes mostly sideways on a trackpad
- **THEN** the graph pans without zooming
- **WHEN** the user turns the swipe to vertical without lifting
- **THEN** the graph zooms

### Requirement: Following live data

While following a live source, the graph SHALL keep the newest data at its right edge. Zooming MUST change how much time is shown while still following, and panning back in time MUST stop following.

#### Scenario: Pan while following

- **GIVEN** a live source is being followed
- **WHEN** the user scrolls the graph back in time
- **THEN** the graph shows earlier data and the timeline stops following

### Requirement: Y-axis range

Each y-axis SHALL fit the data in view, but MUST NOT span less than 5% of its entries' range across the whole source, so noise in a quiet stretch doesn't fill the graph. Changes to the range MUST ease over about 200 ms, instantly when the system reduces motion. Zooming or panning an axis keeps its range fixed until the view is reset. Zooming an axis MUST stop at 100 times the range that fits its data, and at a thousandth of it or where its labels would repeat, whichever is wider.

#### Scenario: Zoom an axis far out

- **GIVEN** the left axis fits `/Arm/Angle` between 10° and 20°
- **WHEN** the user keeps scrolling over the left axis to zoom out
- **THEN** it stops zooming out once it spans about 1000°

#### Scenario: Reset view

- **GIVEN** the user zoomed a graph's time and y-axes
- **WHEN** the user picks **Reset view** next to **Change widget** in the graph's pane menu or context menu
- **THEN** the y-axes fit the data in view again
- **AND** all graphs show the whole log, or the newest 30 seconds of a live source

#### Scenario: Quiet stretch

- **GIVEN** `/Shooter/Velocity` stays within 0.001 of 0 for a while, then reaches 3000
- **WHEN** the user zooms into the quiet stretch
- **THEN** the left axis spans at least 150 and the line looks flat

#### Scenario: Fit to view

- **WHEN** the user zooms into a period where `/Arm/Angle` stays between 10° and 20°
- **THEN** the left axis spans about 10° to 20°

### Requirement: Range measurement

Dragging SHALL select a time range, labeled with its duration and each plotted entry's change across it. Pressing Esc or clicking MUST clear it.

#### Scenario: Measure a change

- **WHEN** the user drags from 2 s to 3.5 s
- **THEN** the range is labeled 1.50 s
- **AND** with how much each entry changed from 2 s to 3.5 s

### Requirement: Units on axes

Each y-axis SHALL be labeled with the unit of its entries. Entries on the same axis whose units measure the same thing MUST be converted to the unit of the axis's first entry, and entries whose units can't be converted MUST be plotted as logged.

#### Scenario: Converted units

- **GIVEN** the left axis shows `/Arm/AngleRadians`
- **WHEN** the user binds `/Wrist/AngleDegrees` to the left axis
- **THEN** `/Wrist/AngleDegrees` is plotted in radians and the axis is labeled `rad`
