import { WebGLRenderer } from 'three';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { DRACO_GLTF_CONFIG, DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';

let textures: KTX2Loader | undefined;

export const gltfLoader = new GLTFLoader()
	.setMeshoptDecoder(MeshoptDecoder)
	.setDRACOLoader(new DRACOLoader().setDecoderPath(DRACO_GLTF_CONFIG))
	.register((parser) => ({
		name: 'doglog-texture-support',
		beforeRoot: async () => {
			const json: unknown = parser.json;
			if (
				typeof json !== 'object' ||
				json === null ||
				!('extensionsUsed' in json) ||
				!Array.isArray(json.extensionsUsed) ||
				!json.extensionsUsed.includes('KHR_texture_basisu')
			) {
				return;
			}
			const { KTX2Loader } = await import('three/examples/jsm/loaders/KTX2Loader.js');
			if (textures === undefined) {
				// Models can load before a widget has a canvas. Probe the same GPU the widgets will use.
				const renderer = new WebGLRenderer({ powerPreference: 'high-performance' });
				textures = new KTX2Loader().detectSupport(renderer);
				renderer.dispose();
				renderer.forceContextLoss();
			}
			parser.options.ktx2Loader = textures;
		},
	}));
