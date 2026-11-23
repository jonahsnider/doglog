declare module 'js-aruco2' {
	export const AR: {
		DICTIONARIES: Record<string, { nBits: number; tau: number; codeList: number[] }>;
		Detector: new (config: { dictionaryName: string; maxHammingDistance: number }) => {
			detect(image: ImageData): { id: number; corners: { x: number; y: number }[]; hammingDistance: number }[];
		};
	};
}
