import { MenuItem, MenuRadioItem } from '@/components/ui/menu';
import { toastManager } from '@/components/ui/toast';
import { addRobotProject, canAddRobotProjects, removeRobotProject, useRobotProjects } from '@/three/robot-projects';

/** The robots of the projects the user added */
export function RobotChoices() {
	return (
		<>
			{useRobotProjects().map((project) => (
				<MenuRadioItem key={project.name} value={project.name} closeOnClick>
					{project.name}
				</MenuRadioItem>
			))}
		</>
	);
}

export function RobotCommands({ value, pick }: { value: string; pick: (value: string | undefined) => void }) {
	const added = useRobotProjects().some((project) => project.name === value);
	const add = async () => {
		try {
			const name = await addRobotProject();
			if (name !== undefined) {
				pick(name);
			}
		} catch (error) {
			toastManager.add({
				type: 'error',
				title: "Couldn't add the project",
				description: error instanceof Error ? error.message : String(error),
			});
		}
	};
	return (
		<>
			<MenuItem disabled={!canAddRobotProjects} onClick={() => void add()}>
				{canAddRobotProjects ? 'Add project…' : 'Add project… (needs Chrome, Edge, or the desktop app)'}
			</MenuItem>
			{added && (
				<MenuItem
					onClick={() => {
						pick(undefined);
						void removeRobotProject(value);
					}}
				>
					Remove project
				</MenuItem>
			)}
		</>
	);
}
