import { IconButton } from '@astryxdesign/core/IconButton';
import { navItemStyles } from '@astryxdesign/core/NavItem/navItemStyles.stylex';
import { colorVars, radiusVars, shadowVars, spacingVars, typeScaleVars } from '@astryxdesign/core/theme/tokens.stylex';
import { focusOutlineProps } from '@astryxdesign/core/utils/focusOutline.stylex';
import { interactionOverlayStyles } from '@astryxdesign/core/utils/interactionOverlay.stylex';
import * as stylex from '@stylexjs/stylex';
import XIcon from 'lucide-react/icons/x';
import { useAnimate } from 'motion/react';
import { useLayoutEffect, useRef } from 'react';
import { shortcuts } from '@/commands/commands';
import { Shortcut } from '@/components/shortcut';
import { closeLive, closeLog, type Source, showSource } from '@/data/source';
import { easing, useMotionTransition } from '@/lib/motion';
import { SourceIcon } from '@/sidebar/source-icon';
import { sourceLabels } from '@/sidebar/source-labels';

const styles = stylex.create({
	switcher: {
		position: 'relative',
		display: 'grid',
		padding: spacingVars['--spacing-0-5'],
		borderRadius: radiusVars['--radius-element'],
		backgroundColor: colorVars['--color-background-muted'],
	},
	indicator: {
		position: 'absolute',
		insetInline: spacingVars['--spacing-0-5'],
		top: spacingVars['--spacing-0-5'],
		height: `calc(50% - ${spacingVars['--spacing-0-5']})`,
		borderRadius: radiusVars['--radius-element'],
		backgroundColor: colorVars['--color-background-surface'],
		boxShadow: shadowVars['--shadow-low'],
		pointerEvents: 'none',
	},
	lifted: {
		position: 'absolute',
		inset: 0,
		borderRadius: radiusVars['--radius-element'],
		boxShadow: shadowVars['--shadow-high'],
		opacity: 0,
	},
	row: {
		position: 'relative',
		display: 'flex',
		alignItems: 'center',
	},
	source: {
		minHeight: 44,
		gap: spacingVars['--spacing-2'],
		paddingBlock: spacingVars['--spacing-1-5'],
		paddingInlineEnd: spacingVars['--spacing-9'],
		color: colorVars['--color-text-secondary'],
	},
	shown: {
		color: colorVars['--color-text-primary'],
	},
	labels: {
		display: 'grid',
		flex: 1,
		minWidth: 0,
		lineHeight: 1.25,
	},
	name: {
		overflow: 'hidden',
		fontWeight: 500,
		textOverflow: 'ellipsis',
		whiteSpace: 'nowrap',
	},
	detail: {
		overflow: 'hidden',
		color: colorVars['--color-text-secondary'],
		fontSize: typeScaleVars['--text-supporting-size'],
		textOverflow: 'ellipsis',
		whiteSpace: 'nowrap',
	},
	reconnecting: {
		color: colorVars['--color-text-error'],
	},
	close: {
		position: 'absolute',
		insetInlineEnd: spacingVars['--spacing-1'],
	},
});

/**
 * The raised surface behind the shown source. Switching sources slides it over the other source, its shadow deepening
 * while it moves as though it's lifted off them. Sources are the same height, so it moves by its own height.
 */
function ShownIndicator({ index }: { index: number }) {
	const [scope, animate] = useAnimate<HTMLDivElement>();
	const shadow = useRef<HTMLDivElement>(null);
	const transition = useMotionTransition({ duration: 0.25, ease: easing.inOut });
	const shownIndex = useRef(index);

	// Before painting, so it's under the shown source as soon as the menu opens
	useLayoutEffect(() => {
		void animate(scope.current, { y: `${shownIndex.current * 100}%` }, { duration: 0 });
	}, [animate, scope]);

	useLayoutEffect(() => {
		const from = shownIndex.current;
		if (from === index) {
			return;
		}
		shownIndex.current = index;
		void animate(scope.current, { y: [`${from * 100}%`, `${index * 100}%`] }, transition);
		if (shadow.current) {
			void animate(shadow.current, { opacity: [0, 1, 0] }, transition);
		}
	}, [animate, index, scope, transition]);

	return (
		<div ref={scope} aria-hidden {...stylex.props(styles.indicator)}>
			<div ref={shadow} {...stylex.props(styles.lifted)} />
		</div>
	);
}

function SourceRow({ source, shown }: { source: Source; shown: boolean }) {
	const { name, detail } = sourceLabels(source);
	const closeLabel = source.type === 'log' ? 'Close log' : 'Disconnect and clear live data';
	return (
		<div {...stylex.props(styles.row)}>
			<button
				type="button"
				aria-current={shown}
				onClick={() => showSource(source.type)}
				{...focusOutlineProps.focusVisible(
					navItemStyles.item,
					interactionOverlayStyles.backgroundColor,
					styles.source,
					shown && styles.shown,
				)}
			>
				<SourceIcon source={source} />
				<span {...stylex.props(styles.labels)}>
					<span {...stylex.props(styles.name)}>{name}</span>
					<span {...stylex.props(styles.detail, source.status === 'reconnecting' && styles.reconnecting)}>
						{detail}
					</span>
				</span>
				{!shown && <Shortcut hotkey={shortcuts.switchSource} />}
			</button>
			<IconButton
				label={closeLabel}
				tooltip={closeLabel}
				icon={<XIcon />}
				variant="ghost"
				size="sm"
				xstyle={styles.close}
				onClick={source.type === 'log' ? closeLog : closeLive}
			/>
		</div>
	);
}

/** Switches between the live session and the log behind it, shown above the source menu while both are open */
export function SourceSwitcher({ live, log, shown }: { live: Source; log: Source; shown: Source['type'] | undefined }) {
	return (
		<div {...stylex.props(styles.switcher)}>
			<ShownIndicator index={shown === 'log' ? 1 : 0} />
			<SourceRow source={live} shown={shown === 'live'} />
			<SourceRow source={log} shown={shown === 'log'} />
		</div>
	);
}
