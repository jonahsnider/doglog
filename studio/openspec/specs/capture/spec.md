# capture Specification

## Purpose

Let users share what they see in Studio as an image or a short video of a log without requiring the recipient to open Studio or obtain the log.

## Requirements

### Requirement: Available capture actions

Studio SHALL offer capture on macOS and Windows. It MAY offer capture on other platforms if it can capture the current Studio view without a screen or tab picker. Capture MUST run locally and MUST NOT upload the output. Agents MAY save the same images to files, see agent-control.

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

A captured timeline SHALL show the playhead, elapsed time, and visible event markers without playback or range controls. A video's timeline MUST mark its start and end with ticks, unless the video covers the whole source range. Video export mode MUST NOT show the ticks while the user picks the range.

#### Scenario: Save a video with a selected range

- **WHEN** the user saves a video with its start and end handles visible in video export mode
- **THEN** the video shows the playhead moving between ticks at the range's start and end, without either handle or any playback controls

### Requirement: Open video export mode

The open dashboard's sidebar menu SHALL offer Export video… when it contains a widget and shows a loaded log or live history, and ⌘R (Ctrl+R on Windows) SHALL do the same. Panes MUST NOT offer it. The action MUST pause playback and open video export mode with up to 10 seconds from the playhead, shifted earlier if needed to fit within the source.

#### Scenario: Open video export mode with the keyboard

- **GIVEN** a dashboard containing a widget is open on a log
- **WHEN** the user presses ⌘R
- **THEN** Video export mode opens for that dashboard, with a range starting at the playhead

#### Scenario: Export a video while connected to a live source

- **GIVEN** the dashboard is following new data from a live source
- **WHEN** the user chooses Export video…
- **THEN** Video export mode uses the live history available when it opened, without interrupting the connection or recording of new data
- **AND** preview playback stops at the end of the selected range instead of following new data
- **AND** saving or canceling returns the dashboard to following the latest live data

### Requirement: Set a video's range in video export mode

The user SHALL be able to set a video's start and end on the timeline with draggable handles or typed timestamps. The range MUST be within the available history and at least 1 second long, unless the available history is shorter.

#### Scenario: Trim a video without a graph

- **GIVEN** a dashboard showing only a field widget is open on a log
- **WHEN** the user enters video export mode, drags the start handle to 0:41, and types 0:49 for the end
- **THEN** the preview shows the field widget and the user can scrub the selected eight seconds before saving

#### Scenario: Drag the end handle past the start

- **GIVEN** Video export mode is open with a range from 0:41 to 0:49
- **WHEN** the user drags the end handle to 0:40
- **THEN** the range ends at 0:42, one second after its start

### Requirement: Preview a video in video export mode

Video export mode SHALL preview the dashboard or zoomed pane at its current proportions, styled like a capture. The user MUST be able to scrub or play the preview within the range, at the source's original timing. Its controls MUST stay outside the video frame, in a bar under the timeline. Widgets MUST stay usable, but the sidebar, the entry browser, and the dashboard's layout MUST NOT. Escape MUST leave video export mode.

#### Scenario: Preview a video with faster playback set

- **GIVEN** playback was set to 2× before entering video export mode
- **WHEN** the user plays the preview
- **THEN** it plays at 1× and stops at the end of the range

### Requirement: Save a video without changing the analysis

Studio SHALL let the user save the selected range as a silent MP4. The video MUST show the selected range at the source's original timing, regardless of playback speed or Skip idle time. Exiting video export mode after saving or canceling MUST restore the previous dashboard view, playhead position, and playback state. If the playhead was following live data, it MUST return to the newest data instead of its previous position.

#### Scenario: Export with faster playback and idle skipping enabled

- **GIVEN** playback was set to 2× with Skip idle time on
- **WHEN** the user saves a video from 0:41 to 0:49
- **THEN** the saved video runs for eight seconds and includes any idle time in that range
- **AND** exiting video export mode returns the user to their previous view and playback state

### Requirement: Show progress while saving a video

Saving a video SHALL ask where to save it, suggesting the dashboard's name, then show its progress in the video export bar. Videos MUST be H.264 at 30 frames per second, at the frame's size on screen unless that's larger than the encoder supports. Canceling MUST delete the partial file and keep video export mode open with the same range. A saved video MUST offer to show the file.

#### Scenario: Cancel saving a video

- **GIVEN** a video is being saved
- **WHEN** the user chooses Cancel or presses Escape
- **THEN** no file is left where the video was being saved, and video export mode stays open with the same range
