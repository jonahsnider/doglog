import { LoroMap, type LoroMovableList } from 'loro-crdt';

/** Set a map's entries to `values`, without making changes for values that are already set. The `kept` key is left alone. */
export function setEntries(map: LoroMap, values: Record<string, unknown>, kept?: string): void {
	for (const [key] of map.entries()) {
		if (values[key] === undefined && key !== kept) {
			map.delete(key);
		}
	}
	for (const [key, value] of Object.entries(values)) {
		if (value !== undefined) {
			map.set(key, value);
		}
	}
}

/** Narrows to `LoroMap` without its `any` type parameter */
function isMap(value: unknown): value is LoroMap {
	return value instanceof LoroMap;
}

/** Change a list of maps to match `items`, matching them by their `id` */
export function writeList(list: LoroMovableList, items: readonly Record<string, unknown>[]): void {
	const ids = new Set(items.map((item) => item['id']));
	for (let index = list.length - 1; index >= 0; index--) {
		const item = list.get(index);
		if (!isMap(item) || !ids.has(item.get('id'))) {
			list.delete(index, 1);
		}
	}

	for (const [index, item] of items.entries()) {
		let from = -1;
		for (let other = index; other < list.length; other++) {
			const existing = list.get(other);
			if (isMap(existing) && existing.get('id') === item['id']) {
				from = other;
				break;
			}
		}

		if (from !== -1 && from !== index) {
			list.move(from, index);
		}
		if (from === -1) {
			list.insertContainer(index, new LoroMap());
		}
		const map = list.get(index);
		if (isMap(map)) {
			setEntries(map, item);
		}
	}
}
