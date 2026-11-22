import { expect, test } from 'vite-plus/test';
import { createDashboard, deleteDashboard, getDashboard, undoDashboard } from '@/dashboards/dashboards';
import { dropDashboardEntry } from '@/dashboards/panes';
import { DataSet } from '@/data/data-set';
import { setActiveData } from '@/data/data-store';
import { groupEntries } from '@/entries/edited-widget';
import { buildEntryTree, entryTreeView } from '@/entries/tree';
import { createPane, findPane } from '@/panes/layout';
import { createWidget, widgetBindings } from '@/widgets/bindings';
import { getWidgetType } from '@/widgets/registry';

test('dropping a collapsed group adds only new compatible entries in one undo step', async ({ onTestFinished }) => {
	const data = new DataSet(() => {});
	data.addEntry('/Arm/Angle', 'double');
	data.addEntry('/Arm/Enabled', 'boolean');
	data.addEntry('/Arm/Raw', 'protobuf');
	data.addEntry('/Arm/Wrist/Angle', 'double');
	data.addEntry('/Other', 'double');
	setActiveData(data);

	const pane = { ...createPane(), widget: createWidget(getWidgetType('graph')!, ['/Arm/Angle']) };
	const { id } = createDashboard('top', { layout: pane });
	onTestFinished(() => {
		deleteDashboard(id);
		setActiveData(undefined);
	});
	const view = entryTreeView(buildEntryTree(data.snapshot.list), [], '');
	const group = groupEntries(view.items).get('/Arm');
	const bound = () => widgetBindings(findPane(getDashboard(id)!.layout, pane.id)?.widget).map(({ name }) => name);

	dropDashboardEntry(id, { name: '/Arm', group }, { paneId: pane.id });
	await Promise.resolve();
	expect(bound()).toEqual(['/Arm/Angle', '/Arm/Enabled', '/Arm/Wrist/Angle']);

	undoDashboard(id);
	await Promise.resolve();
	expect(bound()).toEqual(['/Arm/Angle']);
});
