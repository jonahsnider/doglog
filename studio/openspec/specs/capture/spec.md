# capture Specification

## Purpose

Let users share what they see in Studio as an image or a short log clip without requiring the recipient to open Studio or obtain the log.

## Requirements

### Requirement: Available capture actions

Studio SHALL offer capture on macOS and Windows. It MAY offer capture on other platforms if it can capture the current Studio view without a screen or tab picker. Capture MUST run locally and MUST NOT upload the output or expose capture actions to agents.

#### Scenario: View the dashboard menu on an unsupported platform

- **WHEN** the user opens the dashboard menu on a platform without capture support
- **THEN** the menu does not offer capture actions

### Requirement: Copy an image

A dashboard's sidebar menu SHALL offer Copy image when it contains a widget. A widget's pane menu SHALL offer Copy image for that pane. Both actions MUST put an image on the clipboard without a save dialog and work with a log or a live source. Copying MUST NOT edit the dashboard or change playback.

#### Scenario: Copy an image on macOS without a visible flash

- **WHEN** the user copies a dashboard or pane image on macOS
- **THEN** capture-only styling does not appear in the visible window

#### Scenario: Copy the open dashboard with a zoomed pane

- **GIVEN** a pane is zoomed in the open dashboard
- **WHEN** the user chooses Copy image in that dashboard's sidebar menu
- **THEN** the clipboard receives the zoomed dashboard and its timeline, without either sidebar

#### Scenario: Copy the open dashboard while the collapsed sidebar is peeking

- **GIVEN** the collapsed sidebar is temporarily expanded over the open dashboard
- **WHEN** the user chooses Copy image in that dashboard's sidebar menu
- **THEN** the image shows the panes and timeline at their current sizes, without the sidebar covering them

#### Scenario: Copy a graph without zooming it

- **GIVEN** a graph is beside another widget
- **WHEN** the user chooses Copy image in the graph pane's menu
- **THEN** the clipboard receives only the graph pane at its current size, including its title, axes, and legend, without the timeline

#### Scenario: Copy an image of another dashboard

- **GIVEN** another dashboard contains a widget
- **WHEN** the user chooses Copy image in that dashboard's sidebar menu
- **THEN** Studio opens that dashboard and copies it after its visible widgets finish loading
- **AND** the destination dashboard remains open

### Requirement: Copy a dashboard image with the keyboard

With no dashboard menu open, ⌘C (Ctrl+C on Windows) SHALL copy the open dashboard's image when it contains a widget, unless a text field is focused, text is selected, or a widget handles the shortcut. On macOS, ⌘C in a dashboard menu SHALL select that menu's Copy image action when present.

#### Scenario: Copy the dashboard image with the keyboard

- **GIVEN** a dashboard containing a widget is open on a platform with capture support
- **WHEN** the user presses the copy shortcut with no selected text, focused text field, or widget handling the shortcut
- **THEN** the clipboard receives the same image as choosing Copy image in the dashboard's sidebar menu

#### Scenario: Copy another dashboard from its open menu on macOS

- **GIVEN** the user opens the sidebar menu for another dashboard that contains a widget on macOS
- **WHEN** the user presses ⌘C
- **THEN** Studio opens and copies the dashboard whose menu was open, rather than the dashboard that was previously open

#### Scenario: Copy a text selection

- **GIVEN** text is selected on an open dashboard
- **WHEN** the user presses the copy shortcut
- **THEN** the selection is copied instead of a dashboard image

### Requirement: Capture the visible content

Captures SHALL preserve the current theme, pane proportions, scroll position, graph ranges, 3D viewpoints, and pinned graph readouts. A pinned readout MUST fit inside the capture even if it normally extends past its edge. Captures MUST NOT include content scrolled out of view, hover-only readouts, menus, the pointer, editing controls, or collaboration avatars.

#### Scenario: Copy a dashboard with a graph and a 3D scene

- **GIVEN** the graph has a pinned readout and the 3D scene shows a rotated robot with floor labels
- **WHEN** the user copies an image of the dashboard
- **THEN** the image contains the graph and its pinned readout, the robot at the same viewing angle, and the floor labels
- **AND** the pointer and menu are not in the image

#### Scenario: Copy a scrolled console

- **WHEN** the user copies an image of a console pane while it is scrolled
- **THEN** the image shows the rows visible at that position, not the full console history

### Requirement: Read-only capture timeline

A captured timeline SHALL show the playhead, elapsed time, and visible event markers without playback or clip controls.

#### Scenario: Save a clip with a selected range

- **WHEN** the user saves a clip with its start and end handles visible in Record mode
- **THEN** the video shows the playhead moving, without either handle or any playback controls

### Requirement: Set a clip range in Record mode

The open dashboard's sidebar menu SHALL offer Export clip when it contains a widget and a log is open. The action MUST open Record mode with a preview of the dashboard or zoomed pane at its current proportions. The user MUST be able to set the start and end on the timeline with draggable handles or typed timestamps, and scrub the preview. The selected range MUST be within the readable log and its end MUST be after its start. Record mode controls MUST stay outside the video frame.

#### Scenario: Trim a clip without a graph

- **GIVEN** a dashboard showing only a field widget is open on a log
- **WHEN** the user enters Record mode, drags the start handle to 0:41, and types 0:49 for the end
- **THEN** the preview shows the field widget and the user can scrub the selected eight seconds before saving

### Requirement: Save a clip without changing the analysis

Studio SHALL let the user save the selected range as a silent MP4. The clip MUST show the selected range at the log's original timing, regardless of playback speed or Skip idle time. Exiting Record mode after saving or canceling MUST restore the previous dashboard view, playhead position, and playback state.

#### Scenario: Export with faster playback and idle skipping enabled

- **GIVEN** playback was set to 2× with Skip idle time on
- **WHEN** the user saves a clip from 0:41 to 0:49
- **THEN** the saved clip runs for eight seconds and includes any idle time in that range
- **AND** exiting Record mode returns the user to their previous view and playback state
