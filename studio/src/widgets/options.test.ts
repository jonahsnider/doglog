import NotebookPenIcon from 'lucide-react/icons/notebook-pen';
import { expect, test } from 'vite-plus/test';
import { createPane, findPane } from '@/panes/layout';
import { resolveBindings } from '@/widgets/bindings';
import { optionValues, setWidgetOption } from '@/widgets/options';
import type { WidgetOption, WidgetType } from '@/widgets/widget-type';

const layout: WidgetOption = {
	kind: 'choice',
	id: 'layout',
	label: 'Layout',
	choices: [
		{ id: 'xbox', label: 'Xbox' },
		{ id: 'ps4', label: 'PS4' },
	],
	default: 'xbox',
	infer: (bindings) => bindings[0]?.name,
};

const type: WidgetType = {
	id: 'test',
	name: 'Test',
	icon: NotebookPenIcon,
	hotkey: 'T',
	accepts: [],
	options: [layout],
	component: () => undefined,
};

const bound = (name: string) => resolveBindings(type, [{ id: 'a', name }], () => undefined);
const widget = (options?: unknown) => ({ type: 'test', config: { bindings: [], options } });

test('an option without a picked choice uses the inferred one', () => {
	expect(optionValues(type, widget(), bound('ps4'))).toEqual({ layout: 'ps4' });
});

test('inferred choices that are not one of the choices fall back to the default', () => {
	expect(optionValues(type, widget(), bound('switch'))).toEqual({ layout: 'xbox' });
});

test('a picked choice wins over the inferred one, unless it is not valid anymore', () => {
	expect(optionValues(type, widget({ layout: 'xbox' }), bound('ps4'))).toEqual({ layout: 'xbox' });
	expect(optionValues(type, widget({ layout: 'n64' }), bound('ps4'))).toEqual({ layout: 'ps4' });
	expect(optionValues(type, widget('invalid'), bound('ps4'))).toEqual({ layout: 'ps4' });
});

test('setting an option keeps the bindings, and unsetting it goes back to Auto', () => {
	const pane = { ...createPane(), widget: { type: 'test', config: { bindings: [{ id: 'a', name: 'ps4' }] } } };
	const picked = setWidgetOption(pane, pane.id, 'layout', 'xbox');
	expect(findPane(picked, pane.id)?.widget?.config).toEqual({
		bindings: [{ id: 'a', name: 'ps4' }],
		options: { layout: 'xbox' },
	});

	const unset = setWidgetOption(picked, pane.id, 'layout', undefined);
	expect(findPane(unset, pane.id)?.widget?.config).toEqual({ bindings: [{ id: 'a', name: 'ps4' }] });
});
