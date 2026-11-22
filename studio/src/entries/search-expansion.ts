import { useState } from 'react';

/** Groups expanded or collapsed while searching, separately from the unfiltered tree. Reset when the query changes. */
export function useSearchExpansion(query: string) {
	const [toggled, setToggled] = useState({ query, groups: new Set<string>() });
	if (toggled.query !== query) {
		setToggled({ query, groups: new Set() });
	}

	function changeSearchExpansion(expanded: string[], next: string[]) {
		const before = new Set(expanded);
		const after = new Set(next);
		const changed = [...expanded.filter((group) => !after.has(group)), ...next.filter((group) => !before.has(group))];
		setToggled((state) => {
			const groups = new Set(state.groups);
			for (const group of changed) {
				if (!groups.delete(group)) {
					groups.add(group);
				}
			}
			return { ...state, groups };
		});
	}

	return [toggled.groups, changeSearchExpansion] as const;
}
