# performance Specification

## Purpose

Define performance targets that keep Studio fast and responsive when loading large logs and streaming live data, measured on a typical FRC team laptop.

## Requirements

### Requirement: Fast log loading

Studio SHALL make a 100 MB log ready to browse within about 3 seconds.

#### Scenario: Full match log

- **WHEN** the user opens a 100 MB log
- **THEN** the entry browser and widgets are usable within about 3 seconds

### Requirement: Responsive UI

The UI MUST remain responsive while loading logs or receiving live data.

#### Scenario: Interact during load

- **GIVEN** a large log is loading
- **WHEN** the user opens Settings or switches dashboards
- **THEN** the UI responds without freezing

### Requirement: Low live latency

Live values SHALL appear on screen within about 100 ms of being received.

#### Scenario: Live update

- **GIVEN** the cursor is following live data
- **WHEN** a new value arrives
- **THEN** widgets show it within about 100 ms

### Requirement: Smooth rendering

Time-series widgets SHALL render at 60 frames per second while scrubbing or streaming.

#### Scenario: Scrubbing

- **WHEN** the user scrubs the timeline with several graphs open
- **THEN** the graphs update at 60 frames per second

### Requirement: Light 3D field

The 3D field model SHALL add at most about 1 MB to the app as downloaded, and a field widget in 3D SHALL render at 60 frames per second while playing back on a typical school laptop with integrated graphics.

#### Scenario: Play back in 3D

- **GIVEN** a field widget in 3D showing a robot, its parts, and a path
- **WHEN** the user plays back a match
- **THEN** the field widget updates at 60 frames per second
