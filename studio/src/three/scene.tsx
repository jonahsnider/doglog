// A 3D scene in WPILib's robot coordinates (meters, +X forward, +Y left, +Z up), with an orbiting orthographic camera.
import { Canvas, type RootState, useFrame, useThree } from '@react-three/fiber';
import { type KeyboardEvent, type ReactNode, type Ref, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { PMREMGenerator, Vector3 } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { cn } from '@/lib/utils';
import { CameraControls, CameraRig, cameraDistance, type Rig, shiftSpeedup } from '@/three/camera';
import { useThemeColor } from '@/three/theme';
import { ViewCube } from '@/three/view-cube';

const gridSize = 2.4;
const gridDivisions = 6;

function StudioLighting() {
	const get = useThree((state) => state.get);
	useEffect(() => {
		const { gl, scene, invalidate } = get();
		const room = new RoomEnvironment();
		const generator = new PMREMGenerator(gl);
		// Soften the room's bright light panels even in the reflections of smooth CAD surfaces.
		const environment = generator.fromScene(room, 0.35);
		generator.dispose();
		room.dispose();
		scene.environment = environment.texture;
		scene.environmentIntensity = 0.65;
		// The room is Y-up; the robot is Z-up.
		scene.environmentRotation.x = Math.PI / 2;
		invalidate();
		return () => {
			scene.environment = null;
			environment.dispose();
		};
	}, [get]);
	return null;
}

function Floor() {
	const line = useThemeColor('var(--border)');
	// Grid helpers are drawn in the XZ plane, turned onto the floor
	return <gridHelper args={[gridSize, gridDivisions, line, line]} rotation={[Math.PI / 2, 0, 0]} />;
}

const labelEdge = gridSize / 2 + 0.25;
const floorLabels = [
	{ text: '+X front', position: new Vector3(labelEdge, 0, 0) },
	{ text: '+Y left', position: new Vector3(0, labelEdge, 0) },
];

function OnFrame({ callback }: { callback: (state: RootState) => void }) {
	useFrame(callback);
	return null;
}

/** What held keys do each second: radians to orbit, factor to zoom, and pixels to pan. Zooming and panning go `speed` times as fast. */
const orbitSpeed = 1.5;
const zoomSpeed = 3;
const panSpeed = 500;
const keys: Partial<Record<string, (rig: Rig, seconds: number, speed: number) => void>> = {
	arrowleft: (rig, seconds) => rig.orbit(-orbitSpeed * seconds, 0),
	arrowright: (rig, seconds) => rig.orbit(orbitSpeed * seconds, 0),
	arrowup: (rig, seconds) => rig.orbit(0, orbitSpeed * seconds),
	arrowdown: (rig, seconds) => rig.orbit(0, -orbitSpeed * seconds),
	w: (rig, seconds, speed) => rig.zoom(zoomSpeed ** (seconds * speed)),
	s: (rig, seconds, speed) => rig.zoom(zoomSpeed ** (-seconds * speed)),
	a: (rig, seconds, speed) => rig.pan(-panSpeed * seconds * speed, 0),
	d: (rig, seconds, speed) => rig.pan(panSpeed * seconds * speed, 0),
	q: (rig, seconds, speed) => rig.pan(0, -panSpeed * seconds * speed),
	e: (rig, seconds, speed) => rig.pan(0, panSpeed * seconds * speed),
};

function dragOf(event: PointerEvent): 'orbit' | 'pan' | undefined {
	if (event.button === 2 || (event.button === 0 && (event.ctrlKey || event.metaKey || event.shiftKey))) {
		return 'pan';
	}
	return event.button === 0 ? 'orbit' : undefined;
}

// Whether the last input was a key press, so focus moved by script (ex. a menu returning focus after a click, or the
// scene focusing itself on pointer down) only shows the focus ring when using the keyboard
let keyboardInput = false;
// Tests import this module through the widget registry without a DOM
if (typeof window !== 'undefined') {
	addEventListener(
		'keydown',
		() => {
			keyboardInput = true;
		},
		{ capture: true },
	);
	addEventListener(
		'pointerdown',
		() => {
			keyboardInput = false;
		},
		{ capture: true },
	);
}

/**
 * A 3D scene that fills its parent, drawn over the pane's background, with a view cube to look from set directions.
 * Drag to orbit, right-drag to pan, scroll to zoom, and double-click to reset. While it's
 * focused, hold the arrow keys to orbit, W and S to zoom, and A, D, Q, and E to pan. Hold Shift to zoom and pan faster.
 */
/** Moves the camera of a `Scene3d` from outside it, ex. a reset button in the widget's toolbar */
export type Scene3dHandle = { reset: () => void };

export function Scene3d({ ref, label, children }: { ref?: Ref<Scene3dHandle>; label: string; children: ReactNode }) {
	const rig = useRef<Rig>(null);
	useImperativeHandle(ref, () => ({ reset: () => rig.current?.reset() }));
	const [cubeHovered, setCubeHovered] = useState(false);

	const labels = useRef<(HTMLSpanElement | null)[]>([]);
	// Hidden until the canvas is sized and drawn, it starts at the browser's default size with the labels in the corner
	const [drawn, setDrawn] = useState(false);
	/** Moves the floor labels, which are drawn over the canvas, to where their positions are on screen */
	const positionLabels = ({ camera, size }: RootState) => {
		if (!drawn && size.width > 0) {
			setDrawn(true);
		}
		for (const [index, { position }] of floorLabels.entries()) {
			const element = labels.current[index];
			if (element) {
				const { x, y } = position.clone().project(camera);
				element.style.transform = `translate(${((x + 1) / 2) * size.width}px, ${((1 - y) / 2) * size.height}px) translate(-50%, -50%)`;
			}
		}
	};

	const held = useRef(new Set<string>());
	const shift = useRef(false);
	const frame = useRef<number>(undefined);
	const move = (last: number) => (now: number) => {
		for (const key of held.current) {
			if (rig.current) {
				keys[key]?.(rig.current, (now - last) / 1000, shift.current ? shiftSpeedup : 1);
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
		shift.current = event.shiftKey;
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
	// treats like keyboard focus. The focus ring is only shown when the keyboard was used last.
	const [keyboardFocus, setKeyboardFocus] = useState(false);

	return (
		// oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- An application handles its own keys
		<div
			role="application"
			// oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Focused for its keyboard controls
			tabIndex={0}
			data-capture-pending={drawn ? undefined : ''}
			aria-label={`${label}. Drag to orbit, scroll or W and S to zoom, A, D, Q, and E to pan, hold Shift to go faster.`}
			className={cn(
				'relative size-full touch-none overflow-hidden rounded-md outline-none select-none capture:transition-none',
				keyboardFocus && 'ring-2 ring-ring',
				drawn ? 'opacity-100 motion-safe:transition-opacity motion-safe:duration-150' : 'opacity-0',
				drag === 'orbit' && 'cursor-grabbing',
				drag === 'pan' && 'cursor-move',
				drag === undefined && cubeHovered && 'cursor-pointer',
			)}
			onPointerDown={(event) => {
				event.currentTarget.focus({ preventScroll: true });
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
				shift.current = event.shiftKey;
				held.current.delete(event.key.toLowerCase());
			}}
			onFocus={() => setKeyboardFocus(keyboardInput)}
			onBlur={() => {
				held.current.clear();
				shift.current = false;
				setKeyboardFocus(false);
			}}
			onDoubleClick={() => rig.current?.reset()}
			// Right-dragging pans, so it doesn't open the widget's menu
			onContextMenu={(event) => {
				event.preventDefault();
				event.stopPropagation();
			}}
		>
			<Canvas orthographic frameloop="demand" camera={{ up: [0, 0, 1], near: 0, far: cameraDistance * 2 }}>
				<CameraControls />
				<CameraRig ref={rig} />
				<StudioLighting />
				<Floor />
				<OnFrame callback={positionLabels} />
				{children}
				<ViewCube onLookFrom={(direction) => rig.current?.lookFrom(direction)} onHoverChange={setCubeHovered} />
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
