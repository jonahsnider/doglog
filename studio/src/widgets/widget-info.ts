// oxlint-disable max-lines -- Every widget type's info is kept together, it's mostly descriptions for agents
// What there is to know about each widget type besides how it's drawn: its accepted entries, roles, and options.
// Kept apart from React so agent command schemas can use it in Node, see `@/agent`. `@/widgets/registry` adds the rest.
import type { EntryKind } from '../data/entry-kind.ts';

export type BindableKind = Exclude<EntryKind, 'unsupported'>;

/** Every bindable kind but Mechanism2d, which only the robot and field widgets can draw */
const valueKinds: readonly BindableKind[] = [
	'number',
	'boolean',
	'string',
	'number[]',
	'boolean[]',
	'string[]',
	'struct',
	'struct[]',
];

type Role = { readonly id: string; readonly label: string };

/** The roles bindings can take in each widget, see `WidgetType.roles`. IDs are saved in dashboards, don't change them. */
export const widgetRoles = {
	graph: {
		left: { id: 'left', label: 'Left axis' },
		right: { id: 'right', label: 'Right axis' },
		discrete: { id: 'discrete', label: 'Bands' },
	},
	swerve: {
		states: { id: 'states', label: 'Module states' },
		positions: { id: 'positions', label: 'Module positions' },
		speeds: { id: 'speeds', label: 'Robot-relative speeds' },
		fieldSpeeds: { id: 'fieldSpeeds', label: 'Field-relative speeds' },
		heading: { id: 'heading', label: 'Heading' },
	},
	field: {
		shape: { id: 'shape', label: 'Shape' },
		path: { id: 'path', label: 'Path' },
		points: { id: 'points', label: 'Points' },
		point: { id: 'point', label: 'Point' },
		ghost: { id: 'ghost', label: 'Ghost' },
		robot: { id: 'robot', label: 'Robot' },
		camera: { id: 'camera', label: 'Camera' },
		// Only drawn in 3D, on a robot, like the robot widget's roles
		parts: { id: 'parts', label: 'Parts' },
		side: { id: 'side', label: 'XZ plane' },
		front: { id: 'front', label: 'YZ plane' },
		top: { id: 'top', label: 'XY plane' },
	},
	robot: {
		side: { id: 'side', label: 'XZ plane' },
		front: { id: 'front', label: 'YZ plane' },
		top: { id: 'top', label: 'XY plane' },
		parts: { id: 'parts', label: 'Parts' },
	},
} as const satisfies Record<string, Record<string, Role>>;

/** The parts of a `WidgetOption` that don't depend on the app, see there */
export type WidgetOptionInfo = {
	/** Saved in dashboards, don't change it */
	readonly id: string;
	/** Shown in the widget options, ex. `Orientation` */
	readonly label: string;
} & (ChoiceOptionInfo | TextOptionInfo);

type ChoiceOptionInfo = {
	readonly kind: 'choice';
	/** IDs are saved in dashboards, don't change them */
	readonly choices: readonly { readonly id: string; readonly label: string }[];
	/** The choice's ID when it isn't picked, or isn't inferred */
	readonly default: string;
	/** Any choice can be picked besides `choices`, ex. the user's own robot projects. Picked ones are kept even if they aren't found. */
	readonly openChoices?: true;
};

/** An option set to text, ex. the video widget's video. Its widget shows its control, see `WidgetOption.control`. */
type TextOptionInfo = {
	readonly kind: 'text';
	/** What the text is, for agents */
	readonly description: string;
	/** Text that isn't matched is ignored, as if the option wasn't set */
	readonly pattern: RegExp;
	/** The value when it isn't set, always empty */
	readonly default: '';
};

/** The Driver Station's joystick ports */
export const controllerPorts = [0, 1, 2, 3, 4, 5] as const;

