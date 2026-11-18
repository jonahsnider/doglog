// Apart from `@/data/samples` so agent command schemas can use it in Node, see `@/agent`

/** How an entry's values are decoded. Entries with the `unsupported` kind have no values and can't be bound to widgets. */
export const entryKinds = [
	'number',
	'boolean',
	'string',
	'number[]',
	'boolean[]',
	'string[]',
	'struct',
	'struct[]',
	'mechanism2d',
	'unsupported',
] as const;

export type EntryKind = (typeof entryKinds)[number];
