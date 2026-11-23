import VideoIcon from 'lucide-react/icons/video';
import { use, useState } from 'react';
import { ControlTooltip } from '@/components/control-tooltip';
import {
	Menu,
	MenuCheckboxItem,
	MenuGroup,
	MenuGroupLabel,
	MenuPopup,
	MenuSeparator,
	MenuTrigger,
} from '@/components/ui/menu';
import { cn } from '@/lib/utils';
import { FollowContext } from '@/widgets/legend/follow-context';
import { type DriverStation, driverStationKey, driverStationLabel, driverStations } from '@/three/field-poses';
import type { WidgetBinding } from '@/widgets/widget-type';

/**
 * Picks how the camera follows a robot or ghost. `follow` is `robot` while the camera moves with it, a driver
 * station's key while it follows from there, and `off` otherwise.
 */
export function FollowPicker({ binding, follow }: { binding: WidgetBinding; follow: string }) {
	const controls = use(FollowContext);
	// Read when the menu opens, instead of at every cursor move
	const [robotStation, setRobotStation] = useState<DriverStation>();
	// Unchecking the current choice stops following
	const pick = (station: DriverStation | undefined) => (checked: boolean) => {
		if (checked) {
			controls?.follow(binding.id, station);
		} else {
			controls?.stop();
		}
	};
	const following = follow !== 'off';
	return (
		<Menu
			onOpenChange={(open) => {
				if (open) {
					setRobotStation(controls?.robotStation());
				}
			}}
		>
			<ControlTooltip
				label={following ? 'Following with the camera' : 'Follow with the camera'}
				render={
					<MenuTrigger
						disabled={binding.hidden}
						className={cn(
							'-mx-0.5 flex shrink-0 cursor-pointer items-center rounded-sm p-0.5 text-muted-foreground outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 data-popup-open:bg-accent data-popup-open:text-accent-foreground',
							following && 'text-foreground',
						)}
						aria-label={`Follow ${binding.name}`}
					/>
				}
			>
				<VideoIcon className={cn('size-3.5', following && 'fill-current')} />
			</ControlTooltip>
			<MenuPopup align="end">
				<MenuCheckboxItem checked={follow === 'robot'} onCheckedChange={pick(undefined)} closeOnClick>
					Follow
				</MenuCheckboxItem>
				<MenuSeparator />
				<MenuGroup>
					<MenuGroupLabel>From driver station</MenuGroupLabel>
					{driverStations.map((station) => (
						<MenuCheckboxItem
							key={driverStationKey(station)}
							checked={follow === driverStationKey(station)}
							onCheckedChange={pick(station)}
							closeOnClick
						>
							{driverStationLabel(station)}
							{robotStation && driverStationKey(robotStation) === driverStationKey(station) && (
								<span className="text-muted-foreground"> (robot’s)</span>
							)}
						</MenuCheckboxItem>
					))}
				</MenuGroup>
			</MenuPopup>
		</Menu>
	);
}
