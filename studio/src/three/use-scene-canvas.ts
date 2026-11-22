import type { RootState } from '@react-three/fiber';
import { useInsertionEffect, useLayoutEffect, useRef } from 'react';
import { PMREMGenerator, type WebGLRenderTarget } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export function useSceneCanvas() {
	const root = useRef<{ get: RootState['get']; environment: WebGLRenderTarget }>(undefined);
	const visible = useRef(false);

	// Activity hides the canvas and disconnects layout effects, but its WebGL context stays alive.
	useLayoutEffect(() => {
		visible.current = true;
		const state = root.current?.get();
		state?.setFrameloop('demand');
		state?.invalidate();
		return () => {
			visible.current = false;
			root.current?.get().setFrameloop('never');
		};
	}, []);
	// Match the canvas's lifetime: only discard the baked lighting when the context is removed, not while hidden.
	useInsertionEffect(() => () => root.current?.environment.dispose(), []);

	const onCreated = ({ get, gl, scene, setFrameloop, invalidate }: RootState) => {
		if (root.current?.get !== get) {
			root.current?.environment.dispose();
			const room = new RoomEnvironment();
			const generator = new PMREMGenerator(gl);
			// Soften the room's bright panels in the reflections of smooth CAD surfaces.
			const environment = generator.fromScene(room, 0.35);
			generator.dispose();
			room.dispose();
			scene.environment = environment.texture;
			scene.environmentIntensity = 0.65;
			// The room is Y-up; the robot is Z-up.
			scene.environmentRotation.x = Math.PI / 2;
			root.current = { get, environment };
		}
		if (visible.current) {
			invalidate();
		} else {
			setFrameloop('never');
		}
	};
	return { onCreated, frameloop: 'demand' } as const;
}
