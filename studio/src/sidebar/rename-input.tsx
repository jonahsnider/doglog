import { TextInput } from '@astryxdesign/core/TextInput';
import { type ComponentType, type SVGProps, useRef, useState } from 'react';
import { type Dashboard, renameDashboard } from '@/dashboards/dashboards';
import { dashboardName, suggestDashboardName } from '@/dashboards/label';
import { isEnterKey } from '@/lib/keyboard';

/** Takes the place of a dashboard's row while it's renamed, saving the name when it loses focus */
export function RenameInput({
	dashboard,
	icon,
	onDone,
}: {
	dashboard: Dashboard;
	icon: ComponentType<SVGProps<SVGSVGElement>>;
	onDone: () => void;
}) {
	const [initialName] = useState(() => dashboardName(dashboard));
	const [name, setName] = useState(initialName);
	const cancelled = useRef(false);
	return (
		<TextInput
			label="Dashboard name"
			isLabelHidden
			value={name}
			onChange={setName}
			placeholder={suggestDashboardName(dashboard.layout)}
			startIcon={icon}
			hasAutoFocus
			onFocus={(event) => {
				if (event.target instanceof HTMLInputElement) {
					event.target.select();
				}
			}}
			onBlur={() => {
				// An unchanged suggested name isn't saved, so it keeps following the dashboard's contents
				if (!cancelled.current && name !== initialName) {
					renameDashboard(dashboard.id, name);
				}
				onDone();
			}}
			onKeyDown={(event) => {
				if (isEnterKey(event)) {
					event.currentTarget.blur();
				} else if (event.key === 'Escape') {
					cancelled.current = true;
					event.currentTarget.blur();
				}
			}}
		/>
	);
}
