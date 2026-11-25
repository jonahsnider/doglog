// A view cube, built in the robot's coordinates (+X front, +Y left, +Z up)
import { GizmoHelper, Line, RoundedBox } from '@react-three/drei';
import { type ThreeEvent, useThree } from '@react-three/fiber';
import { type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import {
	CanvasTexture,
	Color,
	Matrix4,
	Quaternion,
	SRGBColorSpace,
	Vector3,
	type WebGLProgramParametersWithUniforms,
} from 'three';
import { useThemeColor } from '@/three/theme';

/** Width of the cube on screen, in pixels */
const size = 88;
/** Distance from the canvas's top-right corner to the cube's center, in pixels */
const margin = 76;
const labelFont = "600 44px 'IBM Plex Sans Variable', sans-serif";
/** Width of the faces' labels, a little less than the cube so they stay on its flat part */
const labelSize = 0.9;
const textureSize = 256;

const x = new Vector3(1, 0, 0);
const y = new Vector3(0, 1, 0);
const z = new Vector3(0, 0, 1);
/** Each face's label, with its direction and the directions its text reads right and up */
const faces = [
	{ label: 'Front', normal: x, right: y, up: z },
	{ label: 'Back', normal: x.clone().negate(), right: y.clone().negate(), up: z },
	{ label: 'Left', normal: y, right: x.clone().negate(), up: z },
	{ label: 'Right', normal: y.clone().negate(), right: x, up: z },
	// The top view has the robot's front down and the bottom view has it up, so these read upright from the front too
	{ label: 'Top', normal: z, right: y, up: x.clone().negate() },
	{ label: 'Bottom', normal: z.clone().negate(), right: y, up: x },
].map(({ label, normal, right, up }) => ({
	label,
	position: normal.clone().multiplyScalar(0.501),
	quaternion: new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(right, up, normal)),
}));

const cornerRadius = 0.16;

function roundedSquare(half: number, radius: number): [number, number][] {
	const straight = half - radius;
	const steps = 8;
	return [
		[1, 1],
		[-1, 1],
		[-1, -1],
		[1, -1],
	].flatMap(([sx = 0, sy = 0], corner) =>
		Array.from({ length: steps + 1 }, (_, step): [number, number] => {
			const angle = ((corner + step / steps) * Math.PI) / 2;
			return [sx * straight + Math.cos(angle) * radius, sy * straight + Math.sin(angle) * radius];
		}),
	);
}

/**
 * Lines between each face's center and its edges and corners, see `regions`. Each is where a plane a quarter of the way
 * in cuts the cube, a rounded square that follows its rounded edges.
 */
const dividers = [0, 1, 2].flatMap((axis) =>
	[-0.25, 0.25].map((offset) => {
		const loop = roundedSquare(0.505, cornerRadius + 0.005).map(([a, b]) => {
			const point = [a, b];
			point.splice(axis, 0, offset);
			return new Vector3(...point);
		});
		loop.push(loop[0]!);
		return { key: `${axis}:${offset}`, points: loop };
	}),
);

/**
 * The clickable parts of the cube, one per direction to look from: 6 faces, 12 edges, and 8 corners. Each is a box in
 * the cube's shell, wide along the axes the direction doesn't use and thin along the ones it does.
 */
const regions = [-1, 0, 1]
	.flatMap((dx) => [-1, 0, 1].flatMap((dy) => [-1, 0, 1].map((dz) => new Vector3(dx, dy, dz))))
	.filter((direction) => direction.lengthSq() > 0)
	.map((direction) => ({
		direction,
		position: direction.clone().multiplyScalar(0.38),
		scale: new Vector3(...direction.toArray().map((axis) => (axis === 0 ? 0.5 : 0.25) * 1.02)),
	}));

/** A face's label, drawn once the font has loaded */
function useFaceTexture(text: string, color: string): CanvasTexture | undefined {
	const [texture, setTexture] = useState<CanvasTexture>();
	useEffect(() => {
		let current: CanvasTexture | undefined;
		let cancelled = false;
		const draw = async () => {
			await document.fonts.load(labelFont);
			if (cancelled) {
				return;
			}
			const canvas = document.createElement('canvas');
			canvas.width = textureSize;
			canvas.height = textureSize;
			const context = canvas.getContext('2d');
			if (context) {
				context.font = labelFont;
				context.fillStyle = color;
				context.textAlign = 'center';
				context.textBaseline = 'middle';
				context.fillText(text, textureSize / 2, textureSize / 2);
			}
			current = new CanvasTexture(canvas);
			current.colorSpace = SRGBColorSpace;
			current.anisotropy = 4;
			setTexture(current);
		};
		void draw();
		return () => {
			cancelled = true;
			current?.dispose();
		};
	}, [text, color]);
	return texture;
}

