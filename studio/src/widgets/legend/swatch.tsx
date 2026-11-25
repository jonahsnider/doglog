import { Popover } from '@astryxdesign/core/Popover';
import { colorVars, focusVars, radiusVars, spacingVars, sizeVars } from '@astryxdesign/core/theme/tokens.stylex';
import { ToggleButton } from '@astryxdesign/core/ToggleButton';
import * as stylex from '@stylexjs/stylex';
import { type RefObject, use, useEffect, useRef, useState } from 'react';
import { WidgetBindingsContext } from '@/entries/drag';
import { chartCount } from '@/theme/choices';
import { seriesColor } from '@/widgets/series-color';
import type { LegendItem } from '@/widgets/legend/legend';
import type { WidgetBinding } from '@/widgets/widget-type';

const focusRing = {
	outlineStyle: { default: 'none', ':focus-visible': focusVars['--focus-outline-style'] },
	outlineWidth: focusVars['--focus-outline-width'],
	outlineColor: focusVars['--focus-outline-color'],
} as const;

const styles = stylex.create({
	picker: {
		outline: 'none',
		display: 'flex',
		flexDirection: 'column',
		gap: spacingVars['--spacing-1'],
	},
	colors: {
		display: 'grid',
		gridTemplateColumns: 'repeat(5, auto)',
		gap: spacingVars['--spacing-0-5'],
	},
	color: {
		...focusRing,
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		width: sizeVars['--size-element-sm'],
		height: sizeVars['--size-element-sm'],
		borderRadius: radiusVars['--radius-full'],
		backgroundColor: { default: 'transparent', ':hover': colorVars['--color-overlay-hover'] },
		boxShadow: { default: null, ':is([aria-pressed=true])': `inset 0 0 0 2px ${colorVars['--color-text-primary']}` },
		cursor: 'pointer',
	},
	fill: (color: string) => ({
		width: spacingVars['--spacing-5'],
		height: spacingVars['--spacing-5'],
		borderRadius: radiusVars['--radius-full'],
		backgroundColor: color,
	}),
	// Clicked anywhere in the row's height, around the small swatch it shows, without growing past it for icons
	swatch: {
		...focusRing,
		display: 'flex',
		flexShrink: 0,
		alignItems: 'center',
		height: spacingVars['--spacing-6'],
		margin: -6,
		padding: 6,
		borderRadius: radiusVars['--radius-full'],
		cursor: 'pointer',
	},
	dot: (color: string, isHidden: boolean) => ({
		width: spacingVars['--spacing-3'],
		height: spacingVars['--spacing-3'],
		borderWidth: 2,
		borderStyle: 'solid',
		borderColor: color,
		borderRadius: radiusVars['--radius-full'],
		backgroundColor: isHidden ? 'transparent' : color,
	}),
	icon: {
		display: 'flex',
	},
	hiddenIcon: {
		opacity: 0.4,
	},
});

function ColorPicker({
	binding,
	anchor,
	open,
	onOpenChange,
	onPick,
}: {
	binding: WidgetBinding;
	anchor: RefObject<HTMLButtonElement | null>;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onPick: (color: number | undefined) => void;
}) {
	const picker = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (open) {
			// After the popover shows, since its content stays mounted while it's closed
			const frame = requestAnimationFrame(() => picker.current?.focus());
			return () => cancelAnimationFrame(frame);
		}
		return undefined;
	}, [open]);
	const close = () => {
		onOpenChange(false);
		// Closing returns focus to the swatch, which only keeps it after using the keyboard, so Space plays or pauses after
		// picking with the mouse
		requestAnimationFrame(() => {
			const swatch = anchor.current;
			if (swatch && document.activeElement === swatch && !swatch.matches(':focus-visible')) {
				swatch.blur();
			}
		});
	};
	const pick = (color: number | undefined) => {
		onPick(color);
		close();
	};
	return (
		<Popover
			// Popover's anchor type leaves out the null every ref starts with, unlike Tooltip's
			// oxlint-disable-next-line typescript/no-unsafe-type-assertion
			anchorRef={anchor as RefObject<HTMLElement>}
			isOpen={open}
			onOpenChange={(next) => (next ? onOpenChange(true) : close())}
			label={`${binding.name} color`}
			padding={2}
			// Focusing the picker instead of its first color doesn't show a focus ring after right-clicking, Tab still reaches
			// the colors
			hasAutoFocus={false}
			content={
				<div ref={picker} tabIndex={-1} {...stylex.props(styles.picker)}>
					<ToggleButton
						label="Auto"
						size="sm"
						isPressed={binding.color === undefined}
						onPressedChange={() => pick(undefined)}
					/>
					<div {...stylex.props(styles.colors)}>
						{Array.from({ length: chartCount }, (_, index) => (
							<button
								key={index}
								type="button"
								{...stylex.props(styles.color)}
								aria-label={`Color ${index + 1}`}
								aria-pressed={binding.color === index}
								onClick={() => pick(index)}
							>
								<span {...stylex.props(styles.fill(seriesColor(index)))} />
							</button>
						))}
					</div>
				</div>
			}
		/>
	);
}

/** Toggles whether the binding is hidden, right-clicking a colored swatch picks its color */
export function LegendSwatch({ item }: { item: LegendItem }) {
	const { binding } = item;
	const widget = use(WidgetBindingsContext);
	const swatch = useRef<HTMLButtonElement>(null);
	const [pickingColor, setPickingColor] = useState(false);
	return (
		<>
			{/* Hidden bindings show a hollow swatch, unlike dimmed ones that just have no value */}
			<button
				ref={swatch}
				type="button"
				{...stylex.props(styles.swatch)}
				aria-label={`${binding.hidden ? 'Show' : 'Hide'} ${binding.name}`}
				aria-pressed={!binding.hidden}
				data-binding-color={item.icon === undefined ? '' : undefined}
				// Clicking doesn't focus it, so Space plays or pauses instead of toggling it again
				onMouseDown={(event) => event.preventDefault()}
				onClick={() => widget?.toggleHidden(binding.id)}
				// Instead of opening the widget's menu
				onContextMenu={
					item.icon === undefined
						? (event) => {
								event.preventDefault();
								event.stopPropagation();
								setPickingColor(true);
							}
						: undefined
				}
			>
				{item.icon === undefined ? (
					<span {...stylex.props(styles.dot(item.color ?? 'currentColor', binding.hidden ?? false))} />
				) : (
					<span {...stylex.props(styles.icon, binding.hidden && styles.hiddenIcon)}>{item.icon}</span>
				)}
			</button>
			{item.icon === undefined && (
				<ColorPicker
					binding={binding}
					anchor={swatch}
					open={pickingColor}
					onOpenChange={setPickingColor}
					onPick={(color) => widget?.setColor(binding.id, color)}
				/>
			)}
		</>
	);
}
