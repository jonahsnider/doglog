import * as z from 'zod';
import type { DashboardContents } from '@/dashboards/doc';
import { type LayoutSnapshot, snapshotLayout } from '@/panes/layout-snapshot';
import { bindingSchema } from '@/widgets/bindings';

const prefix = 'v1.';
const maxPayloadLength = 16 * 1024;
const maxJsonBytes = 128 * 1024;
const maxJsonDepth = 32;

const bindingsSchema = z
	.array(
		bindingSchema
			.omit({ id: true, sources: true })
			.loose()
			.extend({
				id: z.never().optional(),
				sources: z.never().optional(),
				connectedFrom: z.array(z.int().nonnegative()).max(256).optional(),
			}),
	)
	.max(256)
	.refine((bindings) => bindings.every((binding) => binding.connectedFrom?.every((i) => i < bindings.length) ?? true));

const widgetConfigSchema = z.looseObject({
	bindings: z.never().optional(),
	options: z.record(z.string(), z.string()).optional(),
});
const widgetSchema = z.object({ type: z.string(), config: widgetConfigSchema, bindings: bindingsSchema.optional() });

const sizeSchema = z.number().gt(0).lt(1).optional();
const layoutSchema: z.ZodType<LayoutSnapshot, LayoutSnapshot> = z.discriminatedUnion('kind', [
	z.object({ kind: z.literal('pane'), size: sizeSchema, widget: widgetSchema.optional() }),
	z
		.object({
			kind: z.literal('split'),
			size: sizeSchema,
			direction: z.enum(['row', 'column']),
			get children() {
				return z.array(layoutSchema).min(2).max(32);
			},
		})
		.refine(({ direction, children }) =>
			children.every((child) => child.kind === 'pane' || child.direction !== direction),
		),
]);
const dashboardSchema = z.object({
	name: z.string().optional(),
	layout: layoutSchema.refine((layout) => {
		if (layout.size !== undefined) {
			return false;
		}
		const nodes = [layout];
		for (const node of nodes) {
			if (node.kind === 'split') {
				nodes.push(...node.children);
			}
			if (nodes.length > 128) {
				return false;
			}
		}
		return true;
	}),
});

// Tuples carry structure only; the snapshot schema still validates widget settings and layout rules.
const bindingTupleSchema = z.tuple([z.string(), z.looseObject({ name: z.never().optional() }).optional()]);
const widgetTupleSchema = z.tuple([z.string(), z.looseObject({}).nullish(), z.array(bindingTupleSchema).optional()]);
type WidgetTuple = z.infer<typeof widgetTupleSchema>;
type LayoutTuple =
	| [tag: 0, widget?: WidgetTuple | null, size?: number]
	| [tag: 1 | 2, children: LayoutTuple[], size?: number];
const layoutTupleSchema: z.ZodType<LayoutTuple> = z.union([
	z.tuple([z.literal(0), widgetTupleSchema.nullish(), sizeSchema]),
	z.tuple([z.literal([1, 2]), z.array(z.lazy(() => layoutTupleSchema)), sizeSchema]),
]);

function withOptionalTail<const Head extends [unknown, ...unknown[]], Tail>(
	head: Head,
	tail: Tail | undefined,
): Head | [...Head, Tail] {
	return tail === undefined ? head : [...head, tail];
}

function omitEmptyObject<T extends Record<string, unknown>>(value: T): T | undefined {
	return Object.values(value).some((property) => property !== undefined) ? value : undefined;
}

function layoutToTuple(layout: LayoutSnapshot): LayoutTuple {
	if (layout.kind === 'split') {
		return withOptionalTail([layout.direction === 'row' ? 1 : 2, layout.children.map(layoutToTuple)], layout.size);
	}
	const { widget, size } = layout;
	let tuple: WidgetTuple | undefined;
	if (widget !== undefined) {
		const config = omitEmptyObject(widgetConfigSchema.parse(widget.config));
		const bindings = widget.bindings?.map(({ name, ...metadata }) =>
			withOptionalTail([name], omitEmptyObject(metadata)),
		);
		tuple = bindings === undefined ? withOptionalTail([widget.type], config) : [widget.type, config ?? null, bindings];
	}
	return size === undefined ? withOptionalTail([0], tuple) : [0, tuple ?? null, size];
}

