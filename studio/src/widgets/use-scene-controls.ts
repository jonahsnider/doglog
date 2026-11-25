import { type DOMAttributes, useEffect, useEffectEvent, useRef, useState } from 'react';

const idleMs = 3000;
const visibleMs = 5000;

/** Shows the reference once on mount and once per stretch of input, not on camera or data updates. */
export function useSceneControls(enabled = true) {
	const [visible, setVisible] = useState(enabled);
	const idle = useRef<ReturnType<typeof setTimeout>>(undefined);
	const pointers = useRef(new Set<number>());
	const keys = useRef(new Set<string>());
	if (!enabled && visible) {
		setVisible(false);
	}

	useEffect(() => {
		if (visible) {
			const timeout = setTimeout(() => setVisible(false), visibleMs);
			return () => clearTimeout(timeout);
		}
		return undefined;
	}, [visible]);

	const input = () => {
		if (!enabled) {
			return;
		}
		setVisible(false);
		clearTimeout(idle.current);
		// A held pointer or navigation key is still active even if no events are moving it at the moment.
		if (pointers.current.size === 0 && keys.current.size === 0) {
			idle.current = setTimeout(() => setVisible(true), idleMs);
		}
	};
	const released = useEffectEvent(input);
	useEffect(() => {
		if (!enabled) {
			return undefined;
		}
		const heldPointers = pointers.current;
		const heldKeys = keys.current;
		const releasePointer = (event: PointerEvent) => {
			if (heldPointers.delete(event.pointerId)) {
				released();
			}
		};
		const releaseKey = (event: KeyboardEvent) => {
			if (heldKeys.delete(event.code)) {
				released();
			}
		};
		const clearHeld = () => {
			if (heldPointers.size > 0 || heldKeys.size > 0) {
				heldPointers.clear();
				heldKeys.clear();
				released();
			}
		};
		// Releases can happen outside the scene, including after a menu takes focus.
		window.addEventListener('pointerup', releasePointer, true);
		window.addEventListener('pointercancel', releasePointer, true);
		window.addEventListener('keyup', releaseKey, true);
		window.addEventListener('blur', clearHeld);
		return () => {
			window.removeEventListener('pointerup', releasePointer, true);
			window.removeEventListener('pointercancel', releasePointer, true);
			window.removeEventListener('keyup', releaseKey, true);
			window.removeEventListener('blur', clearHeld);
			clearTimeout(idle.current);
			heldPointers.clear();
			heldKeys.clear();
		};
	}, [enabled]);

	const handlers: DOMAttributes<HTMLDivElement> = enabled
		? {
				onPointerDownCapture: (event) => {
					pointers.current.add(event.pointerId);
					input();
				},
				onWheelCapture: input,
				onKeyDownCapture: (event) => {
					if (
						!event.metaKey &&
						!event.ctrlKey &&
						!event.altKey &&
						/^(Arrow(Up|Down|Left|Right)|[WASDQE])$/iu.test(event.key)
					) {
						keys.current.add(event.code);
						input();
					}
				},
				onBlurCapture: (event) => {
					if (keys.current.size > 0 && !event.currentTarget.contains(event.relatedTarget)) {
						keys.current.clear();
						input();
					}
				},
			}
		: {};
	return { visible: enabled && visible, handlers, input };
}
