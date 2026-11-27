// oxlint-disable max-lines -- Reading both kinds of config shares their parts, and writing one from the other shares them too
// Reads a robot project's config, from `doglog.jsonc` (or `doglog.json`), or an AdvantageScope robot's `config.json`
import { type ParseError, parse, printParseErrorCode } from 'jsonc-parser';
import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import * as z from 'zod';
import { type DeviceNames, defaultRobotDimensions, projectSchema, type RobotDimensions } from '@/three/project-schema';
import { transformMatrix } from '@/three/poses';

/** A model file of a robot, and how it's placed */
type RobotPart = {
	/** Path in the project folder */
	readonly file: string;
	/** Where the model is drawn without a pose, where the CAD placed it */
	readonly rest: Matrix4;
	/** Moves the model to its pivot's frame, a logged pose then places that frame in the robot's coordinates */
	readonly zero: Matrix4;
};

export type RobotConfig = {
	readonly name: string;
	/** The robot's body, which doesn't move. Without one, the swerve drivebase is drawn. */
	readonly body: { readonly file: string; readonly transform: Matrix4 } | undefined;
	/** Parts moved by a `Pose3d[]` entry, in its order */
	readonly parts: readonly RobotPart[];
	/** Names for the robot's CAN devices in HOOT logs */
	readonly devices: DeviceNames;
	/** The robot's footprint with its bumpers, what the swerve drivebase and 2D robots are drawn as */
	readonly dimensions: RobotDimensions;
};

export class RobotConfigError extends Error {
	/** The project has no config at all, as opposed to one that isn't valid */
	readonly missing: boolean;

	constructor(message: string, missing = false) {
		super(message);
		this.missing = missing;
	}
}

/** Reads a file in the project folder, `undefined` when it doesn't exist */
export type ReadProjectFile = (path: string) => Promise<ArrayBuffer | undefined>;

const decoder = new TextDecoder();

function lineOf(text: string, offset: number): number {
	return text.slice(0, offset).split('\n').length;
}

function describeIssue(issue: z.core.$ZodIssue, file: string): string {
	const path = issue.path.join('.');
	if (issue.code === 'unrecognized_keys') {
		const key = [...issue.path, issue.keys[0]].join('.');
		return `${key} in ${file} isn't a known key`;
	}
	// Ex. a device ID out of range, the key's own issue says what's wrong with it
	const { message: raw } = issue.code === 'invalid_key' ? (issue.issues[0] ?? issue) : issue;
	const message = raw.replace(/^Invalid input: /u, '');
	return path === '' ? `${file}: ${message}` : `${path} in ${file}: ${message}`;
}

function readDogLogConfig(text: string, file: string): RobotConfig[] {
	const errors: ParseError[] = [];
	const json: unknown = parse(text, errors, { allowTrailingComma: true });
	const [error] = errors;
	if (error) {
		throw new RobotConfigError(
			`${file} isn't valid JSON: ${printParseErrorCode(error.error)} on line ${lineOf(text, error.offset)}`,
		);
	}
	const result = projectSchema.safeParse(json);
	if (!result.success) {
		throw new RobotConfigError(describeIssue(result.error.issues[0]!, file));
	}

	return result.data.robots.map((robot) => {
		const mount = transformMatrix(robot.mount);
		return {
			name: robot.name,
			body: robot.model === undefined ? undefined : { file: robot.model, transform: mount },
			parts: (robot.parts ?? []).map((part) => ({
				file: part.model,
				rest: mount,
				zero: transformMatrix(part.origin).invert().multiply(mount),
			})),
			devices: robot.devices ?? {},
			dimensions: robot.dimensions ?? defaultRobotDimensions,
		};
	});
}

// AdvantageScope ignores fields it doesn't understand, so this does too
const rotations = z
	.array(z.object({ axis: z.enum(['x', 'y', 'z']), degrees: z.number() }))
	.catch([])
	.default([]);
const position = z.tuple([z.number(), z.number(), z.number()]).catch([0, 0, 0]).default([0, 0, 0]);
const advantageScopeSchema = z.object({
	name: z.string().min(1),
	rotations,
	position,
	components: z
		.array(z.object({ zeroedRotations: rotations, zeroedPosition: position }))
		.catch([])
		.default([]),
});

