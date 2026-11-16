import { expect, test } from 'vite-plus/test';
import { mainWidgetType, suggestDashboardName } from './dashboard-label.ts';
import { createPane, type PaneNode, resizeSplit, splitPane, type Widget } from './pane-layout.ts';

function layoutOf(...widgets: Widget[]): PaneNode {
	let layout: PaneNode = { ...createPane(), widget: widgets[0] };
	for (const widget of widgets.slice(1)) {
		layout = splitPane(layout, layout.id, 'row', { ...createPane(), widget });
	}
	return layout;
}

function table(...entries: string[]): Widget {
	return { type: 'values-table', config: { entries } };
}

test('names a dashboard after the groups of its entries, in layout order', () => {
	const layout = layoutOf(
		table('/Robot/Localization/Pose', '/Robot/Localization/Heading'),
		table('/Robot/Intake/Speed'),
	);
	expect(suggestDashboardName(layout)).toBe('Localization & Intake');
});

test('lists three groups, then counts the rest', () => {
	expect(suggestDashboardName(layoutOf(table('/A/x', '/B/x', '/C/x')))).toBe('A, B & C');
	expect(suggestDashboardName(layoutOf(table('/A/x', '/B/x', '/C/x', '/D/x')))).toBe('A, B & 2 more');
});

test('capitalizes top level entries', () => {
	expect(suggestDashboardName(layoutOf(table('/console')))).toBe('Console');
	expect(suggestDashboardName(layoutOf(table('/messages', '/Robot/Arm/Angle')))).toBe('Messages & Arm');
});

test("names widgets with no entries or only their type's default entries after their type", () => {
	const console = { type: 'console', config: { entries: ['/messages', '/console'] } };
	expect(suggestDashboardName(layoutOf(console, table()))).toBe('Console & Values table');
});

test('names an empty dashboard', () => {
	expect(suggestDashboardName(createPane())).toBe('Empty dashboard');
});

test('picks the widget type in the biggest pane, the first one on ties', () => {
	const console = { type: 'console', config: {} };
	const layout = layoutOf(console, table());
	expect(mainWidgetType(layout)?.id).toBe('console');
	expect(mainWidgetType(resizeSplit(layout, layout.id, 0.3))?.id).toBe('values-table');
	expect(mainWidgetType(createPane())).toBeUndefined();
});
