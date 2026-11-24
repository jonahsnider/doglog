import { Line } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { type CanvasTexture, DoubleSide, LinearFilter, MathUtils, type Matrix4, SRGBColorSpace } from 'three';

/** The stock low-distortion lens on a common global-shutter USB camera. */
export const defaultCameraFov = 70;
const imageDistance = 0.5;

export type CameraImage = { canvas: HTMLCanvasElement; width: number; height: number };

export function CameraFrustum({
	pose,
	image,
	fov,
	color,
}: {
	pose: Matrix4;
	image: CameraImage;
	fov: number;
	color: string;
}) {
	const { canvas, width, height } = image;
	const invalidate = useThree((state) => state.invalidate);
	const texture = useRef<CanvasTexture>(null);
	useEffect(() => {
		const update = () => {
			const map = texture.current;
			if (map) {
				map.needsUpdate = true;
			}
			invalidate();
		};
		canvas.addEventListener('frame', update);
		update();
		return () => canvas.removeEventListener('frame', update);
	}, [canvas, invalidate]);

	const halfWidth = imageDistance * Math.tan(MathUtils.degToRad(fov) / 2);
	const halfHeight = halfWidth * (height / width);
	const points = useMemo(() => {
		const lens = [0, 0, 0] as const;
		const topLeft = [imageDistance, halfWidth, halfHeight] as const;
		const topRight = [imageDistance, -halfWidth, halfHeight] as const;
		const bottomLeft = [imageDistance, halfWidth, -halfHeight] as const;
		const bottomRight = [imageDistance, -halfWidth, -halfHeight] as const;
		return [
			lens,
			topLeft,
			lens,
			topRight,
			lens,
			bottomLeft,
			lens,
			bottomRight,
			topLeft,
			topRight,
			topRight,
			bottomRight,
			bottomRight,
			bottomLeft,
			bottomLeft,
			topLeft,
		];
	}, [halfWidth, halfHeight]);
	return (
		<group matrix={pose} matrixAutoUpdate={false}>
			{/* The lens looks along +X. Image right is -Y and image up is +Z. */}
			<mesh
				position={[imageDistance, 0, 0]}
				rotation={[0, -Math.PI / 2, -Math.PI / 2]}
				scale={[2 * halfWidth, 2 * halfHeight, 1]}
			>
				<planeGeometry />
				<meshBasicMaterial side={DoubleSide} toneMapped={false}>
					<canvasTexture
						ref={texture}
						key={`${width}x${height}`}
						attach="map"
						args={[canvas]}
						colorSpace={SRGBColorSpace}
						generateMipmaps={false}
						minFilter={LinearFilter}
					/>
				</meshBasicMaterial>
			</mesh>
			<Line segments points={points} color={color} lineWidth={1.5} />
		</group>
	);
}
