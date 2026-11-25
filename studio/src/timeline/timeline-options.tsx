import { DropdownMenu, DropdownMenuCheckboxItem } from '@astryxdesign/core/DropdownMenu';
import SlidersHorizontalIcon from 'lucide-react/icons/sliders-horizontal';
import * as stylex from '@stylexjs/stylex';
import { updateSettings, useSettings } from '@/settings';

const styles = stylex.create({
	// Ends the first row when the controls wrap
	compact: { marginInlineStart: 'auto' },
});

export function TimelineOptions({
	compact,
	onOpenChange,
}: {
	compact: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const { timelineAlerts, timelineCompress, timelineShifts } = useSettings();
	return (
		<DropdownMenu
			button={{
				label: 'Timeline options',
				isIconOnly: true,
				icon: <SlidersHorizontalIcon />,
				variant: 'ghost',
				tooltip: 'Timeline options',
			}}
			hasChevron={false}
			alignment="end"
			placement="above"
			onOpenChange={onOpenChange}
			className="capture-hidden"
			xstyle={compact && styles.compact}
		>
			<DropdownMenuCheckboxItem
				label="Show alerts"
				value={timelineAlerts}
				onChange={(checked) => updateSettings({ timelineAlerts: checked })}
			/>
			<DropdownMenuCheckboxItem
				label="Show active hub shifts"
				value={timelineShifts}
				onChange={(checked) => updateSettings({ timelineShifts: checked })}
			/>
			<DropdownMenuCheckboxItem
				label="Skip idle time"
				value={timelineCompress}
				onChange={(checked) => updateSettings({ timelineCompress: checked })}
			/>
		</DropdownMenu>
	);
}
