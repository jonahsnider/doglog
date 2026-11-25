// A 3D scene in WPILib's robot coordinates (meters, +X forward, +Y left, +Z up), with an orbiting orthographic camera.
import { colorVars, radiusVars, typeScaleVars } from '@astryxdesign/core/theme/tokens.stylex';
import { PerspectiveCamera } from '@react-three/drei';
import { Canvas, type RootState, useFrame } from '@react-three/fiber';
import { type KeyboardEvent, type ReactNode, type Ref, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as stylex from '@stylexjs/stylex';
import { Vector3 } from 'three';
import { CameraControls, CameraRig, cameraDistance, type Rig } from '@/three/camera';
import { cameraKeys } from '@/three/camera-keys';
import { shiftSpeedup } from '@/three/orbit';
import { useRightClickMenu } from '@/three/right-click-menu';
import { useThemeColor } from '@/three/theme';
import { FieldCameraControls, FieldCameraRig } from '@/three/field-camera';
import { ResizeWithPane } from '@/three/resize';
import type { FieldFraming } from '@/three/field-framing';
import { ViewCube } from '@/three/view-cube';
import { useSceneCanvas } from '@/three/use-scene-canvas';
import type { CameraMatch } from '@/widgets/field/camera-match';

const styles = stylex.create({
	scene: { position: 'relative', width: '100%', height: '100%', overflow: 'hidden', touchAction: 'none' },
	frame: { borderRadius: radiusVars['--radius-element'], outline: 'none', userSelect: 'none' },
	keyboardFocus: { outline: '2px solid var(--focus-outline-color)' },
	hidden: { opacity: 0 },
	orbit: { cursor: 'grabbing' },
	pan: { cursor: 'move' },
	pointing: { cursor: 'pointer' },
	label: { pointerEvents: 'none', position: 'absolute', top: 0, left: 0, whiteSpace: 'nowrap', lineHeight: '1rem' },
	labelText: { color: colorVars['--color-text-secondary'], fontSize: typeScaleVars['--text-supporting-size'] },
});

const gridSize = 2.4;
const gridDivisions = 6;

function Floor() {
	const line = useThemeColor('var(--md-outline-variant)');
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

/** Moves the camera of a `Scene3d` from outside it, ex. a reset button in the widget's toolbar */
export type Scene3dHandle = Pick<Rig, 'reset'> & Required<Pick<Rig, 'follow'>>;

export function Scene3d({
	ref,
	label,
	field,
	following,
	onStopFollowing,
	viewKey,
	cameraMatch,
	onExitCameraMatch,
	children,
}: {
	ref?: Ref<Scene3dHandle>;
	label: string;
	/** Shows a field with a perspective camera instead of a robot, without the robot's floor grid and view cube */
	field?: FieldFraming;
	/** The camera follows a robot, see `Rig.follow`: moving with it, or from a driver station until it's moved */
	following?: 'robot' | 'driver-station';
	/** The user reset the view, or moved it while following from a driver station, which stops following */
	onStopFollowing?: () => void;
	/** Keeps the field's view while the app is open when the scene is drawn again, ex. the pane's ID */
	viewKey?: string;
	cameraMatch?: CameraMatch;
	onExitCameraMatch?: () => void;
	children: ReactNode;
}) {
	const rig = useRef<Rig>(null);
	useImperativeHandle(ref, () => ({
		reset: () => (cameraMatch ? onExitCameraMatch?.() : rig.current?.reset()),
		follow: (position, from) => rig.current?.follow?.(position, from),
	}));
	const [cubeHovered, setCubeHovered] = useState(false);
	const canvas = useSceneCanvas();

	const labels = useRef<(HTMLSpanElement | null)[]>([]);
	// Hidden until the canvas is sized and drawn, it starts at the browser's default size with the labels in the corner
	const [drawn, setDrawn] = useState(false);
	/** Moves the floor labels, which are drawn over the canvas, to where their positions are on screen */
	const positionLabels = ({ camera, size }: RootState) => {
		if (!drawn && size.width > 0) {
			setDrawn(true);
		}
		if (field) {
			return;
		}
		for (const [index, floorLabel] of floorLabels.entries()) {
			const element = labels.current[index];
			if (element) {
				const { x, y } = floorLabel.position.clone().project(camera);
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
				cameraKeys[key]?.(rig.current, (now - last) / 1000, shift.current ? shiftSpeedup : 1);
			}
		}
		frame.current = held.current.size > 0 ? requestAnimationFrame(move(now)) : undefined;
	};
	useEffect(
		() => () => {
			held.current.clear();
			shift.current = false;
			if (frame.current !== undefined) {
				cancelAnimationFrame(frame.current);
				frame.current = undefined;
			}
		},
		[],
	);

	const onKeyDown = (event: KeyboardEvent) => {
		shift.current = event.shiftKey;
		const key = event.key.toLowerCase();
		if (cameraMatch || event.metaKey || event.ctrlKey || event.altKey || cameraKeys[key] === undefined) {
			return;
		}
		// Handled keys don't also step the timeline
		event.preventDefault();
		if (!held.current.has(key)) {
			held.current.add(key);
			if (following === 'driver-station') {
				onStopFollowing?.();
			}
			rig.current?.stop();
			frame.current = frame.current ?? requestAnimationFrame(move(performance.now()));
		}
	};

	const [drag, setDrag] = useState<'orbit' | 'pan'>();
	// Dragging moves the camera, which stops following from a driver station. Clicking doesn't.
	const rightClick = useRightClickMenu(() => {
		if (following === 'driver-station' && !cameraMatch) {
			onStopFollowing?.();
		}
	});
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
			aria-label={
				cameraMatch
					? `${label}. Camera matched to video.`
					: `${label}. Drag to orbit, scroll or W and S to zoom, A, D, Q, and E to pan, hold Shift to go faster.`
			}
			{...stylex.props(
				styles.scene,
				styles.frame,
				keyboardFocus && styles.keyboardFocus,
				!drawn && styles.hidden,
				drag !== undefined && styles[drag],
				drag === undefined && cubeHovered && styles.pointing,
			)}
			onPointerDown={(event) => {
				event.currentTarget.focus({ preventScroll: true });
				setKeyboardFocus(false);
				rig.current?.stop();
				const next = cameraMatch ? undefined : dragOf(event.nativeEvent);
				setDrag(next);
				rightClick.onPointerDown(event);
			}}
			onPointerMove={rightClick.onPointerMove}
			onPointerUp={(event) => {
				setDrag(undefined);
				rightClick.onPointerUp(event);
			}}
			onPointerCancel={() => setDrag(undefined)}
			onLostPointerCapture={() => setDrag(undefined)}
			onWheel={() => {
				rig.current?.stop();
				if (following === 'driver-station') {
					onStopFollowing?.();
				}
			}}
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
			onDoubleClick={() => {
				if (cameraMatch) {
					onExitCameraMatch?.();
				} else {
					rig.current?.reset();
					onStopFollowing?.();
				}
			}}
			// Right-dragging pans, so the widget's menu opens when a right-click is released instead
			onContextMenu={rightClick.onContextMenu}
		>
			{field ? (
				<Canvas {...canvas} camera={{ fov: field.fov, up: [0, 0, 1], near: 0.05, far: 200 }}>
					<ResizeWithPane />
					{cameraMatch ? (
						// A separate camera preserves roll and the recorded pose, independent of orbit limits.
						<PerspectiveCamera
							makeDefault
							near={0.05}
							far={200}
							position={cameraMatch.position}
							quaternion={cameraMatch.quaternion}
							fov={cameraMatch.verticalFov}
						/>
					) : (
						<>
							<FieldCameraControls field={field} following={following === 'robot'} />
							<FieldCameraRig ref={rig} field={field} viewKey={viewKey} />
						</>
					)}
					<OnFrame callback={positionLabels} />
					{children}
				</Canvas>
			) : (
				<>
					<Canvas {...canvas} orthographic camera={{ up: [0, 0, 1], near: 0, far: cameraDistance * 2 }}>
						<ResizeWithPane />
						<CameraControls />
						<CameraRig ref={rig} />
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
							{...stylex.props(styles.label, styles.labelText)}
						>
							{text}
						</span>
					))}
				</>
			)}
		</div>
	);
}
