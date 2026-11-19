// Reads a robot project's config, from `doglog.jsonc` (or `doglog.json`), or an AdvantageScope robot's `config.json`
import { type ParseError, parse, printParseErrorCode } from 'jsonc-parser';
import { Matrix4, Quaternion, Vector3 } from 'three';
import * as z from 'zod';
import { projectSchema } from '@/three/project-schema';
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
	/** The robot's body, which doesn't move */
	readonly body: { readonly file: string; readonly transform: Matrix4 };
	/** Parts moved by a `Pose3d[]` entry, in its order */
	readonly parts: readonly RobotPart[];
};

/** A robot project that can't be shown, with a message saying why */
export class RobotConfigError extends Error {}

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
	const message = issue.message.replace(/^Invalid input: /u, '');
	return path === '' ? `${file}: ${message}` : `${path} in ${file}: ${message}`;
}

function readDogLogConfig(text: string, file: string): RobotConfig {
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

	const { robot } = result.data;
	const mount = transformMatrix(robot.mount);
	return {
		name: robot.name,
		body: { file: robot.model, transform: mount },
		parts: (robot.parts ?? []).map((part) => ({
			file: part.model,
			rest: mount,
			zero: transformMatrix(part.origin).invert().multiply(mount),
		})),
	};
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

function readAdvantageScopeConfig(text: string): RobotConfig {
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
	return {
		name: config.name,
		body: { file: 'model.glb', transform: base },
		parts: config.components.map((component, index) => ({
			file: `model_${index}.glb`,
			rest: base,
			zero: advantageScopeMatrix(component.zeroedRotations, component.zeroedPosition),
		})),
	};
}

/** Read a robot project's config, throws a `RobotConfigError` saying what's wrong when it can't */
export async function readRobotConfig(read: ReadProjectFile): Promise<RobotConfig> {
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
	throw new RobotConfigError("The folder doesn't have a doglog.jsonc, or an AdvantageScope robot's config.json");
}
