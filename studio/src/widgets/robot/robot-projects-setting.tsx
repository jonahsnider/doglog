import { Button } from '@astryxdesign/core/Button';
import { ListItem } from '@astryxdesign/core/List';
import FolderIcon from 'lucide-react/icons/folder';
import PlusIcon from 'lucide-react/icons/plus';
import { SettingsGroup } from '@/components/settings-group';
import {
	addRobotProject,
	cantAddRobotProjects,
	folderName,
	removeRobotProject,
	useRobotProjectFolders,
} from '@/three/robot-projects';

const iconSize = 20;

/** The robot projects the user added, to add and remove them without a robot widget */
export function RobotProjectsSetting() {
	const folders = useRobotProjectFolders();
	if (folders === undefined) {
		return null;
	}

	return (
		<SettingsGroup>
			{folders.map((robots) => {
				const [first] = robots;
				const name = folderName(first);
				return (
					<ListItem
						key={first.name}
						startContent={<FolderIcon aria-hidden="true" size={iconSize} />}
						label={name}
						// A fragment wraps on narrow screens, where a string description is cut off
						description={<>{robots.map((robot) => robot.name).join(', ')}</>}
						endContent={
							<Button
								label="Remove"
								aria-label={`Remove ${name}`}
								variant="ghost"
								onClick={() => void removeRobotProject(first.name)}
							/>
						}
					/>
				);
			})}
			<ListItem
				startContent={<PlusIcon aria-hidden="true" size={iconSize} />}
				label="Add a project"
				// A fragment wraps on narrow screens, where a string description is cut off
				description={<>Choose or drop your robot project&apos;s folder, like your robot code</>}
				endContent={
					<Button
						label="Add project"
						isDisabled={cantAddRobotProjects !== undefined}
						tooltip={cantAddRobotProjects}
						onClick={() => void addRobotProject()}
					/>
				}
			/>
		</SettingsGroup>
	);
}