const axes = { x: new Vector3(1, 0, 0), y: new Vector3(0, 1, 0), z: new Vector3(0, 0, 1) };

/** AdvantageScope's rotations are applied in order about the fixed axes, then the position */
function advantageScopeMatrix(steps: z.infer<typeof rotations>, [px, py, pz]: z.infer<typeof position>): Matrix4 {
	const rotation = new Quaternion();
	for (const { axis, degrees } of steps) {
		rotation.premultiply(new Quaternion().setFromAxisAngle(axes[axis], (degrees * Math.PI) / 180));
	}
	return new Matrix4().compose(new Vector3(px, py, pz), rotation, new Vector3(1, 1, 1));
}

function readAdvantageScopeConfig(text: string): RobotConfig[] {
	let json: unknown;
	try {
		json = JSON.parse(text);
	} catch {
		throw new RobotConfigError("config.json isn't valid JSON");
	}
	const result = advantageScopeSchema.safeParse(json);
	if (!result.success) {
		throw new RobotConfigError(describeIssue(result.error.issues[0]!, 'config.json'));
	}

	const config = result.data;
	const base = advantageScopeMatrix(config.rotations, config.position);
	return [
		{
			name: config.name,
			body: { file: 'model.glb', transform: base },
			parts: config.components.map((component, index) => ({
				file: `model_${index}.glb`,
				rest: base,
				zero: advantageScopeMatrix(component.zeroedRotations, component.zeroedPosition),
			})),
			devices: {},
			dimensions: defaultRobotDimensions,
		},
	];
}

/** Read the robots in a project's config, throws a `RobotConfigError` saying what's wrong when it can't */
export async function readRobotConfigs(read: ReadProjectFile): Promise<RobotConfig[]> {
	const [jsonc, json, advantageScope] = await Promise.all(
		['doglog.jsonc', 'doglog.json', 'config.json'].map((file) => read(file)),
	);
	// `doglog.jsonc` is used when both are present
	if (jsonc !== undefined) {
		return readDogLogConfig(decoder.decode(jsonc), 'doglog.jsonc');
	}
	if (json !== undefined) {
		return readDogLogConfig(decoder.decode(json), 'doglog.json');
	}
	if (advantageScope !== undefined) {
		return readAdvantageScopeConfig(decoder.decode(advantageScope));
	}
	throw new RobotConfigError("The folder doesn't have a doglog.jsonc, or an AdvantageScope robot's config.json", true);
}

/** The names of the folders directly in a folder of the project (`''` for the project's own), empty when it can't be read */
export type ListProjectFolders = (path: string) => Promise<string[]>;

/** An AdvantageScope robot found in a project, which can be added to a new `doglog.jsonc` */
export type AdvantageScopeRobot = {
	readonly name: string;
	/** Its folder in the project, ex. `ascope_assets/Robot_2026` */
	readonly folder: string;
	readonly config: z.infer<typeof advantageScopeSchema>;
};

/**
 * The AdvantageScope robots in a project's folders: `Robot_` folders with a valid `config.json`, directly in the project
 * or in its folders, ex. an `ascope_assets` folder set as AdvantageScope's custom assets folder
 */
export async function findAdvantageScopeRobots(
	read: ReadProjectFile,
	list: ListProjectFolders,
): Promise<AdvantageScopeRobot[]> {
	const top = (await list('')).filter((name) => !name.startsWith('.'));
	const nested = await Promise.all(
		top.map(async (name) =>
			name.startsWith('Robot_') ? [name] : (await list(name)).map((child) => `${name}/${child}`),
		),
	);
	const folders = nested.flat().filter((folder) => folder.split('/').at(-1)!.startsWith('Robot_'));
	const robots = await Promise.all(
		folders.map(async (folder): Promise<AdvantageScopeRobot[]> => {
			const file = await read(`${folder}/config.json`);
			let json: unknown;
			try {
				json = file === undefined ? undefined : JSON.parse(decoder.decode(file));
			} catch {
				return [];
			}
			const config = advantageScopeSchema.safeParse(json).data;
			return config ? [{ name: config.name, folder, config }] : [];
		}),
	);
	return robots.flat().toSorted((a, b) => a.folder.localeCompare(b.folder));
}

