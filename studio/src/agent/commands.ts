// The commands agents can run in Studio, with their inputs. Only Zod and other modules without React or the DOM here, so
// `pnpm agent:schema` can export them in Node for the desktop app's MCP server and `doglog` command. Handlers are in
// `@/agent/handlers`.
import * as z from 'zod';
import { entryKinds } from '../data/entry-kind.ts';
import {
	bindingId,
	color,
	dashboardId,
	direction,
	empty,
	entryName,
	hidden,
	robot,
	layoutSchema,
	savePath,
	sourceTime,
	paneId,
	settingsSchema,
	size,
	widgetSchema,
	widgetWithBindings,
} from './schemas.ts';

/** Changes only when commands change incompatibly, the desktop MCP server refuses windows with another version */
export const agentApiVersion = 1;

export const agentInstructions = `DogLog Studio shows FRC robot logs (WPILOG files) and live robot data on dashboards. With these commands you can build and arrange dashboards for the user, save images of them to check how they look, save videos of them to share, open a log or connect to the robot, move the timeline cursor to a moment, and change settings.

Each dashboard's layout is a tree: a split puts its children side by side (\`row\`) or stacks them (\`column\`), and each leaf is a pane. A pane shows one widget, or nothing. A widget's bindings are the entries it shows, bound by entry name. \`dashboard_get\` returns the IDs other commands take, and points out bindings that won't show what you meant.

Commands never return entry values. To analyze data, ex. to find when something happened, read the log with the wpilog-parser library (and its skill, if you have it), then show the user that moment with \`timeline_update\`.`;

export type AgentPlatform = 'web' | 'desktop';

type CommandDefinition = {
	description: string;
	input: z.ZodObject;
	/** Input on the web, when some of `input` can't work there */
	webInput?: z.ZodObject;
	/** Platforms the command is offered on, all of them by default */
	platforms?: readonly AgentPlatform[];
	/** Handled by the desktop MCP server instead of a window */
	bridge?: true;
	/** Captures images, only offered where Studio supports capture */
	capture?: true;
};

const dashboardReturns = 'Returns the dashboard like `dashboard_get`.';

