# agent-control Specification

## Purpose

Let AI agents control a running Studio so they can build dashboards for users. Agents see what's in a data source and how dashboards look, but never get its values as data: analyzing data is the job of wpilog-parser and its skill, not Studio.

## Requirements

### Requirement: Agent commands

Studio SHALL offer agents one set of commands, named `<resource>_<action>`, through WebMCP in the web app, an MCP server on desktop, and the `doglog` terminal command. Every surface MUST offer the same commands, except those a platform can't support. Each command MUST describe itself and its inputs well enough for an agent to use it without other documentation.

#### Scenario: Agent lists commands

- **GIVEN** an agent is connected to Studio
- **WHEN** it lists the available commands
- **THEN** it sees each command with a description and the inputs it takes

### Requirement: Command list

The agent commands SHALL be:

- `window_list`, `window_update`
- `dashboard_list`, `dashboard_get`, `dashboard_create`, `dashboard_update`, `dashboard_delete`, `dashboard_duplicate`, `dashboard_combine`, `dashboard_capture`
- `pane_create`, `pane_update`, `pane_move`, `pane_delete`
- `binding_create`, `binding_update`, `binding_delete`
- `entry_list`
- `source_get`, `source_update`, `source_delete`, `source_export`
- `timeline_get`, `timeline_update`
- `settings_get`, `settings_update`

#### Scenario: Consistent names

- **WHEN** an agent looks for how to remove a pane
- **THEN** it finds `pane_delete`, named like every other command that removes something

### Requirement: No entry values

Commands SHALL NOT return entry values or samples. Studio's agent instructions MUST point agents to wpilog-parser for anything that needs values.

#### Scenario: Agent wants to know when the arm stalled

- **GIVEN** an agent is connected to Studio
- **WHEN** it needs to find when `/Robot/Arm/Current` spiked
- **THEN** no command returns that entry's values
- **AND** Studio's instructions tell it to read the log with wpilog-parser instead

### Requirement: Agent edits are user edits

Changes made by an agent SHALL behave exactly like the same change made by the user in the window it targets: they persist, sync to other windows and to peers of shared dashboards, and can be undone with Undo in that window.

#### Scenario: Undo an agent's change

- **GIVEN** an agent added a pane to the dashboard the user is looking at
- **WHEN** the user presses ⌘Z in that window
- **THEN** the pane is removed

#### Scenario: Agent edits a shared dashboard

- **GIVEN** a dashboard is shared on the robot
- **WHEN** an agent adds a widget to it
- **THEN** other peers see the widget, as if the user had added it

### Requirement: Commands finish before returning

A command SHALL return once its effect is complete, ex. once a log is fully opened or a live connection is made or has failed. Studio MUST NOT time out commands itself.

#### Scenario: Open a large log

- **GIVEN** an agent opens a large log with `source_update`
- **WHEN** the command returns
- **THEN** `entry_list` lists every entry in the log

### Requirement: Entry catalog

`entry_list` SHALL list the active source's entries with each entry's name, type, kind, and metadata. It MUST accept an optional entry name filter and an optional kind filter, and return every match without pagination.

#### Scenario: Find pose entries

- **GIVEN** the active source has 2,000 entries
- **WHEN** an agent calls `entry_list` filtered to entries whose name contains `Pose`
- **THEN** it gets every matching entry's name, type, kind, and metadata

#### Scenario: Search the catalog in a terminal

- **WHEN** an agent runs `doglog entry list --json-output`
- **THEN** it gets the whole catalog as JSON it can filter with tools like `jq`

### Requirement: Read a dashboard

`dashboard_get` SHALL return a dashboard's name, layout, panes, widgets, options, and bindings, with the IDs other commands use to target them. It MUST also report problems that would stop a widget from showing what the agent intended: a bound entry missing from the active source, a role that couldn't be inferred, or an entry type the widget doesn't accept.

#### Scenario: Entry missing from the source

- **GIVEN** a field widget is bound to `/Robot/Pose`
- **AND** the active source has no `/Robot/Pose` entry
- **WHEN** an agent calls `dashboard_get`
- **THEN** that binding is reported as missing from the source

### Requirement: Create a dashboard from a layout

`dashboard_create` SHALL create a dashboard, optionally from a full layout of panes, widgets, options, and bindings given in one call. The layout input MUST NOT include IDs; Studio MUST assign them and return the created dashboard as `dashboard_get` would. An invalid layout MUST be rejected with an explanation and create nothing.

#### Scenario: Build a whole dashboard at once

- **WHEN** an agent calls `dashboard_create` with a layout of a field widget beside a swerve widget
- **THEN** the dashboard is added to the top of the dashboard list with both widgets
- **AND** the response includes the new dashboard's pane and binding IDs

#### Scenario: Too many panes in a row

- **WHEN** an agent calls `dashboard_create` with five panes side by side
- **THEN** nothing is created
- **AND** the error says how many panes fit along one direction

### Requirement: Edit dashboards

