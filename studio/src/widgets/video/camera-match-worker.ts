import { AR } from 'js-aruco2';
import { Quaternion, Vector3 } from 'three';
import * as z from 'zod';
import { aprilTagPatterns } from '@/three/apriltag-patterns';
import fieldModel from '@/widgets/field/2026-rebuilt.glb?url';
import type { CameraMatch } from '@/widgets/field/camera-match';
import { estimateCamera } from '@/widgets/video/estimate-camera';

export type CameraMatchResult = { match: CameraMatch } | { failure: 'tags' | 'pose' | 'analysis' };

AR.DICTIONARIES['tag36h11'] = {
	nBits: 36,
	tau: 11,
	codeList: aprilTagPatterns.map((bits) => Number.parseInt(bits, 2)),
};
const detector = new AR.Detector({ dictionaryName: 'tag36h11', maxHammingDistance: 3 });

const modelSchema = z.object({
	nodes: z.array(
		z.object({
			extras: z.object({ aprilTag: z.number().optional() }).optional(),
			translation: z.tuple([z.number(), z.number(), z.number()]).optional(),
			rotation: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
		}),
	),
});

/** Read the same official tag poses the field renders, without decoding the model's meshes or textures. */
async function fieldTags() {
	const response = await fetch(fieldModel);
	if (!response.ok) {
		throw new Error('Could not load the field model');
	}
	const binary = await response.arrayBuffer();
	// The bundled GLB starts with a 12-byte file header and an 8-byte JSON chunk header.
	const length = new DataView(binary).getUint32(12, true);
	const { nodes } = modelSchema.parse(JSON.parse(new TextDecoder().decode(new Uint8Array(binary, 20, length))));
	const tags = new Map<number, { position: Vector3; rotation: Quaternion }>();
	for (const { extras, translation, rotation } of nodes) {
		if (extras?.aprilTag !== undefined) {
			tags.set(extras.aprilTag, {
				position: new Vector3(...(translation ?? [0, 0, 0])),
				rotation: new Quaternion(...(rotation ?? [0, 0, 0, 1])),
			});
		}
	}
	return tags;
}

async function matchFrame(image: ImageData): Promise<CameraMatchResult> {
	// Don't count the same ID twice if concentric contours decoded as the same tag. Keep the better decode.
	const detected = detector.detect(image).toSorted((a, b) => b.hammingDistance - a.hammingDistance);
	const unique = new Map(detected.map((tag) => [tag.id, tag]));
	if (unique.size < 2) {
		return { failure: 'tags' };
	}
	const layout = await fieldTags();
	const observations = [...unique.values()].flatMap(({ id, corners }) => {
		const pose = layout.get(id);
		return pose ? [{ ...pose, corners }] : [];
	});
	if (observations.length < 2) {
		return { failure: 'tags' };
	}
	const match = estimateCamera(observations, image.width, image.height);
	return match ? { match } : { failure: 'pose' };
}

addEventListener('message', (event: MessageEvent<ImageData>) => {
	void matchFrame(event.data).then(
		(result) => postMessage(result),
		() => postMessage({ failure: 'analysis' } satisfies CameraMatchResult),
	);
});
