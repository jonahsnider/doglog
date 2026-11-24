import { expect, test } from 'vite-plus/test';
import { parseStructSpecification } from 'wpilib-struct';
import { DataSet } from '@/data/data-set';
import { formatStructPreview } from './struct-preview';

function poseData(rotationSchema?: string) {
	const data = new DataSet(() => {});
	const pose = data.addEntry('/Drive/Pose', 'struct:Pose2d');
	data.addStructSchema('Pose2d', parseStructSpecification('Translation2d translation; Rotation2d rotation;'));
	data.addStructSchema('Translation2d', parseStructSpecification('double x; double y;'));
	if (rotationSchema !== undefined) {
		data.addStructSchema('Rotation2d', parseStructSpecification(rotationSchema));
	}
	data.addSample(pose, 10, { translation: { x: 12.34, y: 0 }, rotation: { value: (56 * Math.PI) / 180 } });
	return { data, pose };
}

test('shows a pose at the cursor as coordinates and degrees, including in replay', () => {
	const { data, pose } = poseData(' double value; ');
	data.addSample(pose, 20, { translation: { x: -1.234, y: 0.987 }, rotation: { value: -Math.PI / 4 } });
	data.publish();
	const replay = data.copyForReplay();

	expect(formatStructPreview(pose, 9, data.structSchemas)).toBeUndefined();
	expect(formatStructPreview(pose, 19, data.structSchemas)).toEqual([
		{ label: 'x', value: '12.34' },
		{ label: 'y', value: '0' },
		{ label: 'θ', value: '56°' },
	]);
	expect(formatStructPreview(replay.entries.get(pose.name)!, 20, replay.structSchemas)).toEqual([
		{ label: 'x', value: '-1.23' },
		{ label: 'y', value: '0.99' },
		{ label: 'θ', value: '-45°' },
	]);
});

test.each([undefined, 'float value', 'double value[1]', 'double value; double extra'])(
	'keeps the generic preview when the nested rotation schema is %s',
	(rotationSchema) => {
		const { data, pose } = poseData(rotationSchema);
		expect(formatStructPreview(pose, 10, data.structSchemas)).toBeUndefined();
	},
);

test('requires the declared field order, even when the decoded values have the expected shape', () => {
	const { data, pose } = poseData('double value');
	data.addStructSchema('Translation2d', parseStructSpecification('double y; double x'));
	expect(formatStructPreview(pose, 10, data.structSchemas)).toBeUndefined();
});

function pose3dData() {
	const data = new DataSet(() => {});
	data.addStructSchema('Pose3d', parseStructSpecification('Translation3d translation; Rotation3d rotation'));
	data.addStructSchema('Translation3d', parseStructSpecification('double x; double y; double z'));
	data.addStructSchema('Rotation3d', parseStructSpecification('Quaternion q'));
	data.addStructSchema('Quaternion', parseStructSpecification('double w; double x; double y; double z'));
	const pose = data.addEntry('/Drive/Pose', 'struct:Pose3d');
	const heading = data.addEntry('/Drive/Heading', 'struct:Rotation3d');
	// 30° roll, 20° pitch, -60° yaw. Taking just the quaternion's z term gives the wrong heading.
	const rotation = { q: { w: 0.80133601, x: 0.30460425, y: 0.01781603, z: -0.5145478 } };
	data.addSample(pose, 10, { translation: { x: 12.34, y: 0, z: 2.5 }, rotation });
	data.addSample(heading, 10, rotation);
	return { data, pose, heading };
}

test('shows only X, Y, and yaw for a 3D pose and only yaw for a 3D rotation', () => {
	const { data, pose, heading } = pose3dData();
	expect(formatStructPreview(pose, 10, data.structSchemas)).toEqual([
		{ label: 'x', value: '12.34' },
		{ label: 'y', value: '0' },
		{ label: 'θ', value: '-60°' },
	]);
	expect(formatStructPreview(heading, 10, data.structSchemas)).toEqual([{ label: 'θ', value: '-60°' }]);
});

test.each([
	['Translation3d', 'double x; double y; float z'],
	['Quaternion', 'double w; double x; double z; double y'],
])('checks the full nested %s schema before projecting a 3D pose', (name, schema) => {
	const { data, pose } = pose3dData();
	data.addStructSchema(name, parseStructSpecification(schema));
	expect(formatStructPreview(pose, 10, data.structSchemas)).toBeUndefined();
});