/** The options of each widget that has them, see `WidgetType.options` */
export const widgetOptions = {
	field: {
		view: {
			kind: 'choice',
			id: 'view',
			label: 'View',
			choices: [
				{ id: '2d', label: '2D' },
				{ id: '3d', label: '3D' },
			],
			default: '2d',
		},
		coordinates: {
			kind: 'choice',
			id: 'coordinates',
			label: 'WPILib coordinates',
			choices: [
				{ id: 'blue-wall', label: '2026' },
				{ id: 'center', label: '2027' },
			],
			default: 'blue-wall',
		},
		orientation: {
			kind: 'choice',
			id: 'orientation',
			label: 'Orientation',
			choices: [
				{ id: 'blue-left', label: 'Blue left' },
				{ id: 'red-left', label: 'Red left' },
				{ id: 'blue-top', label: 'Blue top' },
				{ id: 'red-top', label: 'Red top' },
			],
			default: 'blue-left',
		},
		stagedGamePieces: {
			kind: 'choice',
			id: 'stagedGamePieces',
			label: 'Staged game pieces',
			choices: [
				{ id: 'shown', label: 'Shown' },
				{ id: 'hidden', label: 'Hidden' },
			],
			default: 'shown',
		},
		fieldBorder: {
			kind: 'choice',
			id: 'fieldBorder',
			label: 'Field border',
			choices: [
				{ id: 'solid', label: 'Solid' },
				{ id: 'see-through', label: 'See-through' },
			],
			default: 'solid',
		},
		fov: {
			kind: 'choice',
			id: 'fov',
			label: 'Field of view',
			choices: ['30', '45', '60', '75', '90'].map((id) => ({ id, label: `${id}°` })),
			default: '45',
		},
		robot: {
			kind: 'text',
			id: 'robot',
			label: 'Robot',
			description:
				'What robots and ghosts are drawn as in 3D when neither they nor the first robot pick a `robot`: `swerve` (the built-in swerve drivebase) or the name of a robot from a project the user added on their device. Set when the widget is added, to the robot the user picked last.',
			pattern: /\S/u,
			default: '',
		},
	},
	robot: {
		view: {
			kind: 'choice',
			id: 'view',
			label: 'View',
			choices: [
				{ id: '2d', label: '2D' },
				{ id: '3d', label: '3D' },
			],
			default: '3d',
		},
		robot: {
			kind: 'choice',
			id: 'robot',
			label: 'Robot',
			choices: [{ id: 'swerve', label: 'Swerve drivebase' }],
			default: 'swerve',
			openChoices: true,
		},
	},
	controller: {
		controller: {
			kind: 'choice',
			id: 'controller',
			label: 'Controller',
			choices: controllerPorts.map((port) => ({ id: String(port), label: String(port) })),
			default: '0',
		},
		layout: {
			kind: 'choice',
			id: 'layout',
			label: 'Layout',
			choices: [
				{ id: 'xbox', label: 'Xbox' },
				{ id: 'playstation', label: 'PlayStation' },
			],
			default: 'xbox',
		},
		axisValues: {
			kind: 'choice',
			id: 'axisValues',
			label: 'Show axis values',
			choices: [
				{ id: 'off', label: 'Off' },
				{ id: 'on', label: 'On' },
			],
			default: 'off',
		},
	},
	video: {
		video: {
			kind: 'text',
			id: 'video',
			label: 'Video',
			description:
				"A YouTube link, or the name of a video file on the user's device, ex. `qual12.mp4`. In the desktop app, an absolute path to a video file is accepted too, only its name is saved with the dashboard. Changing it should also set `sync`.",
			pattern: /\S/u,
			default: '',
		},
		sync: {
			kind: 'text',
			id: 'sync',
			label: 'Sync',
			description:
				'Lines the video up with the timeline as `<source seconds>=<video seconds>`, ex. `83=296.5` shows 4:56.50 in the video when the timeline cursor is at 1:23.00. Source seconds count from the start of the log or live session. Not set, the source and video start together.',
			pattern: /^\d+(?:\.\d+)?=\d+(?:\.\d+)?$/u,
			default: '',
		},
	},
	camera: {
		camera: {
			kind: 'text',
			id: 'camera',
			label: 'Camera',
			description: 'The name advertised by the live camera, not its stream URL.',
			pattern: /\S/u,
			default: '',
		},
		rotation: {
			kind: 'choice',
			id: 'rotation',
			label: 'Rotation',
			choices: [
				{ id: '0', label: '0°' },
				{ id: '90', label: '90°' },
				{ id: '180', label: '180°' },
				{ id: '270', label: '270°' },
			],
			default: '0',
		},
	},
} as const satisfies Record<string, Record<string, WidgetOptionInfo>>;