/** Every agent command by name, `<resource>_<action>` */
const commands = {
	window_list: {
		description:
			"List open Studio windows: each one's ID, when it was last focused, the dashboard it shows, its source, and whether it's focused. Use a window's ID as the `window` input of other commands to target it, otherwise they act on the most recently focused window.",
		input: empty,
		platforms: ['desktop'],
		bridge: true,
	},
	window_update: {
		description: 'Show a dashboard in the window, bring the window to the front, or both.',
		input: z.strictObject({
			dashboardId: dashboardId.optional().describe('The dashboard to show, from `dashboard_list`'),
			focus: z.boolean().optional().describe('Whether to bring the window to the front'),
		}),
		platforms: ['desktop'],
	},
	dashboard_list: {
		description:
			'List dashboards in sidebar order, with whether each is shared with everyone connected to the robot, and which one is shown.',
		input: empty,
	},
	dashboard_get: {
		description:
			"Get a dashboard: its name, layout, and each pane's widget, options, and bindings, with the IDs other commands take. `problems` point out what keeps a widget from showing what was meant, ex. an entry missing from the source, an entry type the widget doesn't accept, or a role that doesn't fit. Sizes are each pane or split's share of its parent split.",
		input: z.strictObject({ dashboardId }),
	},
	dashboard_capture: {
		description:
			"Save a PNG image of a dashboard, or one of its panes, as the user would copy it: with the window's theme, sizes, and timeline cursor, and the timeline below a whole dashboard. Shows the dashboard, restoring the window if it's minimized, and waits for its widgets to load first. Returns the image's path, open it to check that widgets look as meant.",
		input: z.strictObject({
			dashboardId,
			paneId: paneId.optional().describe('Only this pane. Left out, the whole dashboard.'),
			path: savePath('the PNG'),
		}),
		platforms: ['desktop'],
		capture: true,
	},
	dashboard_record: {
		description:
			"Save an MP4 video of a dashboard from `start` to `end`, the same video Export video saves: 30 frames a second at the source's original timing, with the window's theme and sizes, and the timeline below. Shows the dashboard in video export mode while it saves, where the user sees its progress and can cancel, then returns the window to how it was. Saving can take about as long as the video. Returns the video's path.",
		input: z.strictObject({
			dashboardId,
			start: sourceTime,
			end: sourceTime.describe(`${sourceTime.description} After \`start\`.`),
			path: savePath('the MP4'),
		}),
		platforms: ['desktop'],
		capture: true,
	},
	dashboard_create: {
		description: `Create a dashboard at the top of the list and show it, optionally with a whole layout of panes, widgets, and bindings. An invalid layout creates nothing. At most 4 panes fit side by side, or stacked. ${dashboardReturns}`,
		input: z.strictObject({
			name: z.string().optional().describe("Left out, a name is suggested from the dashboard's contents"),
			layout: layoutSchema.optional().describe('Left out, the dashboard has one empty pane'),
		}),
	},
	dashboard_update: {
		description: `Rename a dashboard, or share it or stop sharing it with everyone connected to the robot. Stopping sharing deletes it for everyone else and gives it a new ID. ${dashboardReturns}`,
		input: z.strictObject({
			dashboardId,
			name: z.string().optional().describe('A blank name goes back to suggesting one from its contents'),
			shared: z.boolean().optional(),
		}),
	},
	dashboard_delete: {
		description:
			'Close a dashboard, like the user closing it. The user can reopen it. Closing a shared dashboard deletes it for everyone.',
		input: z.strictObject({ dashboardId }),
	},
	dashboard_duplicate: {
		description: `Copy a dashboard, the copy goes right below it and is shown. ${dashboardReturns}`,
		input: z.strictObject({ dashboardId }),
	},
	dashboard_combine: {
		description: `Put dashboards' panes side by side in the first of them, in order, close the others, and show it. Fails when more than 4 panes would be side by side. ${dashboardReturns}`,
		input: z.strictObject({
			dashboardIds: z.array(z.string()).min(2).describe('Dashboard IDs, from `dashboard_list`'),
		}),
	},
	pane_create: {
		description: `Split a pane to add one after it (to its right, or below it), optionally showing a widget. At most 4 panes fit side by side, or stacked. Returns the new pane's ID and the dashboard like \`dashboard_get\`.`,
		input: z.strictObject({
			dashboardId,
			paneId: paneId.describe('The pane to split, from `dashboard_get`'),
			direction: direction
				.optional()
				.describe(
					"`row` adds the pane to the right, `column` below. Left out, it splits along the pane's longer side, as when the user adds a widget.",
				),
			widget: widgetWithBindings.optional().describe('Left out, the new pane is empty'),
		}),
	},
	pane_update: {
		description: `Change a pane's widget, its options, or the pane's size. Changing the widget type keeps the bindings the new type accepts, like the user changing it. ${dashboardReturns}`,
		input: z.strictObject({
			dashboardId,
			paneId,
			widget: widgetSchema(false)
				.nullable()
				.optional()
				.describe(
					'The widget type and options to pick. `null` empties the pane. Bindings are changed with `binding_*`.',
				),
			size: size.optional(),
		}),
	},
	pane_move: {
		description: `Move a pane beside another pane of the same dashboard. The panes around its old place take its space. ${dashboardReturns}`,
		input: z.strictObject({
			dashboardId,
			paneId,
			targetPaneId: z.string().describe('The pane to put it beside, from `dashboard_get`'),
			side: z.enum(['left', 'right', 'top', 'bottom']).describe('Which side of the target pane it goes on'),
		}),
	},
	pane_delete: {
		description: `Remove a pane, the panes beside it take its space. Removing the only pane leaves an empty pane. ${dashboardReturns}`,
		input: z.strictObject({ dashboardId, paneId }),
	},
	binding_create: {
		description: `Bind entries to a pane's widget by name, after its other bindings. An entry can be bound more than once, ex. to show it two ways. Returns the new bindings' IDs and the dashboard like \`dashboard_get\`.`,
		input: z.strictObject({
			dashboardId,
			paneId,
			bindings: z
				.array(
					z.strictObject({
						entry: entryName,
						role: z
							.string()
							.optional()
							.describe(
								"How the widget shows the entry, one of the widget type's roles (see `dashboard_create`). Left out, it's inferred as when the user drops the entry on the widget.",
							),
						color: color.optional(),
						hidden: hidden.optional(),
					}),
				)
				.min(1),
		}),
	},
	binding_update: {
		description: `Change a binding's role, color, hidden state, robot, or connections. ${dashboardReturns}`,
		input: z.strictObject({
			dashboardId,
			bindingId,
			role: z.string().optional().describe("One of the widget type's roles that fits the entry"),
			color: color.nullable().optional().describe(`${color.description} \`null\` lets the widget pick again.`),
			hidden: hidden.optional(),
			robot: robot.nullable().optional().describe(`${robot.description}. \`null\` uses the first robot's again.`),
			connectedFrom: z
				.array(z.string())
				.optional()
				.describe(
					'IDs of the bindings in the same field widget to draw lines from, replacing the current ones. Each must be a single robot, ghost, or point.',
				),
		}),
	},
	binding_delete: {
		description: `Unbind an entry from its widget. ${dashboardReturns}`,
		input: z.strictObject({ dashboardId, bindingId }),
	},
	entry_list: {
		description:
			"List the active source's entries, with each one's name, type, kind, and metadata (ex. its unit). Never returns values.",
		input: z.strictObject({
			name: z.string().optional().describe('Only entries whose name contains this, ignoring case'),
			kind: z
				.enum(entryKinds)
				.optional()
				.describe("Only entries of this kind. `unsupported` entries can't be shown by widgets."),
		}),
	},
	source_get: {
		description:
			"Get the active source: a log file, or a live connection to the robot or simulator, with its status and how many entries it has. `null` when there's none.",
		input: empty,
	},
	source_update: {
		description:
			"Open a WPILOG file, or connect to the robot from the `robotTarget` setting (or the simulator when the robot isn't reachable). Returns once the log is loaded or the connection is made, like `source_get`.",
		input: z.strictObject({
			path: z
				.string()
				.min(1)
				.optional()
				.describe('Absolute path of a WPILOG file to open. Left out, connects to the robot instead.'),
		}),
		webInput: empty,
	},
	source_delete: {
		description: 'Close the active source, leaving none.',
		input: empty,
	},
	source_export: {
		description:
			"Save everything the live session received as a WPILOG file, to read with wpilog-parser, whether or not the live session is shown. Its times are on the robot's clock, so they line up with the robot's own logs but not `timeline_get`. Returns the file's path.",
		input: z.strictObject({
			path: savePath('the file'),
		}),
		platforms: ['desktop'],
	},
	timeline_get: {
		description:
			"Get the timeline cursor and the source's time range, in seconds on the source's clock: a log's timestamps (microseconds, as wpilog-parser reads them) divided by 1,000,000. Studio shows times relative to `start`.",
		input: empty,
	},
	timeline_update: {
		description:
			"Move the timeline cursor so the user's dashboards show that moment. Stops following live data. Returns the timeline like `timeline_get`.",
		input: z.strictObject({
			time: sourceTime,
		}),
	},
	settings_get: {
		description: "Get the settings from Studio's Settings page.",
		input: empty,
	},
	settings_update: {
		description: "Change settings from Studio's Settings page. Returns every setting like `settings_get`.",
		input: settingsSchema,
	},
} as const satisfies Record<string, CommandDefinition>;

type CommandName = keyof typeof commands;

/** What each command does with its validated input. `window_list` is answered by the desktop MCP server, which knows every window. */
export type Handlers = {
	[Name in Exclude<CommandName, 'window_list'>]: (input: z.output<(typeof commands)[Name]['input']>) => unknown;
};

const definitions: Readonly<Record<string, CommandDefinition>> = commands;

/** The commands offered on a platform, with the input they take there */
export function platformCommands(platform: AgentPlatform) {
	return Object.entries(definitions).flatMap(([name, command]) =>
		command.platforms === undefined || command.platforms.includes(platform)
			? [
					{
						name,
						description: command.description,
						input: (platform === 'web' ? command.webInput : undefined) ?? command.input,
						bridge: command.bridge === true,
						capture: command.capture === true,
					},
				]
			: [],
	);
}
