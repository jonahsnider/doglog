// Converts FIRST's official field CAD into the field widget's 3D model, see `src/three/field-scene.tsx`. Run it once a
// season with the STEP file's URL or path: `node scripts/field-model.ts <step>`. The resulting GLB is committed and bundled with Studio.
//
// The model is written in WPILib 2026's field coordinates: meters, origin at the blue alliance wall's corner on the
// scoring table side, +X toward red, +Z up. Fasteners and other small hardware are removed, the rest is simplified and
// compressed, and the game pieces staged at the start of a match and the field's perimeter are each put under one node
// so the widget can hide them or make them see-through.
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join as joinPath } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	type Document,
	getBounds,
	type Material,
	type Mesh,
	type Node,
	NodeIO,
	type Primitive,
} from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRMaterialsUnlit } from '@gltf-transform/extensions';
import {
	clearNodeTransform,
	dedup,
	instance,
	join,
	meshopt,
	prune,
	quantize,
	simplify,
	weld,
} from '@gltf-transform/functions';
import { IcosahedronGeometry } from 'three';
import * as z from 'zod';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';

const output = new URL('../src/widgets/field/2026-rebuilt.glb', import.meta.url);
/** The uv project that converts the STEP file, see its `pyproject.toml` */
const converterProject = fileURLToPath(new URL('field3d', import.meta.url));
const converter = fileURLToPath(new URL('field3d/step_to_glb.py', import.meta.url));

/** Field size in meters, from the 2026 field drawings, matching `@/widgets/field/geometry` */
const fieldLength = 16.541;
const fieldWidth = 8.069;
/** Node holding the staged game pieces, see `stagedGamePiecesNode` in `@/three/field-scene`. three.js replaces spaces in names. */
const stagedGamePiecesNode = 'StagedGamePieces';
/** Node holding the field's perimeter, which the widget can make see-through, see `fieldBorderNode` in `@/three/field-scene` */
const fieldBorderNode = 'FieldBorder';
/** The guardrails and alliance walls, with the driver stations */
const perimeter = /^FE-2026-02: Welded Perimeter Assy/u;
const gamePiece = /^GE-26900: Fuel/u;
/** Too small to see on the field, and most of the model's triangles */
const hardware =
	/\b(PEM|screw|bolt|nut|washer|rivet|bearing|spacer|standoff|insert|pin|zip ?tie|cable tie|grommet|clip|pulley|gear|sprocket|belt|hex bore)\b|^REV-|^WCP-|^\d+\/\d+-\d+|^#\d+-\d+|\b9\d{4}A\d+\b/iu;
/**
 * Placeholder blocks outside the field, which hide the field from the default view, tape under the carpet, and the
 * AprilTags' stickers, which are plain in the CAD and drawn by the widget instead, see `aprilTagLayout`
 */
const unseen = /scoring table|seaming tape|apriltag vinyl/iu;
/**
 * WPILib's AprilTag layout for the field, in its 2026 coordinates, which the CAD's tags match. Each tag is written as
 * a node at its pose (+X out of its face, +Z up), with its ID in `extras.aprilTag`, see `@/three/apriltags`.
 */
const aprilTagLayout =
	'https://raw.githubusercontent.com/wpilibsuite/allwpilib/v2026.2.2/apriltag/src/main/native/resources/edu/wpi/first/apriltag/2026-rebuilt-welded.json';
const carpet = /carpet/iu;
/**
 * Meters that tape and other parts lying flat on the carpet are lifted by. They're modeled a fraction of a millimeter
 * thick, less than the depth buffer and the compressed model can tell apart from the carpet, so they'd flicker into it.
 */
const floorLift = 0.005;
/** The black tape over the carpet's seam is crossed by the field's lines, so it's lifted less to stay under them */
const seamTape = /gaffer tape, black/iu;
const seamLift = 0.003;
/**
 * Stickers a fraction of a millimeter off the parts they're on, in any direction, so they're drawn as decals instead of
 * lifted, see `FieldModel` in `@/three/field-scene`
 */
const decal = /vinyl/iu;
/** Parts no taller than this many meters above the carpet are lying flat on it */
const flatHeight = 0.001;
/** The 2D field's background, see `fieldBackground` in `@/widgets/field/geometry` */
const carpetColor: Color = [0x6f / 255, 0x6f / 255, 0x6f / 255];
const simplifyRatio = 0.1;
/** Meters the simplified model can move from the CAD, too little to see on the field */
const simplifyError = 0.003;
/** Game pieces are drawn as these spheres, so they can share one mesh */
const gamePieceDetail = 2;

