// Draws the 3D field's AprilTags, from WPILib's 36h11 family, see `@/three/field-scene`
import {
	CanvasTexture,
	Matrix4,
	Mesh,
	MeshStandardMaterial,
	type Object3D,
	PlaneGeometry,
	SRGBColorSpace,
	Vector3,
} from 'three';
import { aprilTagPatterns, tagSize } from '@/three/apriltag-patterns';

/** Pixels in each of the tag's squares */
const squarePixels = 20;
/**
 * The sheet a tag is printed on, about 10.5 inches across, in pixels. Its white margin is wider than a square, so the
 * ID fits below the tag without touching it.
 */
const sheetPixels = 258;
/** The sheet's size in meters */
const sheetSize = (sheetPixels / (squarePixels * 8)) * tagSize;

const textures = new Map<number, CanvasTexture>();

/** A tag's sheet with its pattern and its ID below it */
function aprilTagTexture(id: number): CanvasTexture | undefined {
	const pattern = aprilTagPatterns[id];
	if (pattern === undefined) {
		return undefined;
	}
	let texture = textures.get(id);
	if (!texture) {
		const canvas = document.createElement('canvas');
		canvas.width = sheetPixels;
		canvas.height = sheetPixels;
		const context = canvas.getContext('2d')!;
		const tagStart = (sheetPixels - squarePixels * 8) / 2;
		const tagEnd = tagStart + squarePixels * 8;
		context.fillStyle = '#fff';
		context.fillRect(0, 0, sheetPixels, sheetPixels);
		context.fillStyle = '#000';
		context.fillRect(tagStart, tagStart, squarePixels * 8, squarePixels * 8);
		context.fillStyle = '#fff';
		for (let index = 0; index < pattern.length; index++) {
			if (pattern[index] === '1') {
				const column = (index % 6) + 1;
				const row = Math.floor(index / 6) + 1;
				context.fillRect(tagStart + column * squarePixels, tagStart + row * squarePixels, squarePixels, squarePixels);
			}
		}
		// Below the tag's white border, which cameras need to find it
		context.fillStyle = '#000';
		context.font = '700 28px sans-serif';
		context.textAlign = 'center';
		context.textBaseline = 'middle';
		context.fillText(String(id), sheetPixels / 2, (tagEnd + squarePixels + sheetPixels) / 2);
		texture = new CanvasTexture(canvas);
		texture.colorSpace = SRGBColorSpace;
		texture.anisotropy = 8;
		textures.set(id, texture);
	}
	return texture;
}

/**
 * A tag's sheet, facing out of the tag's +X with its top toward +Z, like WPILib's tag poses. It's lifted off the part
 * it's on, which the model's tag poses are on the face of.
 */
const aprilTagSheet = new PlaneGeometry(sheetSize, sheetSize)
	.applyMatrix4(new Matrix4().makeBasis(new Vector3(0, 1, 0), new Vector3(0, 0, 1), new Vector3(1, 0, 0)))
	.translate(0.001, 0, 0);

/** Draws a sheet with its pattern and ID on each of the field model's AprilTag nodes, see `scripts/field-model.ts` */
export function addAprilTags(model: Object3D) {
	const tags: [Object3D, number][] = [];
	model.traverse((object) => {
		const id: unknown = object.userData['aprilTag'];
		if (typeof id === 'number') {
			tags.push([object, id]);
		}
	});
	for (const [tag, id] of tags) {
		const texture = aprilTagTexture(id);
		if (texture) {
			tag.add(
				new Mesh(
					aprilTagSheet,
					// Shares the model's low-gloss look, and stays in front of the part it's on like the model's stickers
					new MeshStandardMaterial({
						map: texture,
						roughness: 1,
						polygonOffset: true,
						polygonOffsetFactor: -1,
						polygonOffsetUnits: -4,
					}),
				),
			);
		}
	}
	return model;
}
