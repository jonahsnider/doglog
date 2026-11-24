import { parseStructSpecification, type StructDeclaration } from 'wpilib-struct';
import type { Entry } from '@/data/data-store';
import { quaternionYaw, structField } from '@/data/struct-fields';

const layouts = new Map(
	Object.entries({
		Rotation2d: 'double value',
		Rotation3d: 'Quaternion q',
		Quaternion: 'double w;double x;double y;double z',
		Translation2d: 'double x;double y',
		Translation3d: 'double x;double y;double z',
		Pose2d: 'Translation2d translation;Rotation2d rotation',
		Pose3d: 'Translation3d translation;Rotation3d rotation',
		Transform2d: 'Translation2d translation;Rotation2d rotation',
		SwerveModuleState: 'double speed;Rotation2d angle',
		SwerveModulePosition: 'double distance;Rotation2d angle',
	}).map(([name, schema]) => [name, parseStructSpecification(schema)]),
);

const headingLabel = 'θ';
type Component = { label: string; value: number };
type PreviewPart = { label: string; value: string };

/** Format familiar structs only when their logged schema, including nested types, matches. */
export function formatStructPreview(
	entry: Entry,
	time: number,
	schemas: ReadonlyMap<string, readonly StructDeclaration[]>,
): PreviewPart[] | undefined {
	const name = entry.type.slice('struct:'.length);
	if (entry.kind !== 'struct' || !layouts.has(name) || name === 'Quaternion') {
		return undefined;
	}
	return readComponents(name, entry.samples.valueAt(time), schemas)?.map(({ label, value }) => {
		const degrees = label === headingLabel;
		const number = degrees ? (value * 180) / Math.PI : value;
		return { label, value: `${Number(number.toFixed(2))}${degrees ? '°' : ''}` };
	});
}

function readComponents(
	name: string,
	value: unknown,
	schemas: ReadonlyMap<string, readonly StructDeclaration[]>,
): Component[] | undefined {
	const layout = layouts.get(name);
	const fields = schemas.get(name);
	if (layout === undefined || fields?.length !== layout.length) {
		return undefined;
	}
	const parts: Component[] = [];
	for (const [index, expected] of layout.entries()) {
		const field = fields[index]!;
		if (
			field.name !== expected.name ||
			field.value !== expected.value ||
			field.arraySize !== undefined ||
			field.bitWidth !== undefined ||
			field.enumSpecification !== undefined
		) {
			return undefined;
		}
		const component = structField(value, field.name);
		if (field.value === 'double') {
			if (typeof component !== 'number') {
				return undefined;
			}
			parts.push({ label: name === 'Rotation2d' ? headingLabel : field.name, value: component });
		} else {
			const nested = readComponents(field.value, component, schemas);
			if (nested === undefined) {
				return undefined;
			}
			parts.push(...nested);
		}
	}
	// Project to the same components as the 2D previews, only after checking the full 3D definitions.
	if (name === 'Rotation3d') {
		return [{ label: headingLabel, value: quaternionYaw(structField(value, 'q')) }];
	}
	return name === 'Pose3d' ? parts.filter(({ label }) => label !== 'z') : parts;
}
