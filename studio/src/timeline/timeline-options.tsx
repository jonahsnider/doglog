import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuDivider,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSubMenu,
} from '@astryxdesign/core/DropdownMenu';
import GaugeIcon from 'lucide-react/icons/gauge';
import SlidersHorizontalIcon from 'lucide-react/icons/sliders-horizontal';
import * as stylex from '@stylexjs/stylex';
import { updateSettings, useSettings } from '@/settings';
import { playbackSpeeds, setSpeed } from '@/timeline/timeline';

const styles = stylex.create({
	// Ends the first row when the controls wrap
	compact: { marginInlineStart: 'auto' },
});

export function TimelineOptions({
	compact,
	speed,
	onOpenChange,
}: {
	compact: boolean;
	/** Offers the playback speed too, for phones where the timeline bar has no room for its own button */
	speed: number | undefined;
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
				xstyle: compact && styles.compact,
			}}
			hasChevron={false}
			alignment="end"
			placement="above"
			onOpenChange={onOpenChange}
			className="capture-hidden"
		>
			{speed !== undefined && (
				<DropdownMenuSubMenu label="Playback speed" description={`${speed}x`} icon={GaugeIcon}>
					<DropdownMenuRadioGroup
						label="Playback speed"
						value={String(speed)}
						onChange={(value) => setSpeed(Number(value))}
					>
						{playbackSpeeds.map((value) => (
							<DropdownMenuRadioItem key={value} value={String(value)} label={`${value}x`} />
						))}
					</DropdownMenuRadioGroup>
				</DropdownMenuSubMenu>
			)}
			{speed !== undefined && <DropdownMenuDivider />}
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
