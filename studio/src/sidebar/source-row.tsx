import { colorVars, radiusVars, typeScaleVars } from '@astryxdesign/core/theme/tokens.stylex';
import { Tooltip } from '@astryxdesign/core/Tooltip';
import * as stylex from '@stylexjs/stylex';
import { useSelector } from '@tanstack/react-store';
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useResizeObserver } from 'usehooks-ts';
import { AppActionMenu, AppContextMenu, type MenuEntry } from '@/components/app-context-menu';
import { TextMorph } from '@/components/text-morph';
import { type Source, sourceId } from '@/data/source';
import { highlightedSourceStore } from '@/data/source-store';
import { duration, reducesMotion } from '@/lib/motion';
import { useSourceSortable } from '@/sidebar/move-source';
import { useSidebar } from '@/sidebar/sidebar-context';
import { SidebarMenuAction, SidebarMenuButton, SidebarMenuItem } from '@/sidebar/sidebar-ui';
import { SourceIcon } from '@/sidebar/source-icon';
import { sourceLabels } from '@/sidebar/source-labels';
import { matchIcons } from '@/sync/match-icons';
import { LineSample } from '@/widgets/line-sample';

const styles = stylex.create({
	hidden: {
		color: colorVars['--color-text-secondary'],
	},
	// Rows are only dragged, pressing them does nothing
	draggable: {
		cursor: { default: 'grab', ':active': 'grabbing' },
	},
	labels: {
		display: 'grid',
		flex: 1,
		minWidth: 0,
		lineHeight: 1.25,
		textAlign: 'start',
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
	sample: {
		display: 'flex',
		flexShrink: 0,
		color: colorVars['--color-icon-secondary'],
	},
	// Covers the rows it passes over, like a dragged dashboard
	dragged: {
		borderRadius: radiusVars['--radius-element'],
		backgroundColor: colorVars['--color-background-body'],
	},
	tooltip: {
		maxWidth: 320,
		overflowWrap: 'anywhere',
		whiteSpace: 'pre-line',
	},
});

/** Flash a row when it's pointed out, ex. when the user opens a log that's already open */
function useHighlight(id: string) {
	const ref = useRef<HTMLLIElement>(null);
	const highlight = useSelector(highlightedSourceStore);
	const count = highlight?.id === id ? highlight.count : undefined;
	useEffect(() => {
		if (count === undefined || ref.current === null) {
			return;
		}
		ref.current.scrollIntoView({ block: 'nearest' });
		if (!reducesMotion()) {
			ref.current.animate([{ backgroundColor: 'var(--color-background-muted)' }, { backgroundColor: 'transparent' }], {
				duration: duration.medium * 1000 * 4,
				easing: 'ease-out',
			});
		}
	}, [count]);
	return ref;
}

/**
 * The row's tooltip: its labels when the sidebar is collapsed, its match type, a log's whole file name, which its name
 * may be cut off from, and whether it's hidden
 */
function rowDescription(source: Source, collapsed: boolean, hidden: boolean): string {
	const { name, detail, matchType } = sourceLabels(source);
	const fileName = source.type === 'log' ? source.fileName : undefined;
	return [
		collapsed ? `${name}: ${detail}` : undefined,
		matchType && matchIcons[matchType].label,
		fileName,
		hidden ? 'Hidden' : undefined,
	]
		.filter(Boolean)
		.join('\n');
}

export function SourceRow({
	source,
	visibleIndex,
	sampled,
	logIndex,
	menuItems,
	header,
	onOpenChange,
}: {
	source: Source;
	/** Position among the visible sources, `undefined` while hidden */
	visibleIndex: number | undefined;
	/** Whether to show the row's line style, only while several sources are visible since widgets draw one solid */
	sampled: boolean;
	/** Position among the logs, `undefined` for the live session */
	logIndex: number | undefined;
	menuItems: MenuEntry[];
	header?: ReactNode;
	onOpenChange?: (open: boolean) => void;
}) {
	const { collapsed } = useSidebar();
	const id = sourceId(source);
	const ref = useHighlight(id);
	const { setElement, handleRef, isDragSource, draggable } = useSourceSortable(source, logIndex);
	const { name, detail } = sourceLabels(source);
	const hidden = visibleIndex === undefined;
	const description = rowDescription(source, collapsed, hidden);

	return (
		<SidebarMenuItem
			ref={(element) => {
				ref.current = element;
				setElement(element);
			}}
			// Where a source dragged from another window goes, see `dropIndex()`
			data-log-index={logIndex}
			xstyle={isDragSource && styles.dragged}
		>
			<AppContextMenu items={menuItems} label={`${name} actions`}>
				<Tooltip
					content={<span {...stylex.props(styles.tooltip)}>{description}</span>}
					placement="end"
					// Closed while the row is dragged, since it would follow the pointer
					isEnabled={description !== '' && !isDragSource}
				>
					{/* Only dragged, its actions are in its menus */}
					<SidebarMenuButton
						ref={handleRef}
						size="lg"
						xstyle={[hidden && styles.hidden, draggable && styles.draggable]}
					>
						<SourceIcon source={source} />
						<SourceLabels name={name} detail={detail} reconnecting={source.status === 'reconnecting'} />
						{!hidden && sampled && (
							<span {...stylex.props(styles.sample)}>
								<LineSample index={visibleIndex} />
							</span>
						)}
					</SidebarMenuButton>
				</Tooltip>
			</AppContextMenu>
			<SidebarMenuAction>
				<AppActionMenu
					items={() => menuItems}
					label="Actions"
					accessibleLabel={`${name} actions`}
					header={header}
					menuWidth={240}
					onOpenChange={onOpenChange}
				/>
			</SidebarMenuAction>
		</SidebarMenuItem>
	);
}

/** A source's name and detail, morphing as they change */
export function SourceLabels({
	name,
	detail,
	reconnecting = false,
}: {
	name: string;
	detail: string;
	reconnecting?: boolean;
}) {
	return (
		<span {...stylex.props(styles.labels)}>
			<FittedText text={name} xstyle={styles.name} />
			<FittedText text={detail} xstyle={[styles.detail, reconnecting && styles.reconnecting]} />
		</span>
	);
}

/**
 * Text that morphs as it changes, or while it doesn't fit, is cut off with an ellipsis instead, since morphing text is
 * drawn a character at a time, which CSS can't add an ellipsis to
 */
function FittedText({ text, xstyle }: { text: string; xstyle: stylex.StyleXStyles }) {
	const ref = useRef<HTMLSpanElement>(null!);
	const [overflowing, setOverflowing] = useState(false);
	const measure = () => {
		// Can run after it's unmounted
		const element: HTMLSpanElement | null = ref.current;
		if (element !== null) {
			setOverflowing(element.scrollWidth > element.clientWidth);
		}
	};
	useResizeObserver({ ref, onResize: measure });
	// Text that changed may fit now, or not anymore
	useLayoutEffect(measure, [text]);
	return (
		<span ref={ref} {...stylex.props(xstyle)}>
			{overflowing ? (
				text
			) : (
				// Numbers are off so addresses aren't morphed like decimals
				<TextMorph as="span" numbers={false}>
					{text}
				</TextMorph>
			)}
		</span>
	);
}
