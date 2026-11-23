// The XZ format's magic bytes, which every `.wpilogxz` log starts with
const magic = [0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00];

/** Whether a file starts like an XZ file, ex. a `.wpilogxz` log */
export function isXz(header: Uint8Array): boolean {
	return magic.every((byte, index) => header[index] === byte);
}