Agents SHALL be able to rename, share or stop sharing, duplicate, combine, and delete dashboards. `dashboard_delete` MUST close the dashboard exactly as the user would, so it can be reopened.

#### Scenario: Agent deletes a dashboard

- **GIVEN** an agent deleted the "Arm tuning" dashboard
- **WHEN** the user reopens closed dashboards
- **THEN** "Arm tuning" comes back

### Requirement: Capture dashboard images

`dashboard_capture` SHALL save a PNG of a dashboard, or one of its panes, that matches what Copy image puts on the clipboard. It MUST save to the absolute path it's given, or to a new file in the temporary folder, and return the file's path rather than the image itself. Like Copy image, it MUST show the dashboard and wait for its visible widgets to finish loading. It MUST restore a minimized window rather than wait for the user to.

#### Scenario: Check a dashboard the agent built

- **GIVEN** an agent created a dashboard with a graph beside a field widget
- **WHEN** it calls `dashboard_capture` without a path
- **THEN** it gets the path of a PNG in the temporary folder showing both widgets and the timeline

#### Scenario: Capture one widget

- **WHEN** an agent runs `doglog dashboard capture --dashboard-id <id> --pane-id <id> --path /tmp/graph.png`
- **THEN** `/tmp/graph.png` shows only that pane, as Copy image in its pane menu would

#### Scenario: Window is minimized

- **GIVEN** the Studio window is minimized
- **WHEN** an agent calls `dashboard_capture`
- **THEN** the window is restored and the image is saved

### Requirement: Edit panes and widgets

Agents SHALL be able to split a pane to add one, move and delete panes, and set a pane's widget type, widget options, and size. When `pane_create` isn't given a direction, it MUST pick the same direction Studio picks when the user adds a widget to that pane. Edits Studio wouldn't allow the user to make MUST be rejected with an explanation.

#### Scenario: Split without a direction

- **GIVEN** a pane that's much wider than it is tall
- **WHEN** an agent calls `pane_create` on it without a direction
- **THEN** the new pane is placed beside it, as when the user adds a widget there

#### Scenario: Pane can't split further

- **GIVEN** a row already has the most panes that fit along one direction
- **WHEN** an agent tries to split one of them along that row
- **THEN** the command fails and says why

### Requirement: Edit bindings

Agents SHALL be able to bind entries to a widget by entry name, and set each binding's role, color, hidden state, connections, and a field robot's Robot. Entries MUST be bound even when they're missing from the active source, as the user can. A role left unset MUST be inferred as it is for the user.

#### Scenario: Bind a pose with an inferred role

- **GIVEN** a field widget
- **WHEN** an agent binds `/Robot/Pose` to it without a role
- **THEN** the binding's role is inferred from the entry, as when the user drops it on the widget

### Requirement: Source and timeline

Agents SHALL be able to read the active source, connect to a robot, and close the source. On desktop they MUST also be able to open a log by its file path. Agents SHALL be able to read and move the timeline cursor, but not control playback. Times MUST be in seconds on the source's own clock, the same timestamps wpilog-parser reads.

#### Scenario: Show the user a moment

- **GIVEN** an agent found with wpilog-parser that the robot browned out at 92.4 s
- **WHEN** it moves the timeline cursor to 92.4 s
- **THEN** the user's dashboards show that moment

### Requirement: Export live data

`source_export` SHALL save a copy of the live session's recording, the same file Export as WPILOG saves, whether or not the live session is shown. It MUST save to the absolute path it's given, or to a new file in the temporary folder, and return the file's path. It MUST fail and say why when there's no live session with data.

#### Scenario: Analyze a practice session

- **GIVEN** the user has been connected to the robot during practice
- **WHEN** an agent runs `doglog source export`
- **THEN** it gets the path of a WPILOG file in the temporary folder that it can read with wpilog-parser

#### Scenario: No live session

- **GIVEN** only a log is open
- **WHEN** an agent calls `source_export`
- **THEN** the command fails and says there's no live session to export

### Requirement: Settings

Agents SHALL be able to read and change every setting on the Settings page.

#### Scenario: Change the theme

- **WHEN** an agent sets the theme to dark
- **THEN** Studio switches to the dark theme, as if the user had changed it

### Requirement: Out of scope for agents

Agents SHALL NOT be able to read or write notepad text or control playback. Agents can add notepad panes, which then show the shared notepad.

#### Scenario: Add a notepad

- **WHEN** an agent adds a notepad pane
- **THEN** the pane shows the same notes as every other notepad

### Requirement: Platform-specific commands

A command that can't work on the current platform SHALL NOT be offered there, rather than being offered and failing. In the web app this means no window commands or `window` input, no `dashboard_capture` or `source_export`, and no opening logs by file path. On desktop platforms without capture support, it means no `dashboard_capture`.

#### Scenario: Web app

- **GIVEN** an agent is connected to the web app through WebMCP
- **WHEN** it lists the available commands
- **THEN** there are no window commands, `dashboard_capture`, or `source_export`
- **AND** `source_update` can connect to a robot but not open a file path

