// A 3D scene in WPILib's robot coordinates (meters, +X forward, +Y left, +Z up), viewed like Team 581's Spot viewer:
// an orthographic camera orbiting the robot, kept above the floor, with a light on the camera.
import { OrbitControls } from '@react-three/drei';
import { Canvas, type RootState, useFrame } from '@react-three/fiber';
import { type KeyboardEvent, type ReactNode, type Ref, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { type DirectionalLight, Vector3 } from 'three';
import { cn } from '@/lib/utils';
import { CameraRig, cameraDistance, type Rig, type Scene3dHandle } from '@/three/camera';
import { useThemeColor } from '@/three/theme';

export type { CameraView, Scene3dHandle } from '@/three/camera';

const gridSize = 2.4;
const gridDivisions = 6;

/** A light that follows the camera, so models show their shape from any angle */
function Headlight() {
	const light = useRef<DirectionalLight>(null);
	useFrame(({ camera }) => {
		light.current?.position.copy(camera.position);
	});
	return <directionalLight ref={light} intensity={2} />;
}

/** The floor grid */
function Floor() {
	const line = useThemeColor('var(--border)');
	// Grid helpers are drawn in the XZ plane, turned onto the floor
	return <gridHelper args={[gridSize, gridDivisions, line, line]} rotation={[Math.PI / 2, 0, 0]} />;
}

const labelEdge = gridSize / 2 + 0.25;
/** Labels beside the grid for which way the robot's front and left are */
const floorLabels = [
	{ text: '+X front', position: new Vector3(labelEdge, 0, 0) },
	{ text: '+Y left', position: new Vector3(0, labelEdge, 0) },
];

/** Calls `callback` on every frame the scene is drawn */
function OnFrame({ callback }: { callback: (state: RootState) => void }) {
	useFrame(callback);
	return null;
}

/** What held keys do each second: radians to orbit, factor to zoom, and pixels to pan */
const orbitSpeed = 1.5;
const zoomSpeed = 3;
const panSpeed = 500;
const keys: Partial<Record<string, (rig: Rig, seconds: number) => void>> = {
	arrowleft: (rig, seconds) => rig.orbit(-orbitSpeed * seconds, 0),
	arrowright: (rig, seconds) => rig.orbit(orbitSpeed * seconds, 0),
	arrowup: (rig, seconds) => rig.orbit(0, orbitSpeed * seconds),
	arrowdown: (rig, seconds) => rig.orbit(0, -orbitSpeed * seconds),
	w: (rig, seconds) => rig.zoom(zoomSpeed ** seconds),
	s: (rig, seconds) => rig.zoom(zoomSpeed ** -seconds),
	a: (rig, seconds) => rig.pan(-panSpeed * seconds, 0),
	d: (rig, seconds) => rig.pan(panSpeed * seconds, 0),
	q: (rig, seconds) => rig.pan(0, -panSpeed * seconds),
	e: (rig, seconds) => rig.pan(0, panSpeed * seconds),
};

/** How a pointer drag moves the camera, following drei's orbit controls */
function dragOf(event: PointerEvent): 'orbit' | 'pan' | undefined {
	if (event.button === 2 || (event.button === 0 && (event.ctrlKey || event.metaKey || event.shiftKey))) {
		return 'pan';
	}
	return event.button === 0 ? 'orbit' : undefined;
}

/**
 * A 3D scene that fills its parent, drawn over the pane's background. Drag to orbit, right-drag to pan, scroll to zoom,
 * double-click to reset, and while it's focused hold the arrow keys to orbit, W and S to zoom, and A, D, Q, and E to pan.
 */
export function Scene3d({ ref, label, children }: { ref?: Ref<Scene3dHandle>; label: string; children: ReactNode }) {
	const rig = useRef<Rig>(null);
	useImperativeHandle(ref, () => ({ setView: (view) => rig.current?.setView(view) }));

	const labels = useRef<(HTMLSpanElement | null)[]>([]);
	/** Moves the floor labels, which are drawn over the canvas, to where their positions are on screen */
	const positionLabels = ({ camera, size }: RootState) => {
		for (const [index, { position }] of floorLabels.entries()) {
			const element = labels.current[index];
			if (element) {
				const { x, y } = position.clone().project(camera);
				element.style.transform = `translate(${((x + 1) / 2) * size.width}px, ${((1 - y) / 2) * size.height}px) translate(-50%, -50%)`;
			}
		}
	};

	// Held keys move the camera every frame until they're released
	const held = useRef(new Set<string>());
	const frame = useRef<number>(undefined);
	const move = (last: number) => (now: number) => {
		for (const key of held.current) {
			if (rig.current) {
				keys[key]?.(rig.current, (now - last) / 1000);
			}
		}
		frame.current = held.current.size > 0 ? requestAnimationFrame(move(now)) : undefined;
	};
	useEffect(
		() => () => {
			if (frame.current !== undefined) {
				cancelAnimationFrame(frame.current);
			}
		},
		[],
	);

	const onKeyDown = (event: KeyboardEvent) => {
		const key = event.key.toLowerCase();
		if (event.metaKey || event.ctrlKey || event.altKey || keys[key] === undefined) {
			return;
		}
		// Handled keys don't also step the timeline
		event.preventDefault();
		if (!held.current.has(key)) {
			held.current.add(key);
			rig.current?.stop();
			frame.current ??= requestAnimationFrame(move(performance.now()));
		}
	};

	const [drag, setDrag] = useState<'orbit' | 'pan'>();
	// The orbit controls keep the browser from focusing the scene on click, so it's focused from script, which the browser
	// treats like keyboard focus. The focus ring is only shown when it wasn't focused by the pointer.
	const pointerFocus = useRef(false);
	const [keyboardFocus, setKeyboardFocus] = useState(false);

	return (
		// oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- An application handles its own keys
		<div
			role="application"
			// oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Focused for its keyboard controls
			tabIndex={0}
			aria-label={`${label}. Drag to orbit, scroll or W and S to zoom, A, D, Q, and E to pan.`}
			className={cn(
				'relative size-full touch-none overflow-hidden rounded-md outline-none select-none',
				keyboardFocus && 'ring-2 ring-ring',
				drag === 'orbit' && 'cursor-grabbing',
				drag === 'pan' && 'cursor-move',
			)}
			onPointerDown={(event) => {
				pointerFocus.current = true;
				event.currentTarget.focus({ preventScroll: true });
				pointerFocus.current = false;
				setKeyboardFocus(false);
				rig.current?.stop();
				setDrag(dragOf(event.nativeEvent));
			}}
			onPointerUp={() => setDrag(undefined)}
			onPointerCancel={() => setDrag(undefined)}
			onLostPointerCapture={() => setDrag(undefined)}
			onWheel={() => rig.current?.stop()}
			onKeyDown={onKeyDown}
			onKeyUp={(event) => {
				held.current.delete(event.key.toLowerCase());
			}}
			onFocus={() => setKeyboardFocus(!pointerFocus.current)}
			onBlur={() => {
				held.current.clear();
				setKeyboardFocus(false);
			}}
			onDoubleClick={() => rig.current?.setView('reset')}
			// Right-dragging pans, so it doesn't open the widget's menu
			onContextMenu={(event) => {
				event.preventDefault();
				event.stopPropagation();
			}}
		>
			<Canvas orthographic frameloop="demand" camera={{ up: [0, 0, 1], near: 0.1, far: cameraDistance * 4 }}>
				<OrbitControls makeDefault enableDamping={false} minPolarAngle={0} maxPolarAngle={Math.PI / 2} />
				<CameraRig ref={rig} />
				<ambientLight intensity={1.5} />
				<Headlight />
				<Floor />
				<OnFrame callback={positionLabels} />
				{children}
			</Canvas>
			{floorLabels.map(({ text }, index) => (
				<span
					key={text}
					ref={(element) => {
						labels.current[index] = element;
					}}
					className="pointer-events-none absolute top-0 left-0 whitespace-nowrap text-muted-foreground text-xs"
				>
					{text}
				</span>
			))}
		</div>
	);
}
