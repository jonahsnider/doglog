import { useThemeColor } from '@/three/theme';

/** Bumper footprint, the same as robots on the field */
const half = 0.45;
const bumperThickness = 0.08;
const bumperHeight = 0.12;
const bumperBottom = 0.03;
const plateThickness = 0.03;
const plateTop = 0.15;
const wheelRadius = 0.0508;
const wheelWidth = 0.04;
/** Module centers, inset from the bumpers */
const moduleOffset = half - bumperThickness - 0.1;
const body = '#222';

const bumperSides = [
	{ position: [half - bumperThickness / 2, 0], size: [bumperThickness, half * 2] },
	{ position: [-half + bumperThickness / 2, 0], size: [bumperThickness, half * 2] },
	{ position: [0, half - bumperThickness / 2], size: [half * 2 - bumperThickness * 2, bumperThickness] },
	{ position: [0, -half + bumperThickness / 2], size: [half * 2 - bumperThickness * 2, bumperThickness] },
] as const;

const modules = [
	[moduleOffset, moduleOffset],
	[moduleOffset, -moduleOffset],
	[-moduleOffset, moduleOffset],
	[-moduleOffset, -moduleOffset],
] as const;

/** A simple swerve robot drawn without a model: bumpers in the theme's primary color, a frame, and four modules */
export function SwerveRobot() {
	const bumper = useThemeColor('var(--primary)');
	const inner = half - bumperThickness;
	return (
		<group>
			{bumperSides.map(({ position: [px, py], size: [sx, sy] }) => (
				<mesh key={`${px},${py}`} position={[px, py, bumperBottom + bumperHeight / 2]} scale={[sx, sy, bumperHeight]}>
					<boxGeometry />
					<meshStandardMaterial color={bumper} />
				</mesh>
			))}
			<mesh position={[0, 0, plateTop - plateThickness / 2]} scale={[inner * 2, inner * 2, plateThickness]}>
				<boxGeometry />
				<meshStandardMaterial color={body} />
			</mesh>
			{modules.map(([mx, my]) => (
				<group key={`${mx},${my}`} position={[mx, my, 0]}>
					{/* Cylinders are along Y, which is the wheel's axle when it points forward */}
					<mesh position={[0, 0, wheelRadius]}>
						<cylinderGeometry args={[wheelRadius, wheelRadius, wheelWidth, 24]} />
						<meshStandardMaterial color={body} />
					</mesh>
					<mesh position={[0, 0, plateTop + 0.03]} scale={[0.12, 0.12, 0.06]}>
						<boxGeometry />
						<meshStandardMaterial color={body} />
					</mesh>
				</group>
			))}
			{/* Points toward the robot's front */}
			<mesh position={[0.12, 0, plateTop + 0.03]} rotation={[0, 0, -Math.PI / 2]} scale={[1, 1, 0.3]}>
				<coneGeometry args={[0.08, 0.2, 3]} />
				<meshStandardMaterial color="white" />
			</mesh>
		</group>
	);
}