### Requirement: WebMCP in the web app

The web app SHALL offer its commands through WebMCP in browsers that support it, for that tab only. Browsers without WebMCP get no agent access.

#### Scenario: Browser agent builds a dashboard

- **GIVEN** the user has the web app open in a browser that supports WebMCP
- **WHEN** the browser's agent asks Studio to add a console widget
- **THEN** the console appears in that tab

### Requirement: Desktop MCP server

The `doglog mcp` command SHALL run an MCP server over stdio that controls every open Studio window on the computer. Agent control MUST always be on, with no setting to turn it off. Only the user's own account MUST be able to reach a Studio window this way, and Studio MUST NOT listen on the network. Listing commands MUST work without Studio open. When a command needs a window and none is open, the server MUST open one and run the command once it's ready.

#### Scenario: Studio isn't open

- **GIVEN** no Studio window is open
- **WHEN** an agent calls `dashboard_create`
- **THEN** Studio opens and shows the new dashboard

#### Scenario: Another user on the same computer

- **GIVEN** two OS users are logged in to one computer
- **WHEN** one of them runs `doglog mcp`
- **THEN** it can only reach their own Studio windows

### Requirement: Target a window

On desktop, every command that acts on a window SHALL take an optional window ID, defaulting to the most recently focused window. `window_list` MUST list each window's ID, when it was last focused, which dashboard it shows, its active source, and whether it's focused. `window_update` MUST be able to show a dashboard in a window and bring it to the front.

#### Scenario: Several windows open

- **GIVEN** two Studio windows are open, and the user last used the one showing `match_q42.wpilog`
- **WHEN** an agent calls `source_get` without a window ID
- **THEN** it gets that window's source

#### Scenario: Agent picks a window

- **GIVEN** the user tells the agent to use "the window with the Drivetrain dashboard"
- **WHEN** the agent calls `window_list`
- **THEN** it can match the window by the dashboard it shows

### Requirement: Version compatibility

Studio SHALL track an agent API version that changes only when commands change incompatibly. When a window's API version differs from the running MCP server's, commands to that window MUST fail with an error telling the user to restart the doglog MCP server. Matching versions MUST keep working across Studio updates.

#### Scenario: Studio updated with a new API version

- **GIVEN** an agent's `doglog mcp` server started before Studio updated to a new API version
- **WHEN** the agent calls a command
- **THEN** it fails and says to restart the doglog MCP server

#### Scenario: Studio updated with the same API version

- **GIVEN** an agent's `doglog mcp` server started before Studio updated without changing the API version
- **WHEN** the agent calls a command
- **THEN** it works

### Requirement: Terminal commands

The `doglog` command SHALL offer every agent command as `doglog <resource> <action>`, ex. `doglog pane create`. Top-level inputs MUST be flags, and nested inputs MUST be given with `--json`, as JSON inline, from a file with `@path`, or from standard input with `-`. Output MUST be readable text by default and the command's JSON result with `--json-output`. Commands MUST target windows the same way the MCP server does, and help MUST work without Studio open.

#### Scenario: Create a dashboard from a file

- **GIVEN** `layout.json` describes a dashboard layout
- **WHEN** an agent runs `doglog dashboard create --json @layout.json`
- **THEN** Studio shows the new dashboard

#### Scenario: Help without Studio open

- **GIVEN** no Studio window is open
- **WHEN** the user runs `doglog --help`
- **THEN** it lists the commands without opening Studio

### Requirement: Agent instructions

Studio SHALL give agents short instructions as the MCP server's instructions, which are also the description in `doglog --help`. They MUST explain what agents can do with Studio, how dashboards are structured, and that wpilog-parser is for analyzing data.

#### Scenario: Agent connects

- **WHEN** an agent connects to the doglog MCP server
- **THEN** it receives the same instructions `doglog --help` shows

### Requirement: Add Studio to agents

`doglog mcp install` and buttons in the System section of Settings SHALL add the doglog MCP server to the coding agents installed on the user's computer, using each agent's own command or install link. The config MUST run `doglog` by its absolute path, since agents opened from the desktop may not have it in their PATH.

#### Scenario: Add to Claude Code

- **GIVEN** Claude Code is installed
- **WHEN** the user runs `doglog mcp install`
- **THEN** Claude Code can use the doglog MCP server

#### Scenario: Add to an agent from Settings

- **GIVEN** the `doglog` command and Codex are installed
- **WHEN** the user clicks Add to Codex in Settings
- **THEN** Codex can use the doglog MCP server

### Requirement: MCP config in Settings

Settings SHALL show the MCP server config so the user can add it to other agents by hand. Settings MUST show neither the config nor the agent buttons until the `doglog` command is installed for that copy of Studio.

#### Scenario: Agent without an installer

- **GIVEN** an agent that has no command or link to add MCP servers
- **WHEN** the user opens Settings
- **THEN** they can copy the MCP server config to add it themselves
