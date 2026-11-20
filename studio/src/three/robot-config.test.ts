import { type Matrix4, Vector3 } from 'three';
import { expect, test } from 'vite-plus/test';
import { RobotConfigError, readRobotConfig } from '@/three/robot-config';
import { transformMatrix } from '@/three/poses';

function folder(files: Record<string, string>) {
	const encoder = new TextEncoder();
	return (path: string) => {
		const text = files[path];
		return Promise.resolve(text === undefined ? undefined : encoder.encode(text).buffer);
	};
}

function placed(matrix: Matrix4, point = new Vector3()): number[] {
	return point
		.clone()
		.applyMatrix4(matrix)
		.toArray()
		.map((axis) => Math.round(axis * 1000) / 1000 + 0);
}

const doglog = `{
	// Comments and trailing commas are allowed
	"robot": {
		"name": "581 2026",
		"model": "cad/robot.glb",
		"mount": { "z": 0.05 },
		"parts": [{ "model": "cad/arm.glb", "origin": { "x": 0.1, "z": 0.9 } }],
	},
}`;

test('reads doglog.jsonc', async () => {
	const config = await readRobotConfig(folder({ 'doglog.jsonc': doglog }));
	expect(config.name).toBe('581 2026');
	expect(config.body.file).toBe('cad/robot.glb');
	expect(config.parts.map((part) => part.file)).toEqual(['cad/arm.glb']);
});

test('prefers doglog.jsonc to doglog.json', async () => {
	const json = JSON.stringify({ robot: { name: 'Old', model: 'old.glb' } });
	expect((await readRobotConfig(folder({ 'doglog.json': json, 'doglog.jsonc': doglog }))).name).toBe('581 2026');
	expect((await readRobotConfig(folder({ 'doglog.json': json }))).name).toBe('Old');
});

test("a pose at a part's origin draws it where the CAD placed it", async () => {
	const [arm] = (await readRobotConfig(folder({ 'doglog.jsonc': doglog }))).parts;
	const atOrigin = transformMatrix({ x: 0.1, z: 0.9 }).multiply(arm!.zero);
	const point = new Vector3(0.5, 0.2, 0.3);
	expect(placed(atOrigin, point)).toEqual(placed(arm!.rest, point));
});

test('a pose turns a part around its pivot', async () => {
	const [arm] = (await readRobotConfig(folder({ 'doglog.jsonc': doglog }))).parts;
	// The arm's tip, 0.5 m in front of its pivot in the CAD (before the 5 cm mount)
	const tip = new Vector3(0.6, 0, 0.85);
	const raised = transformMatrix({ x: 0.1, z: 0.9, pitch: -90 }).multiply(arm!.zero);
	expect(placed(raised, tip)).toEqual([0.1, 0, 1.4]);
});

test.each([
	[
		{ 'doglog.jsonc': '{ "robot": { "name": "A", "model": "a.glb", "colour": 1 } }' },
		"robot.colour in doglog.jsonc isn't a known key",
	],
	[
		{ 'doglog.jsonc': '{ "robot": { "name": "A", "model": "../a.glb" } }' },
		'robot.model in doglog.jsonc: must be a path inside the project folder',
	],
	[{ 'doglog.jsonc': '{ "robot": ' }, "doglog.jsonc isn't valid JSON"],
	[{}, "doesn't have a doglog.jsonc"],
])('explains invalid projects: %o', async (files, message) => {
	await expect(readRobotConfig(folder(files))).rejects.toThrow(RobotConfigError);
	await expect(readRobotConfig(folder(files))).rejects.toThrow(message);
});

test('translates AdvantageScope robots', async () => {
	const config = await readRobotConfig(
		folder({
			'config.json': JSON.stringify({
				name: 'KitBot',
				rotations: [{ axis: 'x', degrees: 90 }],
				position: [0, 0, 0.1],
				cameras: [],
				components: [{ zeroedRotations: [], zeroedPosition: [0, 0, -0.5] }],
			}),
		}),
	);
	expect(config.body.file).toBe('model.glb');
	// The CAD's +Y is up, turned to +Z, then raised
	expect(placed(config.body.transform, new Vector3(0, 1, 0))).toEqual([0, 0, 1.1]);
	expect(config.parts.map((part) => part.file)).toEqual(['model_0.glb']);
	// Like AdvantageScope, a component's pose places its zeroed model
	expect(placed(transformMatrix({ z: 0.5 }).multiply(config.parts[0]!.zero))).toEqual([0, 0, 0]);
});
