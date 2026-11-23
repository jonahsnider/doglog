/** The tag's black square is 6.5 inches across, 8 squares */
export const tagSize = 6.5 * 0.0254;

// The 36h11 family's codes by ID, from the AprilTag library's tag36h11.c. Only the IDs used by the field are included.
const codes = [
	0xd7e00984b, 0xdda664ca7, 0xdc4a1c821, 0xe17b470e9, 0xef91d01b1, 0xf429cdd73, 0x05da29225, 0x1106cba43, 0x223bed79d,
	0x21f51213c, 0x33eb19ca6, 0x3f76eb0f8, 0x469a97414, 0x45dcfe0b0, 0x4a6465f72, 0x51801db96, 0x5eb946b4e, 0x68a7cc2ec,
	0x6f0ba2652, 0x78765559d, 0x87b83d129, 0x86cc4a5c5, 0x8b64df90f, 0x9c577b611, 0xa3810f2f5, 0xaf4d75b83, 0xb59a03fef,
	0xbb1096f85, 0xd1b92fc76, 0xd0dd509d2, 0xe2cfda160, 0x2ff497c63, 0x47240671b,
];
// Row-major indices of the 6 by 6 payload bits, in the order their bits appear in each code, most significant first.
const bitIndices = [
	0, 1, 2, 3, 4, 7, 8, 9, 14, 5, 11, 17, 23, 29, 10, 16, 22, 15, 35, 34, 33, 32, 31, 28, 27, 26, 21, 30, 24, 18, 12, 6,
	25, 19, 13, 20,
];

/** The payload of each tag, left to right and top to bottom, shared by the renderer and detector */
export const aprilTagPatterns = codes.map((code) => {
	const bits = code.toString(2).padStart(36, '0');
	const pattern: string[] = [];
	for (const [i, index] of bitIndices.entries()) {
		pattern[index] = bits.charAt(i);
	}
	return pattern.join('');
});
