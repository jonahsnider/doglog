// Reads WPILib `Mechanism2d`s, which are logged as a group of entries:
// - `.type` (`Mechanism2d`), `dims` (width and height), and `backgroundColor`
// - A table per root, with its `position` (WPILib 2027) or its `x` and `y` (WPILib 2026)
// - A table per ligament inside its root or parent ligament, with its `angle` (degrees), `length`, `color`, and `weight`
import type { Entry } from '@/data/data-store';

type Point = { readonly x: number; readonly y: number };

/** A ligament at one time, in the mechanism's units with (0, 0) at its bottom-left corner */
type MechanismLine = {
	/** Name of the ligament's table, unique within the mechanism */
	readonly id: string;
	readonly start: Point;
	readonly end: Point;
	/** CSS color as logged, ex. `#eb8934` */
	readonly color: string;
	/** Line width in pixels as logged */
	readonly weight: number;
};

/** A mechanism at one time */
export type Mechanism = {
	readonly width: number;
	readonly height: number;
	/** CSS color as logged */
	readonly backgroundColor: string;
	/** Parents before their children */
	readonly lines: readonly MechanismLine[];
};

type Ligament = {
	readonly id: string;
	readonly angle: Entry | undefined;
	readonly length: Entry | undefined;
	readonly color: Entry | undefined;
	readonly weight: Entry | undefined;
	readonly children: readonly Ligament[];
};

type Root = {
	readonly position: Entry | undefined;
	readonly x: Entry | undefined;
	readonly y: Entry | undefined;
	readonly ligaments: readonly Ligament[];
};

/** The entries a mechanism is logged in, see `mechanismLayout()` */
export type MechanismLayout = {
	readonly dims: Entry | undefined;
	readonly backgroundColor: Entry | undefined;
	readonly roots: readonly Root[];
};

type Node = { entry?: Entry; readonly name: string; readonly children: Map<string, Node> };

// WPILib's defaults for values that haven't been logged
const defaultBackgroundColor = '#000020';
const defaultColor = '#eb8934';
const defaultWeight = 10;

// Names of the values in each kind of table, any other tables in them are roots or ligaments
const mechanismValues = new Set(['dims', 'backgroundColor']);
const rootValues = new Set(['position', 'x', 'y']);
const ligamentValues = new Set(['angle', 'length', 'color', 'weight']);

/** Tables inside a node, skipping its values and metadata like `.type` */
function tables(node: Node, values: ReadonlySet<string>): Node[] {
	return [...node.children.entries()]
		.filter(([key, child]) => child.children.size > 0 && !key.startsWith('.') && !values.has(key))
		.map(([, child]) => child);
}

function ligament(node: Node): Ligament {
	const value = (key: string) => node.children.get(key)?.entry;
	return {
		id: node.name,
		angle: value('angle'),
		length: value('length'),
		color: value('color'),
		weight: value('weight'),
		children: tables(node, ligamentValues).map((child) => ligament(child)),
	};
}

/** Find the entries of the mechanism logged under `name`. Only changes when entries are added or removed. */
export function mechanismLayout(name: string, entries: readonly Entry[]): MechanismLayout {
	const prefix = `${name}/`;
	const tree: Node = { name, children: new Map() };
	for (const entry of entries) {
		if (!entry.name.startsWith(prefix)) {
			continue;
		}
		let node = tree;
		for (const segment of entry.name.slice(prefix.length).split('/')) {
			let child = node.children.get(segment);
			if (child === undefined) {
				child = { name: `${node.name}/${segment}`, children: new Map() };
				node.children.set(segment, child);
			}
			node = child;
		}
		node.entry = entry;
	}

	return {
		dims: tree.children.get('dims')?.entry,
		backgroundColor: tree.children.get('backgroundColor')?.entry,
		roots: tables(tree, mechanismValues).map((node) => ({
			position: node.children.get('position')?.entry,
			x: node.children.get('x')?.entry,
			y: node.children.get('y')?.entry,
			ligaments: tables(node, rootValues).map((child) => ligament(child)),
		})),
	};
}

function numberAt(entry: Entry | undefined, time: number, fallback: number): number {
	const value = entry?.samples.valueAt(time);
	return typeof value === 'number' ? value : fallback;
}

function stringAt(entry: Entry | undefined, time: number, fallback: string): string {
	const value = entry?.samples.valueAt(time);
	return typeof value === 'string' ? value : fallback;
}

function rootPosition(root: Root, time: number): Point {
	const position = root.position?.samples.valueAt(time);
	if (Array.isArray(position) && typeof position[0] === 'number' && typeof position[1] === 'number') {
		return { x: position[0], y: position[1] };
	}
	return { x: numberAt(root.x, time, 0), y: numberAt(root.y, time, 0) };
}

/** The mechanism at `time`, `undefined` before its size was logged */
export function readMechanism(layout: MechanismLayout, time: number): Mechanism | undefined {
	const dims = layout.dims?.samples.valueAt(time);
	if (!Array.isArray(dims) || typeof dims[0] !== 'number' || typeof dims[1] !== 'number') {
		return undefined;
	}
	const [width, height] = dims;
	if (!(width > 0 && height > 0)) {
		return undefined;
	}

	const lines: MechanismLine[] = [];
	/** Add a ligament starting at `start`, its angle is relative to `direction` (radians counterclockwise from +X) */
	const add = (item: Ligament, start: Point, direction: number) => {
		const angle = direction + (numberAt(item.angle, time, 0) * Math.PI) / 180;
		const length = numberAt(item.length, time, 0);
		const end = { x: start.x + Math.cos(angle) * length, y: start.y + Math.sin(angle) * length };
		lines.push({
			id: item.id,
			start,
			end,
			color: stringAt(item.color, time, defaultColor),
			weight: numberAt(item.weight, time, defaultWeight),
		});
		for (const child of item.children) {
			add(child, end, angle);
		}
	};
	for (const root of layout.roots) {
		const start = rootPosition(root, time);
		for (const item of root.ligaments) {
			add(item, start, 0);
		}
	}

	return { width, height, backgroundColor: stringAt(layout.backgroundColor, time, defaultBackgroundColor), lines };
}
