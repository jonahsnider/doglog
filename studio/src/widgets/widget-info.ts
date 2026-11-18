// What there is to know about each widget type besides how it's drawn: its accepted entries, roles, and options.
// Kept apart from React so agent command schemas can use it in Node, see `@/agent`. `@/widgets/registry` adds the rest.
import type { EntryKind } from '../data/entry-kind.ts';

/** Entry kinds that can be bound to widgets */
export type BindableKind = Exclude<EntryKind, 'unsupported'>;

/** Every bindable kind but Mechanism2d, which only the robot widget can draw */
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
		speeds: { id: 'speeds', label: 'Chassis speeds' },
		heading: { id: 'heading', label: 'Heading' },
	},
	field: {
		shape: { id: 'shape', label: 'Shape' },
		path: { id: 'path', label: 'Path' },
		points: { id: 'points', label: 'Points' },
		point: { id: 'point', label: 'Point' },
		ghost: { id: 'ghost', label: 'Ghost' },
		robot: { id: 'robot', label: 'Robot' },
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
	readonly kind: 'choice';
	/** Saved in dashboards, don't change it */
	readonly id: string;
	/** Shown in the widget options, ex. `Orientation` */
	readonly label: string;
	/** IDs are saved in dashboards, don't change them */
	readonly choices: readonly { readonly id: string; readonly label: string }[];
	/** The choice's ID when it isn't picked, or isn't inferred */
	readonly default: string;
	/** Any choice can be picked besides `choices`, ex. the user's own robot projects. Picked ones are kept even if they aren't found. */
	readonly openChoices?: true;
};

/** The Driver Station's joystick ports */
export const controllerPorts = [0, 1, 2, 3, 4, 5] as const;

/** The options of each widget that has them, see `WidgetType.options` */
export const widgetOptions = {
	field: {
		orientation: {
			kind: 'choice',
			id: 'orientation',
			label: 'Orientation',
			choices: [
				{ id: 'blue-left', label: 'Blue left' },
				{ id: 'red-left', label: 'Red left' },
			],
			default: 'blue-left',
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
			choices: [{ id: 'swerve', label: 'Simple swerve' }],
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
	},
} as const satisfies Record<string, Record<string, WidgetOptionInfo>>;

export type WidgetInfo = {
	/** Saved in dashboards, don't change it */
	readonly id: string;
	/** Shown in the pane header and widget picker, ex. `Values table` */
	readonly name: string;
	/** What the widget shows and how, for agents */
	readonly description: string;
	/** Kinds of entries that can be bound, none for widgets that don't show entries (ex. the notepad) */
	readonly accepts: readonly BindableKind[];
	/** Every role a binding can take, see `widgetRoles` */
	readonly roles: readonly Role[];
	readonly options: readonly WidgetOptionInfo[];
};

/** Every widget type, in the order they're listed in the widget picker */
export const widgetInfos = [
	{
		id: 'graph',
		name: 'Graph',
		description:
			'Plots entries over time. Numbers go on the left or right axis (`left`, `right`), or are shown as colored bands (`discrete`); booleans and strings can only be bands. A number goes on the right axis when its unit measures something else than the left axis’s.',
		accepts: ['number', 'boolean', 'string'],
		roles: Object.values(widgetRoles.graph),
		options: [],
	},
	{
		id: 'field',
		name: 'Field',
		description:
			'The FRC field seen from above. Pose2d and Pose3d can be a `robot`, `ghost` (ex. a setpoint), or `point`; the first pose is the robot and later ones ghosts. Translations are a `point`. Pose and translation arrays are `points` or a `path` (inferred from names like `path` or `trajectory`). Rectangle2d and Ellipse2d (and arrays of them) are a `shape`. A single robot, ghost, or point can be connected to another binding to draw lines from it, ex. from the robot to the AprilTags it sees.',
		accepts: ['struct', 'struct[]'],
		roles: Object.values(widgetRoles.field),
		options: Object.values(widgetOptions.field),
	},
	{
		id: 'robot',
		name: 'Robot',
		description:
			'The robot in 2D or 3D. Mechanism2d entries are drawn on a plane of the robot: `side` (XZ, the default), `front` (YZ), or `top` (XY). A Pose3d[] entry places the parts of a robot project’s CAD model (`parts`). The `view` option defaults to 2D when only a mechanism is bound. The `robot` option is `swerve` (a simple swerve robot) or the name of a robot project the user added on their device.',
		accepts: ['mechanism2d', 'struct[]'],
		roles: Object.values(widgetRoles.robot),
		options: Object.values(widgetOptions.robot),
	},
	{
		id: 'values-table',
		name: 'Values table',
		description: 'A table of the bound entries’ values at the timeline cursor. Accepts every kind but Mechanism2d.',
		accepts: valueKinds,
		roles: [],
		options: [],
	},
	{
		id: 'console',
		name: 'Console',
		description:
			'Text logged over time, like a terminal. Starts with WPILib’s console output (`/console`) and Driver Station messages (`/messages`) bound.',
		accepts: ['string'],
		roles: [],
		options: [],
	},
	{
		id: 'swerve',
		name: 'Swerve',
		description:
			'A swerve drive seen from above. Roles follow the entry type: SwerveModuleState[] or SwerveModuleVelocity[] are `states`, SwerveModulePosition[] are `positions`, ChassisSpeeds or ChassisVelocities are `speeds`, and a Rotation2d or number is the `heading`.',
		accepts: ['number', 'struct', 'struct[]'],
		roles: Object.values(widgetRoles.swerve),
		options: [],
	},
	{
		id: 'controller',
		name: 'Controller',
		description:
			'A Driver Station controller’s buttons and sticks. Doesn’t take entries: pick the joystick port with the `controller` option. The `layout` option is inferred from the controller’s name.',
		accepts: [],
		roles: [],
		options: Object.values(widgetOptions.controller),
	},
	{
		id: 'notepad',
		name: 'Notepad',
		description: 'Notes the user types, the same notes in every notepad. Doesn’t take entries.',
		accepts: [],
		roles: [],
		options: [],
	},
] as const satisfies readonly WidgetInfo[];

export type WidgetTypeId = (typeof widgetInfos)[number]['id'];
