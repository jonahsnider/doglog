import { useDroppable } from '@dnd-kit/react';
import { useSelector } from '@tanstack/react-store';
import * as stylex from '@stylexjs/stylex';
import DatabaseIcon from 'lucide-react/icons/database';
import ListPlusIcon from 'lucide-react/icons/list-plus';
import TriangleAlertIcon from 'lucide-react/icons/triangle-exclamation-point';
import { Component, type ReactNode, Suspense, use } from 'react';
import { shortcuts } from '@/commands/shortcuts';
import { InlineShortcut } from '@/components/shortcut';
import { Button } from '@astryxdesign/core/Button';
import {
	connectBindings,
	disconnectBindings,
	setBindingPick,
	setBindingRole,
	toggleBindingHidden,
} from '@/widgets/bindings';
import { DashboardIdContext, DashboardLayoutContext, updateLayout } from '@/dashboards/panes';
import { useSource } from '@/data/source';
import { sourceList, sourcesStore } from '@/data/source-store';
import { type EntryDropData, entryDragType, type WidgetBindings, WidgetBindingsContext } from '@/entries/drag';
import { startEditing } from '@/entries/editing';
import { DropFeedback } from '@/panes/drop-feedback';
import { GraphControls } from '@/widgets/graph/graph-controls';
import { WidgetEmpty, WidgetLoading } from '@/widgets/widget-empty';
import { setWidgetOption } from '@/widgets/options';
import { pinName } from '@/widgets/source-entries';
import type { OptionValues, WidgetBinding, WidgetType } from '@/widgets/widget-type';

const styles = stylex.create({
	view: { position: 'relative', height: '100%' },
	scroller: { height: '100%', overflow: 'auto' },
});

/** Renders a widget with its bindings, handles the shared empty and "no data" states, and shows where dragged entries will be dropped */
export function WidgetView({
	dashboardId,
	paneId,
	type,
	bindings,
	options,
}: {
	dashboardId: string;
	paneId: string;
	type: WidgetType;
	bindings: readonly WidgetBinding[];
	options: OptionValues;
}) {
	const source = useSource();
	const openPins = sourceList(useSelector(sourcesStore)).map((open) => pinName(open));
	const dashboardLayout = use(DashboardLayoutContext);
	// Accepts every entry so rejected ones can explain why they can't be dropped. Entries from this widget are reordered by dropping them on each other instead.
	const { ref } = useDroppable<EntryDropData>({
		id: paneId,
		accept: (draggable) => draggable.type === entryDragType && draggable.data['paneId'] !== paneId,
		data: { paneId },
	});
	const widgetBindings: WidgetBindings = {
		paneId,
		bindings,
		setRole: (bindingId, role) =>
			updateLayout(dashboardId, (layout) => setBindingRole(layout, paneId, bindingId, role)),
		connect: (sourceId, targetId) =>
			updateLayout(dashboardId, (layout) => connectBindings(layout, paneId, sourceId, targetId)),
		disconnect: (sourceId, targetId) =>
			updateLayout(dashboardId, (layout) => disconnectBindings(layout, paneId, sourceId, targetId)),
		toggleHidden: (bindingId) => updateLayout(dashboardId, (layout) => toggleBindingHidden(layout, paneId, bindingId)),
		setColor: (bindingId, color) =>
			updateLayout(dashboardId, (layout) => setBindingPick(layout, paneId, bindingId, 'color', color)),
		setRobot: (bindingId, robot) =>
			updateLayout(dashboardId, (layout) => setBindingPick(layout, paneId, bindingId, 'robot', robot)),
		setCamera: (bindingId, camera) =>
			updateLayout(dashboardId, (layout) => setBindingPick(layout, paneId, bindingId, 'camera', camera)),
	};
	const setOption = (id: string, value: string | undefined) =>
		updateLayout(dashboardId, (layout) => setWidgetOption(layout, paneId, id, value));
	const widget = (
		<type.component
			bindings={bindings}
			options={options}
			setOption={setOption}
			layout={dashboardLayout}
			paneId={paneId}
		/>
	);

	let content: ReactNode;
	if (type.rendersEmpty === true) {
		content = widget;
	} else if (bindings.length === 0) {
		content = (
			<WidgetEmpty
				icon={<ListPlusIcon aria-hidden />}
				title="No entries"
				description="Drag entries here from the entry browser."
			>
				<Button
					label="Add entries"
					data-edit-entries
					className="capture-invisible"
					endContent={<InlineShortcut hotkey={shortcuts.editEntries} />}
					onClick={() => startEditing(dashboardId, paneId)}
				/>
				{type.id === 'graph' && <GraphControls />}
			</WidgetEmpty>
		);
	} else if (!source) {
		content = <WidgetEmpty icon={<DatabaseIcon />} title="No data" description="Open a log or connect to a robot." />;
	} else if (bindings.every((binding) => binding.entry === undefined)) {
		const description = noDataDescription(bindings, openPins);
		content = <WidgetEmpty icon={<DatabaseIcon />} title="No data" description={description} />;
	} else {
		content = widget;
	}

	return (
		<div ref={ref} {...stylex.props(styles.view)}>
			<WidgetBindingsContext value={widgetBindings}>
				<div {...stylex.props(styles.scroller)}>
					{/* A widget that crashes only replaces itself, and tries again when its entries or options change */}
					<WidgetErrorBoundary resetKey={bindings}>
						<Suspense
							fallback={<WidgetLoading label={`Loading ${type.name}`} hasVisibleLabel={false} isCapturePending />}
						>
							<DashboardIdContext value={dashboardId}>{content}</DashboardIdContext>
						</Suspense>
					</WidgetErrorBoundary>
				</div>
			</WidgetBindingsContext>
			<DropFeedback paneId={paneId} type={type} bindings={bindings} />
		</div>
	);
}

type ErrorBoundaryState = { error: Error | undefined; resetKey: unknown };

/** Shows a widget's error instead of the widget, until the user tries again or `resetKey` changes */
class WidgetErrorBoundary extends Component<{ resetKey: unknown; children: ReactNode }, ErrorBoundaryState> {
	override state: ErrorBoundaryState = { error: undefined, resetKey: this.props.resetKey };

	static getDerivedStateFromError(error: unknown): Partial<ErrorBoundaryState> {
		return { error: error instanceof Error ? error : new Error('Unknown error') };
	}

	static getDerivedStateFromProps(props: { resetKey: unknown }, state: ErrorBoundaryState): ErrorBoundaryState | null {
		return props.resetKey === state.resetKey ? null : { error: undefined, resetKey: props.resetKey };
	}

	override render() {
		const { error } = this.state;
		if (error === undefined) {
			return this.props.children;
		}
		return (
			<WidgetEmpty icon={<TriangleAlertIcon />} title="Something went wrong" description={error.message}>
				<Button label="Try again" onClick={() => this.setState({ error: undefined })} />
			</WidgetEmpty>
		);
	}
}

/** Why a widget has no data: the source all its bindings are pinned to isn't open or doesn't have them, or no visible source does */
function noDataDescription(bindings: readonly WidgetBinding[], openPins: readonly string[]): string {
	const names = new Set(bindings.map((binding) => binding.name));
	const what = names.size === 1 ? bindings[0]!.name : "any of this widget's entries";
	const pins = new Set(bindings.map((binding) => binding.pin));
	const [pin] = pins;
	if (pins.size === 1 && pin !== undefined) {
		return openPins.includes(pin) ? `${pin} doesn't have ${what}.` : `${pin} isn't open.`;
	}
	return `No visible source has ${what}.`;
}
