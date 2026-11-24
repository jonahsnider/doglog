import { Document, NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression } from '@gltf-transform/extensions';
import { MeshoptEncoder } from 'meshoptimizer';
import { Box3 } from 'three';
import { expect, test } from 'vite-plus/test';
import { gltfLoader } from '@/three/gltf-loader';

test('loads geometry from a GLB that requires Meshopt', async () => {
	await MeshoptEncoder.ready;
	const document = new Document();
	document.createExtension(EXTMeshoptCompression).setRequired(true);
	const positions = document
		.createAccessor()
		.setBuffer(document.createBuffer())
		.setType('VEC3')
		.setArray(new Float32Array([-1, 0, 0, 2, 0, 0, 0, 3, 0]));
	const mesh = document.createMesh().addPrimitive(document.createPrimitive().setAttribute('POSITION', positions));
	document.createScene().addChild(document.createNode().setMesh(mesh));
	const io = new NodeIO()
		.registerExtensions([EXTMeshoptCompression])
		.registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

	const glb = await io.writeBinary(document);
	const { scene } = await gltfLoader.parseAsync(Uint8Array.from(glb).buffer, '');
	const bounds = new Box3().setFromObject(scene, true);
	expect(bounds.min.toArray()).toEqual([-1, 0, 0]);
	expect(bounds.max.toArray()).toEqual([2, 3, 0]);
});
