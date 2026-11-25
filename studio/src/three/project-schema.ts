// The `doglog.jsonc` (or `doglog.json`) file at the root of a robot project. Its JSON Schema is published at
// /doglog.schema.json for editors to validate it with, see `vite.config.ts`. Only Zod here, so the build can import it.
import * as z from 'zod';

const transform = z
	.strictObject({
		x: z.number().optional().describe("Meters toward the robot's front"),
		y: z.number().optional().describe("Meters toward the robot's left"),
		z: z.number().optional().describe('Meters up'),
		roll: z.number().optional().describe('Degrees about the X axis'),
		pitch: z.number().optional().describe('Degrees about the Y axis, positive points the front down'),
		yaw: z.number().optional().describe('Degrees about the Z axis, positive turns the front left'),
	})
	.describe('Like a WPILib Transform3d, rotations are applied as roll, then pitch, then yaw about the fixed axes');

/** A path inside the project's folder, ex. `cad/robot.glb` */
const modelPath = z
	.string()
	.min(1)
	.refine(
		(path) => !/^(?:[/\\]|[a-z]:)/iu.test(path) && !path.split(/[/\\]/u).includes('..'),
		'must be a path inside the project folder',
	)
	.describe('A glTF binary (.glb) file, relative to the project folder');

const robot = z
	.strictObject({
		name: z
			.string()
			.min(1)
			.describe("Shown in DogLog Studio's Robot option, and used to find the robot on other devices"),
		model: modelPath.describe("The robot's body, a glTF binary (.glb) file relative to the project folder"),
		mount: transform
			.optional()
			.describe("Moves every model from the CAD's coordinates to the robot's, whose origin is its center on the floor"),
		parts: z
			.array(
				z.strictObject({
					model: modelPath,
					origin: transform
						.optional()
						.describe("The pose of the part's pivot in robot coordinates, where the CAD placed it"),
				}),
			)
			.optional()
			.describe('Parts moved by a Pose3d[] entry, the pose at each index places the part at the same index'),
	})
	.describe('A robot to show in DogLog Studio');

export const projectSchema = z.strictObject({
	$schema: z.string().optional(),
	robots: z
		.array(robot)
		.min(1)
		.refine(
			(robots) => new Set(robots.map(({ name }) => name)).size === robots.length,
			'each robot needs a different name',
		)
		.describe('The robots to show in DogLog Studio, ex. a competition robot and its practice robot'),
});
