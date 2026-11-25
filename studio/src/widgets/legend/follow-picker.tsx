import { DropdownMenuCheckboxItem, DropdownMenuDivider, DropdownMenuGroup } from '@astryxdesign/core/DropdownMenu';
import { Tooltip } from '@astryxdesign/core/Tooltip';
import * as stylex from '@stylexjs/stylex';
import VideoIcon from 'lucide-react/icons/video';
import { use, useState } from 'react';
import { FollowContext } from '@/widgets/legend/follow-context';
import { LegendMenu } from '@/widgets/legend/legend-menu';
import { type DriverStation, driverStationKey, driverStationLabel, driverStations } from '@/three/field-poses';
import type { WidgetBinding } from '@/widgets/widget-type';

const styles = stylex.create({
	icon: { width: 14, height: 14, marginBlock: 2 },
	following: { fill: 'currentColor' },
});

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
		<Tooltip content={following ? 'Following with the camera' : 'Follow with the camera'}>
			<LegendMenu
				label={`Follow ${binding.name}`}
				isActive={following}
				isDisabled={binding.hidden}
				onOpenChange={(open) => {
					if (open) {
						setRobotStation(controls?.robotStation());
					}
				}}
				trigger={<VideoIcon {...stylex.props(styles.icon, following && styles.following)} />}
			>
				<DropdownMenuCheckboxItem
					label="Follow"
					value={follow === 'robot'}
					onChange={pick(undefined)}
					hasCloseOnSelect
				/>
				<DropdownMenuDivider />
				<DropdownMenuGroup title="From driver station">
					{driverStations.map((station) => (
						<DropdownMenuCheckboxItem
							key={driverStationKey(station)}
							label={driverStationLabel(station)}
							description={
								robotStation && driverStationKey(robotStation) === driverStationKey(station) ? 'The robot’s' : undefined
							}
							value={follow === driverStationKey(station)}
							onChange={pick(station)}
							hasCloseOnSelect
						/>
					))}
				</DropdownMenuGroup>
			</LegendMenu>
		</Tooltip>
	);
}
