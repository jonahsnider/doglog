import type { KeyboardEvent } from 'react';

/** Whether a key press is Enter, and not Enter confirming an IME composition (Japanese, Chinese, Korean input) */
export function isEnterKey(event: KeyboardEvent): boolean {
	return (
		event.key === 'Enter' &&
		!event.nativeEvent.isComposing &&
		// oxlint-disable-next-line typescript/no-deprecated -- Safari (and the macOS app's WKWebView) resets `isComposing` before the confirming keydown, but still reports 229 here
		event.keyCode !== 229
	);
}
