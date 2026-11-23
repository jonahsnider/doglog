import SlidersHorizontalIcon from 'lucide-react/icons/sliders-horizontal';
import { Button } from '@/components/ui/button';
import { Menu, MenuCheckboxItem, MenuPopup, MenuTrigger } from '@/components/ui/menu';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { updateSettings, useSettings } from '@/settings';

export function TimelineOptions({
	compact,
	onOpenChange,
}: {
	compact: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const { timelineAlerts, timelineCompress, timelineShifts } = useSettings();
	return (
		<Menu onOpenChange={onOpenChange}>
			<Tooltip>
				<TooltipTrigger
					render={
						<MenuTrigger
							render={
								<Button
									variant="ghost"
									size="icon-sm"
									className={cn('pointer-coarse:size-11 capture:hidden', compact && 'ms-auto')}
									aria-label="Timeline options"
								/>
							}
						/>
					}
				>
					<SlidersHorizontalIcon />
				</TooltipTrigger>
				<TooltipPopup>Timeline options</TooltipPopup>
			</Tooltip>
			<MenuPopup align="end">
				<MenuCheckboxItem
					checked={timelineAlerts}
					onCheckedChange={(checked) => updateSettings({ timelineAlerts: checked })}
				>
					Show alerts
				</MenuCheckboxItem>
				<MenuCheckboxItem
					checked={timelineShifts}
					onCheckedChange={(checked) => updateSettings({ timelineShifts: checked })}
				>
					Show active hub shifts
				</MenuCheckboxItem>
				<MenuCheckboxItem
					checked={timelineCompress}
					onCheckedChange={(checked) => updateSettings({ timelineCompress: checked })}
				>
					Skip idle time
				</MenuCheckboxItem>
			</MenuPopup>
		</Menu>
	);
}
