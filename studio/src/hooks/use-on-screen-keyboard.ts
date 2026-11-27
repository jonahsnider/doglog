import { useEffect, useState } from 'react';
import { useMediaQuery } from '@/hooks/use-media-query';

const textEntry =
	'input:not([type=button], [type=checkbox], [type=color], [type=file], [type=radio], [type=range], [type=reset], [type=submit]), textarea, [contenteditable]:not([contenteditable=false])';

function entersText(target: EventTarget | null): boolean {
	return target instanceof Element && target.matches(textEntry);
}

/**
 * Whether the on-screen keyboard is likely open: a text field is focused on a device whose primary pointer is a finger.
 * Browsers don't say whether it's open, and its size changes the viewport differently on each.
 */
export function useOnScreenKeyboard(): boolean {
	const touch = useMediaQuery('(pointer: coarse)');
	const [typing, setTyping] = useState(() => entersText(document.activeElement));

	useEffect(() => {
		const onFocusIn = (event: FocusEvent) => setTyping(entersText(event.target));
		// Reads where focus goes, since nothing is focused yet while it leaves
		const onFocusOut = (event: FocusEvent) => setTyping(entersText(event.relatedTarget));
		document.addEventListener('focusin', onFocusIn);
		document.addEventListener('focusout', onFocusOut);
		return () => {
			document.removeEventListener('focusin', onFocusIn);
			document.removeEventListener('focusout', onFocusOut);
		};
	}, []);

	return touch && typing;
}
