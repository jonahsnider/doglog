import { useState } from 'react';

/** Search opens every matching group by default, separately from the unfiltered tree. */
export function useSearchExpansion(query: string) {
	const [collapsed, setCollapsed] = useState({ query, groups: new Set<string>() });
	if (collapsed.query !== query) {
		setCollapsed({ query, groups: new Set() });
	}

	function changeSearchExpansion(expanded: string[], next: string[]) {
		const openGroups = new Set(next);
		setCollapsed((state) => ({
			...state,
			groups: new Set([...state.groups, ...expanded].filter((group) => !openGroups.has(group))),
		}));
	}

	return [collapsed.groups, changeSearchExpansion] as const;
}
