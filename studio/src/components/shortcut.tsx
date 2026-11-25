import {
	fontWeightVars,
	radiusVars,
	spacingVars,
	typeScaleVars,
	typographyVars,
} from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import { type DisplayHotkeyChord, detectPlatform, useFormatForDisplay } from '@tanstack/react-hotkeys';
import { Fragment, type ReactNode } from 'react';
import { useMobileLayout } from '@/lib/mobile-layout';

const styles = stylex.create({
	key: {
		display: 'inline-flex',
		flexShrink: 0,
		alignItems: 'center',
		justifyContent: 'center',
		gap: spacingVars['--spacing-0-5'],
		minWidth: '1.25rem',
		height: '1.25rem',
		paddingInline: spacingVars['--spacing-1'],
		borderRadius: radiusVars['--radius-inner'],
		// Tinted with the text around it, so it stands out on any surface, including buttons and tooltips
		backgroundColor: 'color-mix(in srgb, currentColor 10%, transparent)',
		// The code font has no modifier symbols, ex. ⌘
		fontFamily: typographyVars['--font-family-body'],
		fontSize: typeScaleVars['--text-supporting-size'],
		fontWeight: fontWeightVars['--font-weight-medium'],
		lineHeight: 1,
		fontVariantNumeric: 'tabular-nums',
		whiteSpace: 'nowrap',
		userSelect: 'none',
	},
});

/** A key badge. Prefer `Shortcut`, this is for keys it can't name, ex. media keys drawn as icons. */
export function Kbd({ children }: { children: ReactNode }) {
	return <kbd {...stylex.props(styles.key)}>{children}</kbd>;
}

/** macOS writes chords as one run of symbols, ex. ⇧⌘O, and other platforms join keys with `+` */
const chordOptions = detectPlatform() === 'mac' ? { separatorToken: '' } : {};

/**
 * Shows a hotkey with the platform's names for its keys, one badge per chord. Hotkeys are written like TanStack Hotkeys'
 * `Mod+Shift+K`, or as a sequence of them, ex. `['G', 'G']`.
 */
export function Shortcut({ hotkey }: { hotkey: DisplayHotkeyChord | readonly DisplayHotkeyChord[] }) {
	const formatForDisplay = useFormatForDisplay();
	const chords = ([] as readonly DisplayHotkeyChord[]).concat(hotkey);
	return chords.map((chord, step) => (
		// Steps can repeat a chord, so they're keyed by position
		// oxlint-disable-next-line react/no-array-index-key
		<Fragment key={step}>
			{step > 0 && ' '}
			<Kbd>{formatForDisplay(chord, chordOptions)}</Kbd>
		</Fragment>
	));
}

/** An always-visible shortcut hint, omitted in the phone layout */
export function InlineShortcut({ hotkey }: { hotkey: DisplayHotkeyChord | readonly DisplayHotkeyChord[] }) {
	return useMobileLayout() ? null : <Shortcut hotkey={hotkey} />;
}
