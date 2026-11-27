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

/** A CAN device as HOOT logs name it, its model and its ID from 0 to 62, ex. `TalonFX-11` */
const deviceKey = /^[A-Za-z0-9]+-(?:[0-9]|[1-5][0-9]|6[0-2])$/u;

const devices = z
	.record(
		z
			.string()
			.regex(/^[^/]+$/u, "can't have a /")
			.describe("The CAN bus, ex. `rio` or a CANivore's name"),
		z
			.record(
				z.string().regex(deviceKey, 'must be a model and an ID from 0 to 62, ex. TalonFX-11'),
				z
					.string()
					.regex(/^[^/]+(?:\/[^/]+)*$/u, "can't start or end with a /, or have // in it")
					// Renamed devices would share entries with the device it's named like
					.refine((name) => !deviceKey.test(name.split('/')[0]!), "can't start with a model and an ID")
					.describe('The name of the device in DogLog Studio, a `/` groups devices, ex. `Shooter/Left`'),
			)
			.describe('The CAN devices on the bus, by model and ID, ex. `TalonFX-11`'),
	)
	.superRefine((buses, context) => {
		const names = Object.values(buses).flatMap((bus) => Object.values(bus));
		const seen = new Set<string>();
		for (const name of names) {
			if (seen.has(name)) {
				context.addIssue({ code: 'custom', message: `names two devices ${name}` });
				return;
			}
			seen.add(name);
		}
		const group = names.find((name) => names.some((other) => other.startsWith(`${name}/`)));
		if (group !== undefined) {
			const inside = names.find((other) => other.startsWith(`${group}/`))!;
			context.addIssue({ code: 'custom', message: `can't name a device ${group} and another ${inside}` });
		}
	})
	.describe("Names for the robot's CAN devices in HOOT logs, by CAN bus, then by model and ID");

const robot = z
	.strictObject({
		name: z
			.string()
			.min(1)
			.describe("Shown in DogLog Studio's Robot option, and used to find the robot on other devices"),
		model: modelPath
			.optional()
			.describe(
				"The robot's body, a glTF binary (.glb) file relative to the project folder, the swerve drivebase is drawn without one",
			),
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
		devices: devices.optional(),
	})
	.refine(({ model, parts }) => model !== undefined || parts === undefined, {
		message: 'parts need a model for the robot',
		path: ['parts'],
	})
	.describe('A robot to show in DogLog Studio');

/** A robot's names for its CAN devices, by CAN bus, then by model and ID, ex. `{ rio: { 'TalonFX-11': 'Shooter/Left' } }` */
export type DeviceNames = z.infer<typeof devices>;

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
