import { Matrix4, Vector3 } from 'three';
import type { Mechanism } from '@/data/mechanism';

/** Robot plane a mechanism's canvas is drawn on: seen from the robot's right, from its front, or from above */
export type MechanismPlane = 'side' | 'front' | 'top';

const x = new Vector3(1, 0, 0);
const y = new Vector3(0, 1, 0);
const z = new Vector3(0, 0, 1);

/** The canvas's right, up, and out of the screen as robot directions */
const planes: Record<MechanismPlane, Matrix4> = {
	side: new Matrix4().makeBasis(x, z, y.clone().negate()),
	front: new Matrix4().makeBasis(y, z, x),
	top: new Matrix4().makeBasis(y.clone().negate(), x, z),
};

/** Width and height of a ligament's box per unit of weight, in meters */
const metersPerWeight = 0.01;

/**
 * A mechanism's ligaments as boxes in their logged colors, with the center of the canvas's bottom edge at the robot's
 * origin. Its background isn't drawn. Mechanism units are meters.
 */
export function Mechanism3d({ mechanism, plane }: { mechanism: Mechanism; plane: MechanismPlane }) {
	return (
		<group matrix={planes[plane]} matrixAutoUpdate={false}>
			<group position={[-mechanism.width / 2, 0, 0]}>
				{mechanism.lines.map((line) => {
					const dx = line.end.x - line.start.x;
					const dy = line.end.y - line.start.y;
					const length = Math.hypot(dx, dy);
					const thickness = line.weight * metersPerWeight;
					return length > 0 && thickness > 0 ? (
						<mesh
							key={line.id}
							position={[(line.start.x + line.end.x) / 2, (line.start.y + line.end.y) / 2, 0]}
							rotation={[0, 0, Math.atan2(dy, dx)]}
							scale={[length, thickness, thickness]}
						>
							<boxGeometry />
							{/* Colors are drawn as logged, they don't follow the theme */}
							<meshStandardMaterial color={line.color} />
						</mesh>
					) : null;
				})}
			</group>
		</group>
	);
}
