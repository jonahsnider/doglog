# widget-histogram Specification

## Purpose

Define the Histogram widget, which shows how recorded numeric values are distributed over a time range. For example, a team can see typical loop timings and how far the slowest loops are from them.

## Requirements

### Requirement: Numeric entries

The Histogram widget SHALL accept only scalar numeric entries and SHALL show them in one histogram, each visible binding as a series in its color. Series MUST share the same bins, and overlapping bars MUST stay visible through each other. A summary table MUST list each binding in order, starting with its standard legend item to color and hide it. Hiding a binding MUST remove its series and statistics.

#### Scenario: Hide a series

- **GIVEN** the widget is bound to `/Robot/LoopMilliseconds` and `/Vision/LoopMilliseconds`
- **WHEN** the user hides `/Robot/LoopMilliseconds` from its swatch
- **THEN** its series and statistics are hidden, and the histogram is binned over `/Vision/LoopMilliseconds` alone

### Requirement: Units

Units SHALL follow a graph's axis (see widget-graph and entry-units): the value axis takes the first entry's unit and shows it at the end of the axis, entries measuring the same thing are converted to it, and other entries are shown as logged. Each binding's legend item MUST show the unit its values are shown in.

#### Scenario: Compare two loop timings

- **WHEN** the user binds `/Robot/LoopMilliseconds` and `/Vision/LoopSeconds`
- **THEN** the widget shows one histogram in `ms` with a series for each, and `/Vision/LoopSeconds` values converted to `ms`

### Requirement: Time range

The widget SHALL use the samples in the time range graphs show (see widget-graph), updating as it changes, including while following live data. Below the histogram it MUST show a time axis like a graph's. Scrolling over the histogram or its time axis MUST zoom and pan the time range like scrolling a graph. While a histogram is shown, the timeline MUST mark that range like it does for graphs. The playhead and a graph's drag-to-measure selection MUST NOT filter samples.

#### Scenario: Zoom from the histogram

- **GIVEN** a graph and a Histogram widget
- **WHEN** the user scrolls up over the histogram above 0:30 on its time axis
- **THEN** the graph and the histogram both zoom toward 0:30
- **AND** the histogram uses only samples in the narrower time range

#### Scenario: Follow live data

- **GIVEN** a Histogram widget while following a live source
- **WHEN** a new value arrives for a bound entry and the time range advances past an older sample
- **THEN** the widget includes the new sample and no longer includes the older one

### Requirement: Recorded samples

The widget SHALL include each finite numeric sample whose timestamp falls in the selected time range, including both endpoints, once. It MUST NOT count held values, infer samples between recordings, weight samples by duration, or drop equal recorded values. `NaN` and infinities MUST be ignored.

#### Scenario: Held and repeated values

- **GIVEN** an entry records 30 at 4 s, 10 at 5 s, 10 again at 7 s, `NaN` at 8 s, and 20 at 10 s
- **WHEN** the widget analyzes 5 s through 10 s
- **THEN** it counts three samples: 10, 10, and 20

### Requirement: Histogram bins

Each histogram SHALL plot values against sample count, starting the count axis at zero. It MUST choose equal-width bins automatically and cover the full value range by default. Each plotted sample MUST count once: a bin includes its lower edge and excludes its upper edge, except the last bin includes both. Nonempty bins MUST be at least one pixel high. If all samples have the same value, the histogram MUST show a single bar at that value.

#### Scenario: Constant value

- **GIVEN** an entry has eight samples and all are 20 ms
- **THEN** the histogram shows one bar at 20 ms with a count of eight

### Requirement: Bin readout

Hovering, focusing with the keyboard, or tapping a bin SHALL show a readout beside it with its value interval (or single value), and each visible series' count in the bin and percentage of that series' finite samples in the selected time range. The readout MUST go away when the bin is no longer hovered, focused, or tapped.

#### Scenario: Inspect a bin

- **GIVEN** an entry has 12 samples in the selected time range, and three fall in the bin from 18 ms up to but not including 20 ms
- **WHEN** the user focuses that bin
- **THEN** the readout shows that interval, a count of three, and 25%

### Requirement: Histogram value zoom

Dragging across the histogram SHALL zoom its value axis to the dragged values, highlighting them while dragging. Scrolling MUST NOT zoom or pan the value axis, it only changes the time range. The histogram MUST rebin the values in view and show how many samples are outside it. Zooming MUST NOT change the time range, the summary table, or the totals bin percentages use.

#### Scenario: Inspect a cluster without losing the spike

- **GIVEN** an entry has 99 samples between 18 ms and 22 ms and one at 250 ms
- **WHEN** the user zooms the histogram's value axis to show 18 ms through 22 ms
- **THEN** its bins cover that value range and together count 99 samples
- **AND** the histogram indicates that one sample is outside the view
- **AND** the summary still shows a count of 100 and a maximum of 250 ms
- **WHEN** the user picks Reset view
- **THEN** the histogram includes the 250 ms sample again

### Requirement: Reset view

The widget's context menu SHALL offer Reset view, which MUST reset the value zoom and the time range like a graph's Reset view.

#### Scenario: Reset a zoomed histogram

- **GIVEN** a histogram zoomed to 18 ms through 22 ms, with graphs zoomed to 1:10 through 1:20
- **WHEN** the user picks Reset view from the histogram's context menu
- **THEN** the histogram shows all values, and graphs and the histogram show the whole log

### Requirement: Summary statistics

Each binding's row in the summary table SHALL show count, minimum, maximum, arithmetic mean, median, p95, and p99. The median (p50), p95, and p99 MUST use linear interpolation by position in sorted sample order, with the first sample at 0% and the last at 100%. With one sample, all three percentiles MUST equal that sample.

#### Scenario: Interpolated percentiles

- **GIVEN** an entry has samples 10, 20, and 60 in the selected time range
- **THEN** its count is 3, minimum is 10, maximum is 60, and mean is 30
- **AND** its median is 20, p95 is 56, and p99 is 59.2

### Requirement: No samples in range

An entry present in the active source but without finite samples in the selected time range SHALL show "No samples in range" in its summary row and have no series in the histogram. An entry missing from the active source MUST use the shared "No data" state in its row. Neither state MAY remove the binding or affect the results for other entries. When no visible series has samples, the histogram MUST be replaced by "No samples in range", centered.

#### Scenario: No samples during a phase

- **GIVEN** the widget is bound to two numeric entries, one of which has no samples during autonomous
- **WHEN** the user zooms the time range to autonomous
- **THEN** the entry without samples shows "No samples in range"
- **AND** the histogram and summary still show the other entry
