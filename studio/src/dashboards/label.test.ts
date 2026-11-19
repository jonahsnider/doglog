import { expect, test } from 'vite-plus/test';
import { createWidget } from '../widgets/bindings.ts';
import { mainWidgetType, suggestDashboardName } from './label.ts';
import { getWidgetType } from '../widgets/registry.ts';
import { createPane, type PaneNode, resizeSplit, splitPane, type Widget } from '../panes/layout.ts';

function layoutOf(...widgets: Widget[]): PaneNode {
	let layout: PaneNode = { ...createPane(), widget: widgets[0] };
	for (const widget of widgets.slice(1)) {
		layout = splitPane(layout, layout.id, 'row', { ...createPane(), widget });
	}
	return layout;
}

function table(...entryNames: string[]): Widget {
	return createWidget(getWidgetType('values-table')!, entryNames);
}

test('names a dashboard after the groups of its entries, most entries first', () => {
	const layout = layoutOf(
		table('/Robot/Intake/Speed'),
		table('/Robot/Localization/Pose', '/Robot/Localization/Heading'),
	);
	expect(suggestDashboardName(layout)).toBe('Localization & Intake');
	expect(suggestDashboardName(layoutOf(table('/Robot/Arm/Angle'), table('/Robot/Intake/Speed')))).toBe('Arm & Intake');
});

test('skips segments that group entries', () => {
	expect(suggestDashboardName(layoutOf(table('/RealOutputs/Arm/Angle')))).toBe('Arm');
	expect(suggestDashboardName(layoutOf(table('/AdvantageKit/RealOutputs/Arm/Angle')))).toBe('Arm');
	expect(suggestDashboardName(layoutOf(table('/NT:/AdvantageKit/RealOutputs/Arm/Angle')))).toBe('Arm');
	expect(suggestDashboardName(layoutOf(table('/NT:/limelight-right/tx')))).toBe('Limelight right');
	expect(suggestDashboardName(layoutOf(table('/Robot/Tunable/Shooter/kP', '/Robot/Shooter/Velocity')))).toBe('Shooter');
});

test('writes topics in sentence case, keeping acronyms', () => {
	expect(suggestDashboardName(layoutOf(table('/Robot/HopperManager/State')))).toBe('Hopper manager');
	expect(suggestDashboardName(layoutOf(table('/Robot/shooter_hood/Angle')))).toBe('Shooter hood');
	expect(suggestDashboardName(layoutOf(table('/Robot/Swerve Module/Speed')))).toBe('Swerve module');
	expect(suggestDashboardName(layoutOf(table('/Robot/systemStats/Voltage')))).toBe('System stats');
	expect(suggestDashboardName(layoutOf(table('/NT:/FMSInfo/IsRedAlliance')))).toBe('FMS info');
	expect(suggestDashboardName(layoutOf(table('/AdvantageKit/DriverStation/Enabled')))).toBe('Driver Station');
	expect(suggestDashboardName(layoutOf(table('/DS:enabled', '/DS:autonomous')))).toBe('Driver Station');
});

test('keeps the spelling of known names', () => {
	expect(suggestDashboardName(layoutOf(table('/Robot/CANcoder/Position')))).toBe('CANcoder');
	expect(suggestDashboardName(layoutOf(table('/Robot/TopLeds/Color')))).toBe('Top LEDs');
	expect(suggestDashboardName(layoutOf(table('/NT:/photonvision/front/hasTarget')))).toBe('PhotonVision');
	expect(suggestDashboardName(layoutOf(table('/Robot/navX/Yaw')))).toBe('navX');
	expect(suggestDashboardName(layoutOf(table('/Robot/SystemCore/Temperature')))).toBe('Systemcore');
	expect(suggestDashboardName(layoutOf(table('/Robot/Candles/Color')))).toBe('Candles');
});

test('combines topics that only differ in case', () => {
	expect(suggestDashboardName(layoutOf(table('/Robot/Debug/Speed', '/Robot/DEBUG/Zone')))).toBe('Debug');
});

test('lists three groups, then counts the rest', () => {
	expect(suggestDashboardName(layoutOf(table('/A/x', '/B/x', '/C/x')))).toBe('A, B, & C');
	expect(suggestDashboardName(layoutOf(table('/A/x', '/B/x', '/B/y', '/C/x', '/D/x', '/D/y')))).toBe('B, D, & 2 more');
});

test('capitalizes top level entries', () => {
	expect(suggestDashboardName(layoutOf(table('/console')))).toBe('Console');
	expect(suggestDashboardName(layoutOf(table('/messages', '/Robot/Arm/Angle')))).toBe('Messages & Arm');
});

test("names widgets with no entries or only their type's default entries after their type", () => {
	const console = createWidget(getWidgetType('console')!, ['/messages', '/console']);
	expect(suggestDashboardName(layoutOf(console, table()))).toBe('Console & Values table');
});

test('names an empty dashboard', () => {
	expect(suggestDashboardName(createPane())).toBe('Empty dashboard');
});

test('picks the widget type in the biggest pane, the first one on ties', () => {
	const console = { type: 'console', config: {} };
	const layout = layoutOf(console, table());
	expect(mainWidgetType(layout)?.id).toBe('console');
	expect(mainWidgetType(resizeSplit(layout, layout.id, [0.3, 0.7]))?.id).toBe('values-table');
	expect(mainWidgetType(createPane())).toBeUndefined();
});