type Color = readonly [number, number, number];

const layoutSchema = z.object({
	tags: z.array(
		z.object({
			ID: z.number(),
			pose: z.object({
				translation: z.object({ x: z.number(), y: z.number(), z: z.number() }),
				rotation: z.object({ quaternion: z.object({ W: z.number(), X: z.number(), Y: z.number(), Z: z.number() }) }),
			}),
		}),
	),
});

await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO()
	.registerExtensions(ALL_EXTENSIONS)
	.registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

function linearChannel(value: number): number {
	return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/** STEP colors are sRGB, glTF's are linear */
function linear([red, green, blue]: Color): Color {
	return [linearChannel(red), linearChannel(green), linearChannel(blue)];
}

/** Converts the STEP file into a GLB with native OpenCascade, which takes seconds instead of the WebAssembly build's minutes */
async function convert(source: string): Promise<Document> {
	const directory = await mkdtemp(joinPath(tmpdir(), 'field-model-'));
	try {
		let step = source;
		if (source.startsWith('https://')) {
			step = joinPath(directory, 'field.step');
			await writeFile(step, new Uint8Array(await (await fetch(source)).arrayBuffer()));
		}
		const converted = joinPath(directory, 'field.glb');
		execFileSync('uv', ['run', '--locked', '--project', converterProject, converter, step, converted], {
			stdio: 'inherit',
		});
		const document = await io.read(converted);
		// Parts are placed by their nodes, moving that into their vertices lets them be measured and regrouped
		const bake = (node: Node) => {
			clearNodeTransform(node);
			for (const child of node.listChildren()) {
				bake(child);
			}
		};
		for (const node of document.getRoot().listScenes()[0]!.listChildren()) {
			bake(node);
		}
		return document;
	} finally {
		await rm(directory, { recursive: true });
	}
}

/** Every node with a mesh, and the names of it and its parents */
function parts(document: Document): { node: Node; names: string[] }[] {
	const found: { node: Node; names: string[] }[] = [];
	const visit = (node: Node, names: string[]) => {
		const path = [...names, node.getName()];
		if (node.getMesh()) {
			found.push({ node, names: path });
		}
		for (const child of node.listChildren()) {
			visit(child, path);
		}
	};
	for (const node of document.getRoot().listScenes()[0]!.listChildren()) {
		visit(node, []);
	}
	return found;
}

/** The bounds of a primitive's vertices */
function bounds(primitive: Primitive): { min: number[]; max: number[] } {
	const positions = primitive.getAttribute('POSITION')!;
	return { min: positions.getMin([]), max: positions.getMax([]) };
}

/** A sphere 1 m across, with smooth normals */
function sphereMesh(document: Document, material: Material): Mesh {
	const geometry = new IcosahedronGeometry(0.5, gamePieceDetail);
	const buffer = document.getRoot().listBuffers()[0]!;
	const position = geometry.getAttribute('position').array;
	const normals = Float32Array.from(position, (value) => value * 2);
	return document.createMesh('Game piece').addPrimitive(
		document
			.createPrimitive()
			.setAttribute(
				'POSITION',
				document.createAccessor().setType('VEC3').setArray(Float32Array.from(position)).setBuffer(buffer),
			)
			.setAttribute('NORMAL', document.createAccessor().setType('VEC3').setArray(normals).setBuffer(buffer))
			.setMaterial(material),
	);
}

/**
 * Moves the model's parts under a field node and a staged game pieces node, without the hardware, in field
 * coordinates. Meshes are already in the CAD's coordinates, centered on the field with +Z up, so nodes only group them.
 */
function regroup(document: Document): Mesh | undefined {
	const scene = document.getRoot().listScenes()[0]!;
	// CAD colors are base colors of matte parts, glTF materials default to metal
	for (const material of document.getRoot().listMaterials()) {
		material.setMetallicFactor(0);
	}
	const field = document.createNode('Field');
	const staged = document.createNode(stagedGamePiecesNode);
	const border = document.createNode(fieldBorderNode);
	let removed = 0;
	let gamePieceMesh: Mesh | undefined;
	// Drawn without lighting, so it's the same gray as the 2D field's background
	const carpetMaterial = document
		.createMaterial('Carpet')
		.setBaseColorFactor([...linear(carpetColor), 1])
		.setExtension('KHR_materials_unlit', document.createExtension(KHRMaterialsUnlit).createUnlit());
	// Decals keep their own materials, so they aren't joined with parts of the same color that aren't decals
	const decalMaterials = new Map<Material, Material>();
	const decalMaterial = (material: Material) => {
		let found = decalMaterials.get(material);
		if (!found) {
			found = material.clone().setExtras({ decal: true });
			decalMaterials.set(material, found);
		}
		return found;
	};
	let redX = 0;
	let blueX = 0;
	for (const { node, names } of parts(document)) {
		const name = names.at(-1)!;
		if (names.some((part) => hardware.test(part) || unseen.test(part))) {
			removed++;
			node.dispose();
			continue;
		}
		const { min: partMin, max: partMax } = getBounds(node);
		if (!carpet.test(name) && partMin[2] > -flatHeight && partMax[2] < flatHeight) {
			clearNodeTransform(node.setTranslation([0, 0, seamTape.test(name) ? seamLift : floorLift]));
		}
		const mesh = node.getMesh()!;
		for (const primitive of mesh.listPrimitives()) {
			const [red, green, blue] = primitive.getMaterial()!.getBaseColorFactor();
			const { min, max } = bounds(primitive);
			const x = (min[0]! + max[0]!) / 2;
			if (red > 0.3 && green < 0.05 && blue < 0.05) {
				redX += x;
			} else if (blue > 0.3 && red < 0.05 && green < 0.1) {
				blueX += x;
			}
			if (carpet.test(name)) {
				primitive.setMaterial(carpetMaterial);
			} else if (decal.test(name)) {
				primitive.setMaterial(decalMaterial(primitive.getMaterial()!));
			}
		}
		if (gamePiece.test(name)) {
			// Each game piece is one shared sphere where it's staged, see `instance()`
			const { min, max } = bounds(mesh.listPrimitives()[0]!);
			gamePieceMesh ??= sphereMesh(document, mesh.listPrimitives()[0]!.getMaterial()!);
			const size = max[0]! - min[0]!;
			staged.addChild(
				document
					.createNode(name)
					.setMesh(gamePieceMesh)
					.setTranslation([(min[0]! + max[0]!) / 2, (min[1]! + max[1]!) / 2, (min[2]! + max[2]!) / 2])
					.setScale([size, size, size]),
			);
			node.dispose();
		} else if (names.some((part) => perimeter.test(part))) {
			border.addChild(node);
		} else {
			field.addChild(node);
		}
	}
	for (const node of scene.listChildren()) {
		node.dispose();
	}
	// Red parts are toward +X in field coordinates, so the CAD is turned a half turn if they're toward -X in it
	const turned = redX < blueX;
	const root = document
		.createNode('2026 field')
		.setTranslation([fieldLength / 2, fieldWidth / 2, 0])
		.setRotation(turned ? [0, 0, 1, 0] : [0, 0, 0, 1])
		.addChild(field)
		.addChild(border)
		.addChild(staged);
	scene.addChild(root);
	console.log(`Removed ${removed} hardware parts, ${turned ? 'turned the CAD a half turn' : 'kept the CAD as is'}`);
	return gamePieceMesh;
}

const source = process.argv[2];
if (source === undefined) {
	throw new Error("Pass the field STEP file's URL or path");
}
const document = await convert(source);

const gamePieceMesh = regroup(document);
await document.transform(
	prune(),
	dedup(),
	weld(),
	simplify({ simplifier: MeshoptSimplifier, ratio: simplifyRatio, error: simplifyError }),
	// Game pieces share a mesh, drawn once for all of them, and parts under the same node with the same color become one
	// mesh, so the field takes a few draw calls
	instance({ min: 2 }),
	join({ keepNamed: false }),
	prune(),
	quantize(),
	meshopt({ encoder: MeshoptEncoder, level: 'high' }),
);
// Instancing moves the game pieces to a new node in field coordinates, which the widget finds by its name
for (const node of document.getRoot().listNodes()) {
	if (gamePieceMesh && node.getMesh() === gamePieceMesh) {
		node.setName(stagedGamePiecesNode);
	}
}
// Added after pruning, which removes nodes without meshes
const layout = layoutSchema.parse(await (await fetch(aprilTagLayout)).json());
const aprilTags = document.createNode('AprilTags');
for (const { ID, pose } of layout.tags) {
	const { translation } = pose;
	const { W, X, Y, Z } = pose.rotation.quaternion;
	aprilTags.addChild(
		document
			.createNode(`AprilTag ${ID}`)
			.setTranslation([translation.x, translation.y, translation.z])
			.setRotation([X, Y, Z, W])
			.setExtras({ aprilTag: ID }),
	);
}
document.getRoot().listScenes()[0]!.addChild(aprilTags);
await io.write(output.pathname, document);
console.log(`Wrote ${output.pathname}`);
