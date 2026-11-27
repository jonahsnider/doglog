// Input schemas shared by agent commands, see `@/agent/commands`. Only Zod and other modules without React or the DOM.
import * as z from 'zod';
import { chartCount, themePresets, themes } from '../theme/choices.ts';
import { type WidgetInfo, type WidgetOptionInfo, widgetInfos, type WidgetTypeId } from '../widgets/widget-info.ts';

export const dashboardId = z.string().describe("The dashboard's ID, from `dashboard_list`");
export const paneId = z.string().describe("The pane's ID, from `dashboard_get`");
export const bindingId = z.string().describe("The binding's ID, from `dashboard_get`");

export const direction = z
	.enum(['row', 'column'])
	.describe('`row` puts panes side by side, left to right. `column` stacks them, top to bottom.');

export const size = z
	.number()
	.gt(0)
	.lt(1)
	.describe(
		"Share of its split's width (in a row) or height (in a column), from 0 to 1. Left out, panes share what's left evenly.",
	);

export const entryName = z
	.string()
	.min(1)
	.describe('Full entry name, ex. `/Robot/Drive/Pose`. Entries missing from the source can be bound too.');

export const color = z
	.int()
	.min(0)
	.max(chartCount - 1)
	.describe(`One of the theme's ${chartCount} chart colors, by index. Left out, the widget picks one.`);

export const hidden = z.boolean().describe('Listed in the legend but not drawn');

export const robot = z
	.string()
	.min(1)
	.describe(
		"A robot or ghost's robot in 3D: `swerve` (the built-in swerve drivebase) or the name of a robot from a project the user added on their device",
	);

function optionSchema(option: WidgetOptionInfo) {
	if (option.kind === 'text') {
		return z
			.string()
			.regex(option.pattern)
			.nullable()
			.optional()
			.describe(`${option.label}: ${option.description} \`null\` unsets it.`);
	}
	const ids = option.choices.map((choice) => choice.id);
	const choice = option.openChoices
		? z
				.string()
				.min(1)
				.describe(`\`${ids.join('`, `')}\`, or another choice from the user's device`)
		: z.enum(ids);
	return choice
		.nullable()
		.optional()
		.describe(`${option.label}, \`${option.default}\` by default. \`null\` goes back to inferring it or the default.`);
}

function bindingSchema(info: WidgetInfo) {
	const binding = z.strictObject({ entry: entryName, color: color.optional(), hidden: hidden.optional() });
	const [first, ...others] = info.roles.map((role) => role.id);
	const withRole =
		first === undefined
			? binding
			: binding.extend({
					role: z
						.enum([first, ...others])
						.optional()
						.describe(
							"How the widget shows the entry. Left out, it's inferred from the entry and the bindings before it.",
						),
				});
	return info.id === 'field'
		? withRole.extend({
				robot: robot.optional().describe(`${robot.description}. Left out, it's the first robot's.`),
				connectedFrom: z
					.array(z.int().nonnegative())
					.optional()
					.describe(
						"Indexes of this widget's bindings (from 0) to draw lines from, ex. from the robot to seen AprilTags. Each must be a single robot, ghost, or point.",
					),
			})
		: withRole;
}

type BindingInput = {
	entry: string;
	role?: string | undefined;
	color?: number | undefined;
	hidden?: boolean | undefined;
	connectedFrom?: number[] | undefined;
	robot?: string | undefined;
};

export type WidgetInput = {
	type: WidgetTypeId;
	options?: Record<string, string | null | undefined> | undefined;
	bindings?: BindingInput[] | undefined;
};

/** A widget of each type, as a discriminated union on `type` so each type's options and roles are listed */
export function widgetSchema(withBindings: boolean): z.ZodType<WidgetInput> {
	const [first, ...others] = widgetInfos.map((info) => {
		const options = Object.fromEntries(info.options.map((option) => [option.id, optionSchema(option)]));
		const bindings = z
			.array(bindingSchema(info))
			.optional()
			.describe(
				`Entries to show, in order. Accepted kinds: ${info.accepts.join(', ')}. Left out, the widget starts like one the user adds.`,
			);
		return z
			.strictObject({
				type: z.literal(info.id),
				...(info.options.length > 0 && { options: z.strictObject(options).optional() }),
				...(withBindings && info.accepts.length > 0 && { bindings }),
			})
			.describe(`${info.name}: ${info.description}`);
	});
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- TypeScript can't infer the shapes built from `widgetInfos`
	return z.discriminatedUnion('type', [first!, ...others]) as unknown as z.ZodType<WidgetInput>;
}

export const widgetWithBindings = widgetSchema(true);

export type LayoutInput =
	| { kind: 'pane'; widget?: WidgetInput | undefined; size?: number | undefined }
	| { kind: 'split'; direction: 'row' | 'column'; size?: number | undefined; children: LayoutInput[] };

export const layoutSchema: z.ZodType<LayoutInput> = z
	.discriminatedUnion('kind', [
		z.strictObject({
			kind: z.literal('pane'),
			widget: widgetWithBindings.optional().describe('Left out, the pane is empty'),
			size: size.optional(),
		}),
		z.strictObject({
			kind: z.literal('split'),
			direction,
			size: size.optional(),
			get children() {
				return z.array(layoutSchema).min(2).describe('Panes or splits, left to right or top to bottom');
			},
		}),
	])
	.describe('A pane, or a split of panes and splits. No IDs, Studio assigns them.');

export const settingsSchema = z.strictObject({
	theme: z.enum(themes).optional(),
	themePreset: z
		.enum(themePresets)
		.optional()
		.describe(
			"Theme color: DogLog maroon (`doglog`), match13 blue, FrogLog green and blue (`froglog`), HogLog pastel pink (`hoglog`), `neutral` gray, `frc-colors` for the team's colors from frc-colors.com (the Cloud team's number, or `robotTarget`'s team number), or `custom` for `themeColor`",
		),
	themeColor: z
		.string()
		.regex(/^#[\da-f]{6}$/iu)
		.optional()
		.describe('Hex color the `custom` theme preset is generated from, ex. `#1c1816`'),
	highContrast: z
		.boolean()
		.optional()
		.describe("Whether to use high contrast colors even when the system doesn't ask for more contrast"),
	reduceMotion: z
		.boolean()
		.optional()
		.describe("Whether to skip animations even when the system doesn't ask to reduce motion"),
	reduceTransparency: z
		.boolean()
		.optional()
		.describe(
			"Whether the desktop app's window frame is solid even when the system doesn't ask to reduce transparency",
		),
	name: z
		.string()
		.optional()
		.describe("The user's name, shown to others in shared dashboards. Blank shows an anonymous name."),
	robotTarget: z
		.string()
		.optional()
		.describe(
			"Team number or IP address of the robot, ex. `581` or `10.5.81.2`. Connecting uses it, or the Cloud team's default team number while it's blank.",
		),
	mediaControls: z
		.boolean()
		.optional()
		.describe('Whether media keys and the system media controls play, pause, and seek logs'),
	naturalScrolling: z
		.boolean()
		.optional()
		.describe("Whether scrolling the timeline follows natural scrolling, in browsers that don't report it"),
});

export const sourceTime = z
	.number()
	.describe(
		"Seconds on the source's clock, see `timeline_get`. Times outside the source's range go to its start or end.",
	);

/** Where a command saves `file`, ex. `the PNG` */
export function savePath(file: string) {
	return z
		.string()
		.min(1)
		.optional()
		.describe(`Absolute path to save ${file} to. Left out, it goes in a new file in the temporary folder.`);
}

export const empty = z.strictObject({});
