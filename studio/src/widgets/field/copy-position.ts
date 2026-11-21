import { useHotkey } from '@tanstack/react-hotkeys';
import { useEffect, useRef, useState } from 'react';
import { useCopyToClipboard, useIsMounted } from 'usehooks-ts';
import type { FieldPoint } from '@/widgets/field/geometry';

/**
 * Copies the cursor position as `x, y` when ⌘C (Ctrl+C) is pressed while `enabled`, ex. while the field is hovered.
 * Returns whether it was just copied.
 */
export function useCopyPosition(pointer: FieldPoint | undefined, enabled: boolean): boolean {
	const [, copy] = useCopyToClipboard();
	const isMounted = useIsMounted();
	const [copied, setCopied] = useState(false);
	const copiedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
	useEffect(() => () => clearTimeout(copiedTimer.current), []);
	const copyPosition = async () => {
		if (!pointer || !(await copy(`${pointer.x.toFixed(2)}, ${pointer.y.toFixed(2)}`)) || !isMounted()) {
			return;
		}
		setCopied(true);
		clearTimeout(copiedTimer.current);
		copiedTimer.current = setTimeout(() => setCopied(false), 1200);
	};
	// Every field widget registers it, but only the hovered one is enabled
	useHotkey(
		'Mod+C',
		(event) => {
			if (!event.defaultPrevented && window.getSelection()?.isCollapsed !== false) {
				event.preventDefault();
				void copyPosition();
			}
		},
		{ enabled, conflictBehavior: 'allow', ignoreInputs: true, preventDefault: false, stopPropagation: false },
	);
	return copied;
}