/** Rounded so the generated config is readable, `+ 0` turns `-0` into `0` */
const rounded = (value: number) => Math.round(value * 1e6) / 1e6 + 0;

const degrees = (value: number) => (value * 180) / Math.PI;

/** A transform for `doglog.jsonc` that has a matrix without scale, leaving out zeros */
function matrixTransform(matrix: Matrix4): Record<string, number> {
	const translation = new Vector3();
	const rotation = new Quaternion();
	matrix.decompose(translation, rotation, new Vector3());
	const euler = new Euler().setFromQuaternion(rotation, 'ZYX');
	const values = {
		x: translation.x,
		y: translation.y,
		z: translation.z,
		roll: degrees(euler.x),
		pitch: degrees(euler.y),
		yaw: degrees(euler.z),
	};
	return Object.fromEntries(
		Object.entries(values).flatMap(([key, value]) => (rounded(value) === 0 ? [] : [[key, rounded(value)]])),
	);
}

/** A transform on one line, ex. `{ "z": 0.05, "yaw": 90 }` */
const inlineTransform = (transform: Record<string, number>) =>
	`{ ${Object.entries(transform)
		.map(([key, value]) => `"${key}": ${value}`)
		.join(', ')} }`;

/** A field of a JSONC object: its comment, key, and value already written as JSONC */
type JsoncField = readonly [comment: string | undefined, key: string, value: string];

/** A JSONC object with a field on each line, each comment on the line before its field */
function jsoncObject(fields: readonly (JsoncField | false)[], indent: string): string {
	const inner = `${indent}\t`;
	const lines = fields
		.filter((field) => field !== false)
		.map(
			([comment, key, value]) => `${comment === undefined ? '' : `${inner}// ${comment}\n`}${inner}"${key}": ${value}`,
		);
	return `{\n${lines.join(',\n')}\n${indent}}`;
}

/** A JSONC array of values already written as JSONC, one on each line */
function jsoncArray(values: readonly string[], indent: string): string {
	return `[\n${values.map((value) => `${indent}\t${value}`).join(',\n')}\n${indent}]`;
}

/**
 * A `doglog.jsonc` that draws AdvantageScope robots the same way, for projects moving to DogLog Studio. Written by hand
 * so the fields that aren't obvious have comments, and transforms fit on one line.
 */
export function doglogConfigFromAdvantageScope(robots: readonly AdvantageScopeRobot[]): string {
	const robotObjects = robots.map(({ folder, config: robot }) => {
		const mount = advantageScopeMatrix(robot.rotations, robot.position);
		const transform = matrixTransform(mount);
		const parts = robot.components.map((component, index) => {
			// AdvantageScope's zeroed transform is `origin⁻¹ × mount`, see `readDogLogConfig()`
			const zero = advantageScopeMatrix(component.zeroedRotations, component.zeroedPosition);
			const origin = matrixTransform(mount.clone().multiply(zero.invert()));
			return jsoncObject(
				[
					[undefined, 'model', JSON.stringify(`${folder}/model_${index}.glb`)],
					Object.keys(origin).length > 0 && [
						'The pivot location in robot-relative coordinates',
						'origin',
						inlineTransform(origin),
					],
				],
				'\t\t\t\t',
			);
		});
		return jsoncObject(
			[
				[undefined, 'name', JSON.stringify(robot.name)],
				['Path to the 3D model to use for the robot chassis', 'model', JSON.stringify(`${folder}/model.glb`)],
				Object.keys(transform).length > 0 && [
					'Offset to map from CAD coordinates to robot coordinates',
					'mount',
					inlineTransform(transform),
				],
				parts.length > 0 && ['Mechanisms and moving parts on the robot', 'parts', jsoncArray(parts, '\t\t\t')],
			],
			'\t\t',
		);
	});
	const config = jsoncObject(
		[
			[undefined, '$schema', JSON.stringify('https://doglog.studio/doglog.schema.json')],
			[undefined, 'robots', jsoncArray(robotObjects, '\t')],
		],
		'',
	);
	return `${config}\n`;
}
