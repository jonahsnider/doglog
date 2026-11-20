import { FieldEntry } from '@/data/field-entry';
import type { EntryTreeNode } from '@/entries/tree';

/**
 * Show structs with one field as one row, see `EntryTreeNode.field`. Groups left with only a struct's field, ex. when
 * editing a widget that accepts the field but not the struct, show the field in the group's place.
 */
export function mergeSingleFields(nodes: EntryTreeNode[]): EntryTreeNode[] {
	return nodes.map((node) => {
		if (!node.children) {
			return node;
		}
		node.children = mergeSingleFields(node.children);
		const [child] = node.children;
		// A field of this struct, not an array's element or a field of a struct already shown in its place
		const { entry: field } = child!;
		if (
			node.children.length !== 1 ||
			child!.children ||
			!(field instanceof FieldEntry) ||
			typeof field.path.at(-1) !== 'string' ||
			field.name !== `${node.value}/${field.path.at(-1)}`
		) {
			return node;
		}
		const { children: _children, ...struct } = node;
		return struct.entry ? { ...struct, field: child!.field ?? child!.entry } : { ...child!, label: node.label };
	});
}

/**
 * Show a chain of groups that each only have one group in them as one row, labeled with their segments, ex. `Drive/Modules`
 * when `/Drive` only has `/Drive/Modules`. The row is the last group. The tops of pinned and hidden entries and groups,
 * labeled with their full paths, are kept since their sections are keyed by their paths.
 */
export function compactGroups(nodes: readonly EntryTreeNode[]): EntryTreeNode[] {
	return nodes.map((node) => {
		if (!node.children) {
			return node;
		}
		const children = compactGroups(node.children);
		const [child] = children;
		if (children.length === 1 && child!.children && !node.entry && !node.section && node.label !== node.value) {
			return { ...child!, label: `${node.label}/${child!.label}` };
		}
		return { ...node, children };
	});
}
