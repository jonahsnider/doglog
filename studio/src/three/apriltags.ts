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

/**
 * The 36h11 family's codes by ID, from the AprilTag library's `tag36h11.c`. Only the IDs FRC fields use are included,
 * more can be copied from there in order.
 */
const codes = [
	0xd7e00984b, 0xdda664ca7, 0xdc4a1c821, 0xe17b470e9, 0xef91d01b1, 0xf429cdd73, 0x05da29225, 0x1106cba43, 0x223bed79d,
	0x21f51213c, 0x33eb19ca6, 0x3f76eb0f8, 0x469a97414, 0x45dcfe0b0, 0x4a6465f72, 0x51801db96, 0x5eb946b4e, 0x68a7cc2ec,
	0x6f0ba2652, 0x78765559d, 0x87b83d129, 0x86cc4a5c5, 0x8b64df90f, 0x9c577b611, 0xa3810f2f5, 0xaf4d75b83, 0xb59a03fef,
	0xbb1096f85, 0xd1b92fc76, 0xd0dd509d2, 0xe2cfda160, 0x2ff497c63, 0x47240671b,
];
/**
 * Where each of a code's 36 bits goes, from its most significant, as columns and rows of the tag's 8 by 8 squares from
 * its top left, inside its black border
 */
const bitSquares = [
	[1, 1],
	[2, 1],
	[3, 1],
	[4, 1],
	[5, 1],
	[2, 2],
	[3, 2],
	[4, 2],
	[3, 3],
	[6, 1],
	[6, 2],
	[6, 3],
	[6, 4],
	[6, 5],
	[5, 2],
	[5, 3],
	[5, 4],
	[4, 3],
	[6, 6],
	[5, 6],
	[4, 6],
	[3, 6],
	[2, 6],
	[5, 5],
	[4, 5],
	[3, 5],
	[4, 4],
	[1, 6],
	[1, 5],
	[1, 4],
	[1, 3],
	[1, 2],
	[2, 5],
	[2, 4],
	[2, 3],
	[3, 4],
] as const;

/** The tag's black square is 6.5 inches across, 8 squares */
const tagSize = 6.5 * 0.0254;
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

/** A tag's sheet with its pattern and its ID below it, or `undefined` for an ID that isn't in `codes` */
function aprilTagTexture(id: number): CanvasTexture | undefined {
	const code = codes[id];
	if (code === undefined) {
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
		for (const [index, [column, row]] of bitSquares.entries()) {
			if (Math.floor(code / 2 ** (bitSquares.length - 1 - index)) % 2 === 1) {
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
