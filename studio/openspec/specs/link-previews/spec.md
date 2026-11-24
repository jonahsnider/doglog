# link-previews Specification

## Purpose

Define what chat apps and social sites show when someone shares a Studio link. Cloud dashboard previews do not reveal dashboard contents.

## Requirements

### Requirement: Generic preview

Every Studio page SHALL have a link preview with the title "DogLog Studio", a short description of Studio, and an image of Studio's logo and name, large and centered on Studio's dark background. Dashboard links that are invalid or unsupported MUST show this preview too.

#### Scenario: Share the home page

- **WHEN** someone shares a link to Studio's home page in a chat app
- **THEN** the preview shows "DogLog Studio", its description, and the generic image

#### Scenario: Share an invalid dashboard link

- **WHEN** someone shares an invalid or unsupported dashboard link
- **THEN** the preview is the generic one

### Requirement: Cloud dashboard link preview

A Cloud dashboard link SHALL use one built-in Studio preview image with no option to disable or customize it. The preview text MAY include public team information such as the team name. The preview MUST NOT expose the dashboard name, entry names, layout, widget settings, or bindings.

#### Scenario: Paste a Cloud dashboard link into a chat

- **GIVEN** a Cloud dashboard named "Auto tuning" has a graph bound to `/Robot/Drive/Speed`
- **WHEN** a chat app fetches the preview without signing in
- **THEN** it sees the built-in image, without the dashboard name, entry name, or pane layout

### Requirement: Preview appearance

Preview images SHALL be 1200 by 630 pixels, in dark mode with the default theme color, since they can't know the viewer's theme. Link previewers MUST be told to show them as large images.

#### Scenario: Custom theme

- **GIVEN** the user who copies a dashboard link uses a light theme with another theme color
- **WHEN** someone shares the link
- **THEN** the preview image still uses dark mode and the default theme color

### Requirement: Privacy

Link previews SHALL be made from public metadata without decrypting dashboard data. Dashboard links MUST NOT be stored or logged by the servers that make their previews. Opening a Cloud dashboard link MUST NOT publish a dashboard to Cloud or a robot.

#### Scenario: Preview a link

- **WHEN** a chat app fetches a dashboard link's preview
- **THEN** the preview is made without decrypting the dashboard or logging the link

### Requirement: Fresh previews

Preview images SHALL be cached by link previewers for at most a day, so changes to how previews look reach links that were already shared.

#### Scenario: Preview design changes

- **GIVEN** a dashboard link was shared yesterday
- **WHEN** a new version of Studio changes how preview images look
- **THEN** previewers that fetch the image again after a day get the new look
