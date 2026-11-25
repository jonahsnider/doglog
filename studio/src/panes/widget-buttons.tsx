import * as stylex from '@stylexjs/stylex';
import ListTodoIcon from 'lucide-react/icons/list-todo';
import { shortcuts } from '@/commands/commands';
import { updateLayout } from '@/dashboards/panes';
import { toggleEditing } from '@/entries/editing';
import type { Widget } from '@/panes/layout';
import { PaneButton } from '@/panes/pane-button';
import { WidgetOptions } from '@/panes/widget-options';
import { setWidgetOption } from '@/widgets/options';
import { bindsEntries, type WidgetBinding, type WidgetType } from '@/widgets/widget-type';

const styles = stylex.create({
	contents: { display: 'contents' },
});

/** A pane header's buttons for its widget: Edit entries, and Widget options for widgets with options */
export function WidgetButtons({
	dashboardId,
	paneId,
	type,
	widget,
	bindings,
	editing,
}: {
	dashboardId: string;
	paneId: string;
	type: WidgetType;
	widget: Widget | undefined;
	bindings: readonly WidgetBinding[];
	/** Whether the entry browser is editing this widget's entries */
	editing: boolean;
}) {
	return (
		<>
			{bindsEntries(type) && (
				// Marked so pressing it doesn't also switch editing to this pane, see `focusEditingPane()`
				<span data-edit-entries {...stylex.props(styles.contents)}>
					<PaneButton
						label={editing ? 'Stop editing entries' : 'Edit entries'}
						shortcut={shortcuts.editEntries}
						pressed={editing}
						onClick={() => toggleEditing(dashboardId, paneId)}
						icon={ListTodoIcon}
					/>
				</span>
			)}
			{(type.options?.length ?? 0) > 0 && (
				<WidgetOptions
					paneId={paneId}
					type={type}
					widget={widget}
					bindings={bindings}
					onOptionChange={(id, value) =>
						updateLayout(dashboardId, (layout) => setWidgetOption(layout, paneId, id, value))
					}
				/>
			)}
		</>
	);
}
