# link-previews Specification

## Purpose

Define what chat apps and social sites show when someone shares a Studio link, so a shared dashboard link shows which dashboard it opens before anyone clicks it.

## Requirements

### Requirement: Generic preview

Every Studio page SHALL have a link preview with the title "DogLog Studio", a short description of Studio, and an image of Studio's logo and name, large and centered on Studio's dark background. Dashboard links that are invalid or unsupported MUST show this preview too.

#### Scenario: Share the home page

- **WHEN** someone shares a link to Studio's home page in a chat app
- **THEN** the preview shows "DogLog Studio", its description, and the generic image

#### Scenario: Share an invalid dashboard link

- **WHEN** someone shares a dashboard link whose snapshot can't be read
- **THEN** the preview is the generic one

### Requirement: Dashboard link preview

A dashboard link's preview SHALL show the dashboard's name as its title, or the name Studio suggests from its entries when it has none, with the description "Open this dashboard in DogLog Studio." Its image MUST show Studio's logo and name, the dashboard's name, and a wireframe of its panes in their layout and proportions., each with its widget's icon and title like a pane header.

#### Scenario: Empty pane

- **GIVEN** a dashboard with an empty pane
- **WHEN** someone shares its link
- **THEN** the image shows that pane blank, without suggesting data the link doesn't have, ex. placeholder graph lines

#### Scenario: Named dashboard

- **GIVEN** a dashboard named "Auto tuning" with a graph beside a field
- **WHEN** someone shares its link
- **THEN** the preview's title is "Auto tuning"
- **AND** its image shows a Graph pane beside a Field pane

#### Scenario: Unnamed dashboard

- **GIVEN** an unnamed dashboard that the sidebar shows as "Drive & Elevator"
- **WHEN** someone shares its link
- **THEN** the preview's title is "Drive & Elevator"

#### Scenario: Long names

- **WHEN** a dashboard's name or a pane's entries name doesn't fit on one line
- **THEN** it wraps onto more lines instead of being cut off

#### Scenario: Narrow pane

- **WHEN** a pane is too narrow for its widget's icon and title
- **THEN** the pane leaves them out instead of cutting off the title

### Requirement: Pane contents

Each pane in a dashboard link's image SHALL show a name for the entries its widget shows, named the way dashboards are, centered vertically and lined up with its header on the left. Widgets without entries, or with only their type's default entries, MUST show their icon in the pane's middle instead, since their header already describes them.

#### Scenario: Pane contents

- **GIVEN** a graph of `/Robot/Drive/Speed` and `/Robot/Elevator/Height` beside a notepad
- **WHEN** someone shares the dashboard's link
- **THEN** the image's Graph pane shows "Drive & Elevator" halfway down, lined up with its header
- **AND** the Notepad pane shows the notepad icon in its middle

### Requirement: Fitting pane contents

A pane's entries name SHALL shrink to fit below its header without touching it or being cut off. Panes with room MAY show it larger, but MUST NOT wrap it onto more lines to do so. When it doesn't fit even at its smallest size, the pane MUST leave out its header to make room, and show its widget's icon if that's still not enough. Panes too short to show that icon at a recognizable size MUST leave it out.

#### Scenario: Short pane

- **GIVEN** a dashboard with a short pane whose entries' name wraps onto two lines at the usual size
- **WHEN** someone shares its link
- **THEN** the image shows the name smaller, below the pane's header and inside the pane

#### Scenario: Large pane

- **GIVEN** a dashboard with a large pane whose entries' name fits on one line at the usual size
- **WHEN** someone shares its link
- **THEN** the image shows the name larger, still on one line

### Requirement: Preview appearance

Preview images SHALL be 1200 by 630 pixels, in dark mode with the default theme color, since they can't know the viewer's theme. Link previewers MUST be told to show them as large images.

#### Scenario: Custom theme

- **GIVEN** the user who copies a dashboard link uses a light theme with another theme color
- **WHEN** someone shares the link
- **THEN** the preview image still uses dark mode and the default theme color

### Requirement: Privacy

Link previews SHALL be made from the link alone. Dashboard links MUST NOT be stored or logged by the servers that make their previews, so a shared dashboard only exists on the devices that open it.

#### Scenario: Preview a link

- **WHEN** a chat app fetches a dashboard link's preview
- **THEN** the preview is made without storing the dashboard anywhere

### Requirement: Fresh previews

Preview images SHALL be cached by link previewers for at most a day, so changes to how previews look reach links that were already shared.

#### Scenario: Preview design changes

- **GIVEN** a dashboard link was shared yesterday
- **WHEN** a new version of Studio changes how preview images look
- **THEN** previewers that fetch the image again after a day get the new look
