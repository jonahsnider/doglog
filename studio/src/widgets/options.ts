// A widget's options. Picked values are saved in its config's `options`, beside its bindings.
import * as z from 'zod';
import { findPane, type PaneNode, setPaneWidget, type Widget } from '@/panes/layout';
import type { OptionValues, WidgetBinding, WidgetOption, WidgetType } from '@/widgets/widget-type';

const configSchema = z
	.object({ options: z.record(z.string(), z.unknown()).catch({}) })
	.catch({ options: {} })
	.transform((config) => config.options);

function choiceSchema(option: WidgetOption) {
	if (option.kind === 'text') {
		return z.string().regex(option.pattern);
	}
	return option.openChoices
		? z.string().min(1)
		: z.string().refine((id) => option.choices.some((choice) => choice.id === id));
}

/** The choice picked for an option, `undefined` when none is, or the saved one isn't valid anymore */
export function pickedOption(widget: Widget | undefined, option: WidgetOption): string | undefined {
	return choiceSchema(option).safeParse(configSchema.parse(widget?.config)[option.id]).data;
}

/** The choice an option's Auto choice uses, `undefined` for options without one. `earlier` has the values of the options before it. */
export function inferredOption(
	option: WidgetOption,
	bindings: readonly WidgetBinding[],
	earlier: OptionValues,
): string | undefined {
	if (option.infer === undefined) {
		return undefined;
	}
	const inferred = option.infer(bindings, earlier);
	return inferred !== undefined && choiceSchema(option).safeParse(inferred).success ? inferred : option.default;
}

/** Every option's value as the widget uses it: the picked choice, or the inferred one, or the default */
export function optionValues(
	type: Pick<WidgetType, 'options'>,
	widget: Widget | undefined,
	bindings: readonly WidgetBinding[],
): OptionValues {
	const values: Record<string, string> = {};
	for (const option of type.options ?? []) {
		values[option.id] = pickedOption(widget, option) ?? inferredOption(option, bindings, values) ?? option.default;
	}
	return values;
}

/** The options a newly added widget starts with in `layout`, see `WidgetOption.initial` */
export function initialOptions(type: WidgetType, layout: PaneNode): Record<string, string> {
	return Object.fromEntries(
		(type.options ?? []).flatMap((option) => (option.initial ? [[option.id, option.initial(layout)]] : [])),
	);
}

/** Pick an option's value in a pane's widget, `undefined` goes back to Auto or the default */
export function setWidgetOption(layout: PaneNode, paneId: string, id: string, value: string | undefined): PaneNode {
	const widget = findPane(layout, paneId)?.widget;
	if (widget === undefined) {
		return layout;
	}

	const { options: _, ...rest } = z.record(z.string(), z.unknown()).catch({}).parse(widget.config);
	const { [id]: __, ...others } = configSchema.parse(widget.config);
	const options = value === undefined ? others : { ...others, [id]: value };
	return setPaneWidget(layout, paneId, {
		...widget,
		config: Object.keys(options).length > 0 ? { ...rest, options } : rest,
	});
}
