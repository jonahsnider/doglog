import { useHotkey } from '@tanstack/react-hotkeys';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { useCopyToClipboard, useIsMounted } from 'usehooks-ts';
import type { MenuEntry, MenuPoint } from '@/components/app-context-menu';
import { useWidgetMenu } from '@/panes/widget-menu';
import {
	type FieldCoordinates,
	type FieldPoint,
	type FieldView,
	fieldLength,
	fieldWidth,
	toBlueWall,
} from '@/widgets/field/geometry';

// The menu can rerender while it is open, even while the field's camera or orientation moves.
const menuPositions = new WeakMap<MenuPoint, FieldPoint | undefined>();

/**
 * Copies `x, y` from the field menu or the hovered position on ⌘C (Ctrl+C), sharing the readout's success feedback.
 */
export function useCopyPosition(pointer: FieldPoint | undefined, enabled: boolean) {
	const [, copy] = useCopyToClipboard();
	const isMounted = useIsMounted();
	const [copied, setCopied] = useState(false);
	const copiedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
	useEffect(() => () => clearTimeout(copiedTimer.current), []);
	const copyPosition = async ({ x, y }: FieldPoint) => {
		if (!(await copy(`${x.toFixed(2)}, ${y.toFixed(2)}`)) || !isMounted()) {
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
			if (pointer && !event.defaultPrevented && window.getSelection()?.isCollapsed !== false) {
				event.preventDefault();
				void copyPosition(pointer);
			}
		},
		{ enabled, conflictBehavior: 'allow', ignoreInputs: true, preventDefault: false, stopPropagation: false },
	);
	const copyMenuItems = (
		scene: HTMLElement | null,
		target: Element,
		point: MenuPoint | undefined,
		project: (point: MenuPoint) => FieldPoint | undefined,
	): MenuEntry[] => {
		if (!point) {
			return [];
		}
		if (!menuPositions.has(point)) {
			// A captured pointer can be outside the scene when it opens a menu. Legend and toolbar targets aren't in it.
			const bounds = scene !== null && scene.contains(target) ? scene.getBoundingClientRect() : undefined;
			const inside =
				bounds !== undefined &&
				bounds.width > 0 &&
				bounds.height > 0 &&
				point.clientX >= bounds.left &&
				point.clientX <= bounds.right &&
				point.clientY >= bounds.top &&
				point.clientY <= bounds.bottom;
			menuPositions.set(point, inside ? project(point) : undefined);
		}
		const position = menuPositions.get(point);
		return position ? [{ label: 'Copy coordinates', onSelect: () => void copyPosition(position) }] : [];
	};
	return { copied, copyMenuItems };
}

/** Uses the rendered SVG transform, including the current pan and zoom, to resolve the point at menu opening. */
export function useCopyPosition2d(
	pointer: FieldPoint | undefined,
	hovered: boolean,
	scene: RefObject<HTMLDivElement | null>,
	field: FieldView,
	coordinates: FieldCoordinates,
) {
	const fieldRef = useRef<SVGGElement>(null);
	const { copied, copyMenuItems } = useCopyPosition(pointer, hovered);
	useWidgetMenu((_binding, target, point) => ({
		contextual: copyMenuItems(scene.current, target, point, ({ clientX, clientY }) => {
			const matrix = fieldRef.current?.getScreenCTM();
			if (!matrix) {
				return undefined;
			}
			const projected = field.fromSvg(new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse()));
			const { x, y } = projected;
			return x >= 0 && x <= fieldLength && y >= 0 && y <= fieldWidth ? toBlueWall(projected, coordinates) : undefined;
		}),
	}));
	return { copied, fieldRef };
}
