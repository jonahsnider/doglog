// World-sized point markers and 3D heading arrows for the field widget
import { Line } from '@react-three/drei';
import { useMemo } from 'react';
import { BackSide, LatheGeometry, Quaternion, SphereGeometry, Vector2, Vector3 } from 'three';
import type { Value } from '@/data/samples';
import { fieldPoseMatrix, floorOffset, isPose, items } from '@/three/field-poses';
import { useThemeColor } from '@/three/theme';
import { pointMarker } from '@/widgets/field/geometry';

const { diameter: pointDiameter, outlineWidth, shaftRadius, shaftLength, arrowheadRadius, arrowLength } = pointMarker;
/** Don't draw a line to the floor for points less than this many meters above it */
const minTetherHeight = 0.05;
const pointGeometry = new SphereGeometry(0.5);
const arrowAxis = new Vector3(0, 1, 0);
const headingArrow = new LatheGeometry([
	new Vector2(shaftRadius, 0),
	new Vector2(shaftRadius, shaftLength),
	new Vector2(arrowheadRadius, shaftLength),
	new Vector2(0, arrowLength),
]);
/** A larger profile draws the outline from its back faces. Both shafts start inside the dot. */
const headingOutline = new LatheGeometry([
	new Vector2(shaftRadius + outlineWidth, 0),
	new Vector2(shaftRadius + outlineWidth, shaftLength),
	new Vector2(arrowheadRadius + outlineWidth, shaftLength),
	new Vector2(0, arrowLength + 0.12),
]);

/** Where each point is drawn, with the rotation of its heading arrow if it's a pose */
function markers(value: Value) {
	return items(value).map((item) => {
		const matrix = fieldPoseMatrix(item);
		const center = new Vector3().setFromMatrixPosition(matrix);
		center.setZ(center.z === 0 ? floorOffset : center.z);
		return {
			center,
			onFloor: center.z >= 0 && center.z <= minTetherHeight,
			heading: isPose(item)
				? new Quaternion().setFromUnitVectors(arrowAxis, new Vector3(1, 0, 0).transformDirection(matrix))
				: undefined,
		};
	});
}

export function FieldPoints({ value, color, cssOutline }: { value: Value; color: string; cssOutline: string }) {
	// oxlint-disable-next-line studio/no-manual-memo -- React Compiler doesn't memoize this on its own
	const points = useMemo(() => markers(value), [value]);
	const outline = useThemeColor(cssOutline);
	return (
		<group>
			{points.map(({ center, heading, onFloor }, index) => (
				<group
					// oxlint-disable-next-line react/no-array-index-key -- Array items don't have IDs
					key={index}
					position={[center.x, center.y, center.z + (onFloor ? pointDiameter / 2 : 0)]}
					scale={pointDiameter}
				>
					<mesh geometry={pointGeometry} scale={1 - 2 * outlineWidth}>
						<meshBasicMaterial color={color} toneMapped={false} />
					</mesh>
					<mesh geometry={pointGeometry}>
						<meshBasicMaterial color={outline} side={BackSide} toneMapped={false} />
					</mesh>
					{heading && (
						<mesh geometry={headingArrow} quaternion={heading}>
							<meshBasicMaterial color={color} toneMapped={false} />
							<mesh geometry={headingOutline}>
								<meshBasicMaterial color={outline} side={BackSide} toneMapped={false} />
							</mesh>
						</mesh>
					)}
				</group>
			))}
			{points.map(({ center }, index) =>
				center.z > minTetherHeight ? (
					<Line
						// oxlint-disable-next-line react/no-array-index-key -- Array items don't have IDs
						key={index}
						points={[center, center.clone().setZ(floorOffset)]}
						color={color}
						lineWidth={1}
						transparent
						opacity={0.4}
					/>
				) : null,
			)}
		</group>
	);
}
