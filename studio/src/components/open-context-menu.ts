/**
 * Opens the context menu of `element` from the keyboard, under its start. The menu's own wrapper might not be where
 * `element` is, ex. for rows positioned in a virtualized list.
 */
export function openContextMenu(element: Element): void {
	const { left, bottom } = element.getBoundingClientRect();
	element.dispatchEvent(
		new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: left, clientY: bottom }),
	);
}