/** Soft shading that doesn't need lights: lit from the top left of the screen, darker toward the edges */
function useMatcap(): CanvasTexture {
	const matcap = useMemo(() => {
		const canvas = document.createElement('canvas');
		canvas.width = 64;
		canvas.height = 64;
		const context = canvas.getContext('2d');
		if (context) {
			const gradient = context.createRadialGradient(24, 20, 4, 32, 32, 44);
			gradient.addColorStop(0, 'white');
			gradient.addColorStop(1, '#a0a0a0');
			context.fillStyle = gradient;
			context.fillRect(0, 0, 64, 64);
		}
		const texture = new CanvasTexture(canvas);
		texture.colorSpace = SRGBColorSpace;
		return texture;
	}, []);
	useEffect(() => () => matcap.dispose(), [matcap]);
	return matcap;
}

function FaceLabel({ label, color, ...transform }: (typeof faces)[number] & { color: string }) {
	const texture = useFaceTexture(label, color);
	return texture ? (
		<mesh {...transform}>
			<planeGeometry args={[labelSize, labelSize]} />
			<meshBasicMaterial map={texture} transparent depthWrite={false} />
		</mesh>
	) : null;
}

type HoverUniforms = {
	hoverDirection: { value: Vector3 };
	hovered: { value: number };
	highlight: { value: Color };
};

/** Made on first use, so they aren't made again on every render */
function hoverUniforms(ref: RefObject<HoverUniforms | undefined>): HoverUniforms {
	ref.current ??= {
		hoverDirection: { value: new Vector3() },
		hovered: { value: 0 },
		highlight: { value: new Color() },
	};
	return ref.current;
}

/**
 * Tints the part of the cube's surface in `hoverDirection`, where each axis is -1, 0, or 1 like `regions`, so the
 * highlight follows its rounded edges and stops at the dividers
 */
function tintHoveredPart(shader: WebGLProgramParametersWithUniforms, uniforms: HoverUniforms): void {
	Object.assign(shader.uniforms, uniforms);
	shader.vertexShader = `varying vec3 vCubePosition;\n${shader.vertexShader}`.replace(
		'#include <begin_vertex>',
		'#include <begin_vertex>\nvCubePosition = position;',
	);
	shader.fragmentShader = `varying vec3 vCubePosition;
uniform vec3 hoverDirection;
uniform float hovered;
uniform vec3 highlight;
${shader.fragmentShader}`.replace(
		'#include <color_fragment>',
		`#include <color_fragment>
vec3 part = step(0.25, vCubePosition) - step(0.25, -vCubePosition);
if (hovered > 0.5 && all(equal(part, hoverDirection))) {
	diffuseColor.rgb = mix(diffuseColor.rgb, highlight, 0.6);
}`,
	);
}

export function ViewCube({
	onLookFrom,
	onHoverChange,
}: {
	onLookFrom: (direction: Vector3) => void;
	onHoverChange: (hovered: boolean) => void;
}) {
	const color = useThemeColor('var(--md-secondary-container)');
	const textColor = useThemeColor('var(--md-on-secondary-container)');
	const highlight = useThemeColor('var(--md-primary)');
	const matcap = useMatcap();
	const [hovered, setHovered] = useState<number>();

	const uniforms = useRef<HoverUniforms>(undefined);
	const invalidate = useThree((state) => state.invalidate);
	useEffect(() => {
		const current = hoverUniforms(uniforms);
		const part = hovered === undefined ? undefined : regions[hovered];
		current.hovered.value = part ? 1 : 0;
		if (part) {
			current.hoverDirection.value.copy(part.direction);
		}
		current.highlight.value.set(highlight);
		invalidate();
	}, [hovered, highlight, invalidate]);

	const hover = (index: number, over: boolean) => (event: ThreeEvent<PointerEvent>) => {
		event.stopPropagation();
		// Moving between parts leaves one before entering the next
		setHovered((current) => (over ? index : current === index ? undefined : current));
		onHoverChange(over);
	};

	return (
		<GizmoHelper alignment="top-right" margin={[margin, margin]}>
			<group scale={size}>
				<RoundedBox args={[1, 1, 1]} radius={cornerRadius} smoothness={4}>
					<meshMatcapMaterial
						matcap={matcap}
						color={color}
						onBeforeCompile={(shader) => tintHoveredPart(shader, hoverUniforms(uniforms))}
					/>
				</RoundedBox>
				{dividers.map(({ key, points }) => (
					<Line key={key} points={points} color={textColor} lineWidth={1} transparent opacity={0.3} />
				))}
				{faces.map((face) => (
					<FaceLabel key={face.label} {...face} color={textColor} />
				))}
				{regions.map(({ direction, position, scale }, index) => (
					<mesh
						key={direction.toArray().join(',')}
						position={position}
						scale={scale}
						onPointerOver={hover(index, true)}
						onPointerOut={hover(index, false)}
						onClick={(event) => {
							event.stopPropagation();
							onLookFrom(direction.clone());
						}}
					>
						<boxGeometry />
						{/* Only clicked, the cube's surface shows when it's hovered */}
						<meshBasicMaterial visible={false} />
					</mesh>
				))}
			</group>
		</GizmoHelper>
	);
}