export type WidgetInfo = {
	/** Saved in dashboards, don't change it */
	readonly id: string;
	/** Shown in the pane header and widget picker, ex. `Swerve` */
	readonly name: string;
	/** What the widget shows and how, for agents */
	readonly description: string;
	/** Kinds of entries that can be bound, none for widgets that don't show entries (ex. the notepad) */
	readonly accepts: readonly BindableKind[];
	/** Every role a binding can take, see `widgetRoles` */
	readonly roles: readonly Role[];
	readonly options: readonly WidgetOptionInfo[];
	/** Entries bound to a newly added widget, ex. the console's `/console` and `/messages` */
	readonly defaultEntryNames?: readonly string[];
	/** Shown in the pane header and suggested dashboard names instead of `name`, ex. `Controller 2` */
	readonly title?: (options: Readonly<Record<string, string>>) => string;
};

/** Every widget type, in the order they're listed in the widget picker, see `widgetTypes` */
export const widgetInfos = [
	{
		id: 'graph',
		name: 'Graph',
		description:
			"Plots entries over time. Numbers go on the left or right axis (`left`, `right`), or are shown as colored bands (`discrete`); booleans and strings can only be bands. A number goes on the right axis when its unit measures something else than the left axis's.",
		accepts: ['number', 'boolean', 'string'],
		roles: Object.values(widgetRoles.graph),
		options: [],
	},
	{
		id: 'field',
		name: 'Field',
		description:
			"The FRC field, seen from above or in 3D (the `view` option, `2d` or `3d`). Pose2d and Pose3d can be a `robot`, `ghost` (ex. a setpoint), or `point`; the first pose is the robot and later ones ghosts. Translations are a `point`. Pose and translation arrays are `points` or a `path` (inferred from names like `path` or `trajectory`). Rectangle2d and Ellipse2d (and arrays of them) are a `shape`. A single robot, ghost, or point can be connected to another binding to draw lines from it, ex. from the robot to the AprilTags it sees. In 3D, a Pose3d[] can place a robot project's `parts` (inferred from names containing `component`), and Mechanism2d entries are drawn on a robot's `side` (XZ, the default), `front` (YZ), or `top` (XY) plane; connect them from a robot or ghost to attach them to it, or they're drawn on the only robot. Each robot and ghost binding can pick its `robot`, as in the robot widget's option, defaulting to the first robot's. The `view` option is inferred as 3D when a parts or mechanism binding is bound. The `coordinates` option is `blue-wall` (WPILib 2026, origin at the blue alliance wall) or `center` (WPILib 2027, origin at the center with +X toward blue), inferred from the WPILib version the robot published. The `orientation` option supports landscape (`blue-left`, `red-left`) and portrait (`blue-top`, `red-top`), and defaults to putting +X on the right, in 3D the camera starts turned the same way. The `stagedGamePieces` option (`shown` or `hidden`) draws the game pieces staged at the start of a match in 3D. In 3D, the `fieldBorder` option (`solid` or `see-through`) makes the guardrails and alliance walls mostly clear, and the `fov` option is the camera's vertical field of view in degrees (`30` to `90`, default `45`).",
		accepts: ['struct', 'struct[]', 'mechanism2d'],
		roles: Object.values(widgetRoles.field),
		options: Object.values(widgetOptions.field),
	},
	{
		id: 'robot',
		name: 'Robot',
		description:
			"The robot in 2D or 3D. Mechanism2d entries are drawn on a plane of the robot: `side` (XZ, the default), `front` (YZ), or `top` (XY). A Pose3d[] entry places the parts of a robot project's CAD model (`parts`). The `view` option defaults to 2D when only a mechanism is bound. The `robot` option is `swerve` (the built-in swerve drivebase) or the name of a robot from a project the user added on their device.",
		accepts: ['mechanism2d', 'struct[]'],
		roles: Object.values(widgetRoles.robot),
		options: Object.values(widgetOptions.robot),
	},
	{
		id: 'swerve',
		name: 'Swerve',
		description:
			'A swerve drive seen from above. Roles follow the entry type: SwerveModuleState[] or SwerveModuleVelocity[] are `states`, SwerveModulePosition[] are `positions`, ChassisSpeeds or ChassisVelocities are robot-relative `speeds` or field-relative `fieldSpeeds` (inferred from names containing `field`), and a Rotation2d, Pose2d, Pose3d, or number is the `heading`. When the heading comes from a pose shown on a field widget, the drawing turns to match that field.',
		accepts: ['number', 'struct', 'struct[]'],
		roles: Object.values(widgetRoles.swerve),
		options: [],
	},
	{
		id: 'histogram',
		name: 'Histogram',
		description:
			'Shows how the values of numeric entries are distributed over the time range graphs show, each entry a series in one histogram, with summary statistics for each.',
		accepts: ['number'],
		roles: [],
		options: [],
	},
	{
		id: 'table',
		name: 'Table',
		description: "A table of the bound entries' values at the timeline cursor. Accepts every kind but Mechanism2d.",
		accepts: valueKinds,
		roles: [],
		options: [],
	},
	{
		id: 'console',
		name: 'Console',
		description:
			"Text logged over time, like a terminal. Starts with WPILib's console output (`/console`) and Driver Station messages (`/messages`) bound.",
		accepts: ['string'],
		roles: [],
		options: [],
		defaultEntryNames: ['/console', '/messages'],
	},
	{
		id: 'controller',
		name: 'Controller',
		description:
			"A Driver Station controller's buttons and sticks. Doesn't take entries: pick the joystick port with the `controller` option. The `layout` option is inferred from the controller's name.",
		accepts: [],
		roles: [],
		options: Object.values(widgetOptions.controller),
		title: (options) => `Controller ${options['controller']}`,
	},
	{
		id: 'video',
		name: 'Video',
		description:
			"A video of the match that follows the timeline cursor for a log or live session, ex. the broadcast or a recording from the stands. Doesn't take entries: set the `video` and `sync` options. Each video widget has one video, use several for more angles.",
		accepts: [],
		roles: [],
		options: Object.values(widgetOptions.video),
	},
	{
		id: 'camera',
		name: 'Camera',
		description: 'Shows a live robot camera feed while following live data. Does not take entries or record frames.',
		accepts: [],
		roles: [],
		options: Object.values(widgetOptions.camera),
		title: ({ camera = '' }) => (camera === '' ? 'Camera' : camera),
	},
	{
		id: 'notepad',
		name: 'Notepad',
		description: "Notes the user types, shared by the notepads on one dashboard. Doesn't take entries.",
		accepts: [],
		roles: [],
		options: [],
	},
] as const satisfies readonly WidgetInfo[];

export type WidgetTypeId = (typeof widgetInfos)[number]['id'];

export type KnownWidgetInfo = WidgetInfo & { readonly id: WidgetTypeId };

export function getWidgetInfo(id: string): KnownWidgetInfo | undefined {
	return widgetInfos.find((info) => info.id === id);
}
