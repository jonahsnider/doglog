import { createAtom } from '@tanstack/store';
import { expect, test } from 'vite-plus/test';

// Unpatched, TanStack Store ignores `set(undefined)`, see patches/@tanstack__store.patch
test('atoms can be cleared with set(undefined)', () => {
	const atom = createAtom<string | undefined>('robot');
	atom.set(undefined);
	expect(atom.get()).toBeUndefined();
});
