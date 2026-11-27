import { DropdownMenuItem, DropdownMenuRadioItem } from '@astryxdesign/core/DropdownMenu';
import { addRobotProject, cantAddRobotProjects, removeRobotProject, useRobotProjects } from '@/three/robot-projects';

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
		const name = await addRobotProject();
		if (name !== undefined) {
			pick(name);
		}
	};
	return (
		<>
			<DropdownMenuItem
				label="Add project…"
				description={cantAddRobotProjects}
				isDisabled={cantAddRobotProjects !== undefined}
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
