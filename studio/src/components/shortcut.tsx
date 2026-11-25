import { Kbd } from '@astryxdesign/core/Kbd';
import { Fragment } from 'react';
import { useMobileLayout } from '@/lib/mobile-layout';

/** Hotkey key names that Astryx names differently */
const kbdKeyNames: Record<string, string> = {
	arrowup: 'up',
	arrowdown: 'down',
	arrowleft: 'left',
	arrowright: 'right',
	'+': 'plus',
};

/** The `keys` Astryx's `Kbd` takes for a hotkey, ex. `Mod+ArrowUp` is `mod+up` */
function kbdKeys(hotkey: string): string {
	return hotkey
		.split(/\+(?!$)/u)
		.map((key) => kbdKeyNames[key.toLowerCase()] ?? key.toLowerCase())
		.join('+');
}

/**
 * Shows a hotkey's keys with the platform's names for modifiers. Hotkeys are written like TanStack Hotkeys' `Mod+Shift+K`,
 * or as a sequence of them, ex. `['G', 'G']`.
 */
export function Shortcut({ hotkey }: { hotkey: string | readonly string[] }) {
	if (typeof hotkey === 'string') {
		return <Kbd keys={kbdKeys(hotkey)} />;
	}
	return hotkey.map((chord, step) => (
		// Steps can repeat a chord, so they're keyed by position
		// oxlint-disable-next-line react/no-array-index-key
		<Fragment key={step}>
			{step > 0 && ' '}
			<Kbd keys={kbdKeys(chord)} />
		</Fragment>
	));
}

/** An always-visible shortcut hint, omitted in the phone layout */
export function InlineShortcut({ hotkey }: { hotkey: string | readonly string[] }) {
	return useMobileLayout() ? null : <Shortcut hotkey={hotkey} />;
}
