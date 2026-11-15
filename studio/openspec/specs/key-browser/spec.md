# key-browser Specification

## Purpose

Define the key browser, a collapsible panel listing every entry in the active source as a searchable tree, used to find entries and drag them onto widgets.

## Requirements

### Requirement: Entry tree

The key browser SHALL list every entry in the active source as a tree grouped by path segments, showing each entry's type and value at the cursor.

#### Scenario: Nested entries

- **GIVEN** the source has `/Arm/Angle` and `/Arm/Velocity`
- **THEN** both appear under an expandable `Arm` group

#### Scenario: Live announcements

- **GIVEN** a live source is active
- **WHEN** a new topic is announced
- **THEN** it appears in the tree

### Requirement: Search

The key browser SHALL provide a search box that filters the tree to entries whose names match.

#### Scenario: Search entries

- **WHEN** the user types "velocity"
- **THEN** only entries whose names match "velocity" and their parent groups are shown

### Requirement: Collapsible panel

The key browser SHALL be a collapsible panel on the right side of the dashboard view, toggled by a button or keyboard shortcut, and its open state MUST persist.

#### Scenario: Toggle and remember

- **WHEN** the user collapses the key browser and reopens Studio
- **THEN** the key browser is still collapsed

### Requirement: Drag to bind

Users SHALL be able to drag entries from the key browser onto widgets to bind them.

#### Scenario: Drag an entry

- **WHEN** the user drags `/Arm/Angle` onto a values table
- **THEN** the values table binds `/Arm/Angle`
