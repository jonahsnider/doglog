import { DropdownMenu } from '@astryxdesign/core/DropdownMenu';
import { colorVars, focusVars, radiusVars, spacingVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';

const styles = stylex.create({
	// Inline in the legend's text, so it's text with a hover background instead of a button
	trigger: {
		display: 'flex',
		minWidth: 0,
		flexShrink: 0,
		alignItems: 'center',
		gap: spacingVars['--spacing-0-5'],
		marginInline: `calc(-1 * ${spacingVars['--spacing-1']})`,
		paddingInline: spacingVars['--spacing-1'],
		borderRadius: radiusVars['--radius-inner'],
		color: {
			default: colorVars['--color-text-secondary'],
			':is(:hover, [aria-expanded=true])': colorVars['--color-text-primary'],
		},
		backgroundColor: {
			default: 'transparent',
			':is(:hover, [aria-expanded=true])': colorVars['--color-overlay-hover'],
		},
		cursor: { default: 'pointer', ':disabled': 'default' },
		opacity: { default: 1, ':disabled': 0.5 },
		outlineStyle: { default: 'none', ':focus-visible': focusVars['--focus-outline-style'] },
		outlineWidth: focusVars['--focus-outline-width'],
		outlineColor: focusVars['--focus-outline-color'],
	},
	active: {
		color: colorVars['--color-text-primary'],
	},
});

/**
 * A menu opened from text in a legend row, ex. a binding's role. Picking with a pointer leaves nothing focused, so
 * shortcuts like Space to play go to the timeline instead of reopening the menu.
 */
export function LegendMenu({
	label,
	trigger,
	isActive = false,
	isDisabled = false,
	onOpenChange,
	children,
}: {
	/** The trigger's accessible name */
	label: string;
	trigger: ReactNode;
	/** Shows the trigger in the primary text color, ex. while following */
	isActive?: boolean;
	isDisabled?: boolean;
	onOpenChange?: (open: boolean) => void;
	children: ReactNode;
}) {
	return (
		<DropdownMenu
			alignment="end"
			onOpenChange={(open) => {
				onOpenChange?.(open);
				if (!open) {
					// The menu returns focus to its trigger, which only keeps it when the menu was used with keys
					requestAnimationFrame(() => {
						const focused = document.activeElement;
						if (
							focused instanceof HTMLElement &&
							focused.dataset['legendMenu'] !== undefined &&
							!focused.matches(':focus-visible')
						) {
							focused.blur();
						}
					});
				}
			}}
			renderTrigger={(props) => (
				<button
					{...props}
					type="button"
					aria-label={label}
					disabled={isDisabled}
					data-legend-menu=""
					{...stylex.props(styles.trigger, isActive && styles.active)}
				>
					{trigger}
				</button>
			)}
		>
			{children}
		</DropdownMenu>
	);
}
