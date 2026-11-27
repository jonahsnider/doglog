import { type Matrix4, Vector3 } from 'three';
import { expect, test } from 'vite-plus/test';
import {
	doglogConfigFromAdvantageScope,
	findAdvantageScopeRobots,
	RobotConfigError,
	readRobotConfigs,
} from '@/three/robot-config';
import { transformMatrix } from '@/three/poses';

function folder(files: Record<string, string>) {
	const encoder = new TextEncoder();
	return (path: string) => {
		const text = files[path];
		return Promise.resolve(text === undefined ? undefined : encoder.encode(text).buffer);
	};
}

/** Lists the folders in `tree` by their folder's path */
function folders(tree: Record<string, string[]>) {
	return (path: string) => Promise.resolve(tree[path] ?? []);
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
	"robots": [
		{
			"name": "581 2026",
			"model": "cad/robot.glb",
			"mount": { "z": 0.05 },
			"parts": [{ "model": "cad/arm.glb", "origin": { "x": 0.1, "z": 0.9 } }],
		},
		{ "name": "581 2026 Practice", "model": "cad/practice.glb" },
	],
}`;

async function competitionRobot() {
	return (await readRobotConfigs(folder({ 'doglog.jsonc': doglog })))[0]!;
}

test('reads every robot in doglog.jsonc', async () => {
	const [competition, practice] = await readRobotConfigs(folder({ 'doglog.jsonc': doglog }));
	expect(competition!.name).toBe('581 2026');
	expect(competition!.body!.file).toBe('cad/robot.glb');
	expect(competition!.parts.map((part) => part.file)).toEqual(['cad/arm.glb']);
	expect(practice!.name).toBe('581 2026 Practice');
	expect(practice!.body!.file).toBe('cad/practice.glb');
	expect(practice!.parts).toEqual([]);
});

test('reads device names, for robots without a model too', async () => {
	const devices = { rio: { 'TalonFX-11': 'Shooter/Left', 'CANcoder-11': 'Shooter/Encoder' } };
	const [robot] = await readRobotConfigs(
		folder({ 'doglog.jsonc': JSON.stringify({ robots: [{ name: 'A', devices }] }) }),
	);
	expect(robot!.body).toBeUndefined();
	expect(robot!.devices).toEqual(devices);
});

test('reads dimensions as a square, a length and width, or the default', async () => {
	const robots = await readRobotConfigs(
		folder({
			'doglog.jsonc': JSON.stringify({
				robots: [
					{ name: 'Square', dimensions: 0.8 },
					{ name: 'Long', dimensions: { length: 1.1, width: 0.7 } },
					{ name: 'Default' },
				],
			}),
		}),
	);
	expect(robots.map(({ dimensions }) => dimensions)).toEqual([
		{ length: 0.8, width: 0.8 },
		{ length: 1.1, width: 0.7 },
		{ length: 0.9, width: 0.9 },
	]);
});

test('prefers doglog.jsonc to doglog.json', async () => {
	const json = JSON.stringify({ robots: [{ name: 'Old', model: 'old.glb' }] });
	expect((await readRobotConfigs(folder({ 'doglog.json': json, 'doglog.jsonc': doglog })))[0]!.name).toBe('581 2026');
	expect((await readRobotConfigs(folder({ 'doglog.json': json })))[0]!.name).toBe('Old');
});

test("a pose at a part's origin draws it where the CAD placed it", async () => {
	const [arm] = (await competitionRobot()).parts;
	const atOrigin = transformMatrix({ x: 0.1, z: 0.9 }).multiply(arm!.zero);
	const point = new Vector3(0.5, 0.2, 0.3);
	expect(placed(atOrigin, point)).toEqual(placed(arm!.rest, point));
});

test('a pose turns a part around its pivot', async () => {
	const [arm] = (await competitionRobot()).parts;
	// The arm's tip, 0.5 m in front of its pivot in the CAD (before the 5 cm mount)
	const tip = new Vector3(0.6, 0, 0.85);
	const raised = transformMatrix({ x: 0.1, z: 0.9, pitch: -90 }).multiply(arm!.zero);
	expect(placed(raised, tip)).toEqual([0.1, 0, 1.4]);
});

test.each([
	[
		{ 'doglog.jsonc': '{ "robots": [{ "name": "A", "model": "a.glb", "colour": 1 }] }' },
		"robots.0.colour in doglog.jsonc isn't a known key",
	],
	[
		{ 'doglog.jsonc': '{ "robots": [{ "name": "A", "model": "a.glb" }, { "name": "B", "model": "../b.glb" }] }' },
		'robots.1.model in doglog.jsonc: must be a path inside the project folder',
	],
	[
		{ 'doglog.jsonc': '{ "robots": [{ "name": "A", "model": "a.glb" }, { "name": "A", "model": "b.glb" }] }' },
		'robots in doglog.jsonc: each robot needs a different name',
	],
	[
		{
			'doglog.jsonc': JSON.stringify({
				robots: [{ name: 'A', devices: { rio: { 'TalonFX-11': 'Shooter', 'TalonFX-12': 'Shooter' } } }],
			}),
		},
		'robots.0.devices in doglog.jsonc: names two devices Shooter',
	],
	[
		{
			'doglog.jsonc': JSON.stringify({
				robots: [
					{ name: 'A', devices: { rio: { 'TalonFX-11': 'Shooter' }, canivore: { 'TalonFX-12': 'Shooter/Left' } } },
				],
			}),
		},
		"robots.0.devices in doglog.jsonc: can't name a device Shooter and another Shooter/Left",
	],
	[
		{ 'doglog.jsonc': JSON.stringify({ robots: [{ name: 'A', devices: { rio: { 'TalonFX-63': 'Shooter' } } }] }) },
		'must be a model and an ID from 0 to 62',
	],
	[
		{
			'doglog.jsonc': JSON.stringify({
				robots: [{ name: 'A', devices: { rio: { 'TalonFX-11': 'TalonFX-12/Left' } } }],
			}),
		},
		"can't start with a model and an ID",
	],
	[
		{ 'doglog.jsonc': JSON.stringify({ robots: [{ name: 'A', dimensions: { length: 0.9 } }] }) },
		'robots.0.dimensions in doglog.jsonc: must be meters above 0, or a length and width in meters above 0',
	],
	[{ 'doglog.jsonc': '{ "robots": ' }, "doglog.jsonc isn't valid JSON"],
	[{}, "doesn't have a doglog.jsonc"],
])('explains invalid projects: %o', async (files, message) => {
	await expect(readRobotConfigs(folder(files))).rejects.toThrow(RobotConfigError);
	await expect(readRobotConfigs(folder(files))).rejects.toThrow(message);
});

test('translates AdvantageScope robots', async () => {
	const [config] = await readRobotConfigs(
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
	expect(config!.body!.file).toBe('model.glb');
	// The CAD's +Y is up, turned to +Z, then raised
	expect(placed(config!.body!.transform, new Vector3(0, 1, 0))).toEqual([0, 0, 1.1]);
	expect(config!.parts.map((part) => part.file)).toEqual(['model_0.glb']);
	// Like AdvantageScope, a component's pose places its zeroed model
	expect(placed(transformMatrix({ z: 0.5 }).multiply(config!.parts[0]!.zero))).toEqual([0, 0, 0]);
});

const advantageScope = JSON.stringify({
	name: 'KitBot',
	rotations: [
		{ axis: 'x', degrees: 90 },
		{ axis: 'z', degrees: 30 },
	],
	position: [0.1, -0.2, 0.3],
	components: [{ zeroedRotations: [{ axis: 'y', degrees: 45 }], zeroedPosition: [0.2, 0, -0.5] }],
});

test('finds AdvantageScope robots in the project and its folders', async () => {
	const robots = await findAdvantageScopeRobots(
		folder({
			'Robot_Top/config.json': JSON.stringify({ name: 'Top' }),
			'ascope_assets/Robot_KitBot/config.json': advantageScope,
			'ascope_assets/Robot_Broken/config.json': '{',
			'ascope_assets/Field3d_2026/config.json': JSON.stringify({ name: 'Field' }),
			'.git/Robot_Hidden/config.json': JSON.stringify({ name: 'Hidden' }),
		}),
		folders({
			'': ['.git', 'Robot_Top', 'ascope_assets', 'src'],
			ascope_assets: ['Field3d_2026', 'Robot_KitBot', 'Robot_Broken'],
			src: ['main'],
			'.git': ['Robot_Hidden'],
		}),
	);
	expect(robots.map(({ name, folder: path }) => [name, path])).toEqual([
		['KitBot', 'ascope_assets/Robot_KitBot'],
		['Top', 'Robot_Top'],
	]);
});

test('a doglog.jsonc made from an AdvantageScope robot draws it the same way', async () => {
	const [original] = await readRobotConfigs(folder({ 'config.json': advantageScope }));
	const [robot] = await findAdvantageScopeRobots(
		folder({ 'ascope_assets/Robot_KitBot/config.json': advantageScope }),
		folders({ '': ['ascope_assets'], ascope_assets: ['Robot_KitBot'] }),
	);
	const [migrated] = await readRobotConfigs(folder({ 'doglog.jsonc': doglogConfigFromAdvantageScope([robot!]) }));

	expect(migrated!.name).toBe('KitBot');
	expect(migrated!.body!.file).toBe('ascope_assets/Robot_KitBot/model.glb');
	expect(migrated!.parts.map((part) => part.file)).toEqual(['ascope_assets/Robot_KitBot/model_0.glb']);
	const point = new Vector3(0.4, -0.7, 1.3);
	expect(placed(migrated!.body!.transform, point)).toEqual(placed(original!.body!.transform, point));
	expect(placed(migrated!.parts[0]!.rest, point)).toEqual(placed(original!.parts[0]!.rest, point));
	// A logged pose places the part the same way
	const pose = transformMatrix({ x: 0.3, z: 0.6, pitch: -20 });
	expect(placed(pose.clone().multiply(migrated!.parts[0]!.zero), point)).toEqual(
		placed(pose.clone().multiply(original!.parts[0]!.zero), point),
	);
});
