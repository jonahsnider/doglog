// Which side of the pointer the graph's tooltip goes on

/** Where the pointer is, `x` px into the area between the y-axes that's `width` px wide. `flip` puts the tooltip left of it. */
export type PointerAt = { x: number; width: number; flip: boolean };

/**
 * Where the pointer is over the bands, for their tooltip. `pixel` is the time (µs) a pixel spans, and `top` is where the
 * bands start in the graph.
 */
export type BandHover = PointerAt & { row: number; time: number; pixel: number; top: number };

/** Where the pointer is over the lines, for their tooltip, `y` px into the graph. `above` puts the tooltip above it. */
export type LineHover = PointerAt & { time: number; y: number; above: boolean };

/** The tooltip only switches sides of the pointer once it's this far past the middle, so it doesn't flip back and forth */
const flipDeadband = 40;

/**
 * Whether the tooltip goes left of (or above) the pointer, `x` px into `width`, staying on the side it was on near the
 * middle
 */
export function flipsAt(x: number, width: number, flipped: boolean | undefined): boolean {
	const deadband = flipped === undefined ? 0 : Math.min(flipDeadband, width / 8);
	return x > width / 2 + (flipped === true ? -deadband : deadband);
}
