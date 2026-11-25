import { DropdownMenuItem, DropdownMenuRadioItem } from '@astryxdesign/core/DropdownMenu';
import { toastManager } from '@/components/toast';
import { addRobotProject, canAddRobotProjects, removeRobotProject, useRobotProjects } from '@/three/robot-projects';

/** The robots of the projects the user added */
export function RobotChoices() {
	return (
		<>
			{(useRobotProjects() ?? []).map((project) => (
				<DropdownMenuRadioItem key={project.name} value={project.name} label={project.name} />
			))}
		</>
	);
}

export function RobotCommands({ value, pick }: { value: string; pick: (value: string | undefined) => void }) {
	const added = useRobotProjects()?.some((project) => project.name === value) === true;
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
			<DropdownMenuItem
				label="Add project…"
				description={canAddRobotProjects ? undefined : 'Needs Chrome, Edge, or the desktop app'}
				isDisabled={!canAddRobotProjects}
				onClick={() => void add()}
			/>
			{added && (
				<DropdownMenuItem
					label="Remove project"
					variant="destructive"
					onClick={() => {
						pick(undefined);
						void removeRobotProject(value);
					}}
				/>
			)}
		</>
	);
}