function layoutFromTuple([tag, contents, size]: LayoutTuple): LayoutSnapshot {
	if (tag !== 0) {
		return {
			kind: 'split',
			direction: tag === 1 ? 'row' : 'column',
			children: contents.map((child) => layoutFromTuple(child)),
			size,
		};
	}
	if (!contents) {
		return { kind: 'pane', size };
	}
	const [type, config, bindings] = contents;
	const widget = { type, config: config ?? {} };
	return {
		kind: 'pane',
		size,
		widget:
			bindings === undefined
				? widget
				: { ...widget, bindings: bindings.map(([name, metadata]) => Object.assign(metadata ?? {}, { name })) },
	};
}

const dashboardTupleCodec = z.codec(z.tuple([layoutTupleSchema, z.string().optional()]), dashboardSchema, {
	decode: ([layout, name]) => {
		const snapshot = { layout: layoutFromTuple(layout), name };
		checkJson(snapshot);
		return snapshot;
	},
	encode: ({ layout, name }) => withOptionalTail([layoutToTuple(layout)], name),
});

export function dashboardSnapshot({ name, layout }: DashboardContents) {
	return { name, layout: snapshotLayout(layout) };
}

/** Compare saved content without IDs, ignoring object key order but not pane or binding order. */
export function snapshotKey(snapshot: z.infer<typeof dashboardSchema>): string {
	return JSON.stringify(snapshot, (_, value: unknown) => {
		if (typeof value !== 'object' || value === null || Array.isArray(value)) {
			return value;
		}
		const entries: [string, unknown][] = Object.entries(value);
		return Object.fromEntries(entries.toSorted(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
	});
}

/** Bound nesting before running the recursive schema or passing config to Loro. */
function checkJson(value: unknown, limit = maxJsonDepth, depth = 0): void {
	if (depth > limit || (typeof value === 'number' && !Number.isFinite(value))) {
		throw new Error('Invalid dashboard contents');
	}
	if (typeof value === 'object' && value !== null) {
		for (const [key, child] of Object.entries(value)) {
			if (key === '__proto__') {
				throw new Error('Invalid dashboard contents');
			}
			checkJson(child, limit, depth + 1);
		}
	}
}

export class DashboardLinkTooLarge extends Error {}

export async function encodeDashboardLink(dashboard: DashboardContents): Promise<string> {
	const snapshot = dashboardSnapshot(dashboard);
	checkJson(snapshot);
	const json = JSON.stringify(dashboardTupleCodec.encode(snapshot));
	const bytes = new TextEncoder().encode(json);
	if (bytes.byteLength > maxJsonBytes) {
		throw new DashboardLinkTooLarge();
	}
	const compressed = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
	const payload = (await new Response(compressed).bytes()).toBase64({ alphabet: 'base64url', omitPadding: true });
	if (payload.length > maxPayloadLength) {
		throw new DashboardLinkTooLarge();
	}
	return prefix + payload;
}

export async function decodeDashboardLink(hash: string) {
	const payload = hash.slice(prefix.length);
	if (!hash.startsWith(prefix) || payload.length > maxPayloadLength || !/^[\w-]+$/u.test(payload)) {
		throw new Error('Invalid dashboard link');
	}
	const bytes = Uint8Array.fromBase64(payload, { alphabet: 'base64url' });
	const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
	const decoder = new TextDecoder('utf-8', { fatal: true });
	let length = 0;
	let json = '';
	for await (const chunk of stream) {
		length += chunk.byteLength;
		if (length > maxJsonBytes) {
			throw new DashboardLinkTooLarge();
		}
		json += decoder.decode(chunk, { stream: true });
	}
	const value: unknown = JSON.parse(json + decoder.decode());
	// The binding metadata object adds a level on the wire, but not in the restored snapshot.
	checkJson(value, maxJsonDepth + 1);
	return dashboardTupleCodec.parse(value);
}
