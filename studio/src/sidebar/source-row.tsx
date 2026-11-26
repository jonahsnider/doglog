import { DropdownMenu } from '@astryxdesign/core/DropdownMenu';
import { IconButton } from '@astryxdesign/core/IconButton';
import { colorVars, spacingVars, typeScaleVars } from '@astryxdesign/core/theme/tokens.stylex';
import { Tooltip } from '@astryxdesign/core/Tooltip';
import * as stylex from '@stylexjs/stylex';
import { useSelector } from '@tanstack/react-store';
import EyeIcon from 'lucide-react/icons/eye';
import EyeOffIcon from 'lucide-react/icons/eye-off';
import XIcon from 'lucide-react/icons/x';
import { type ReactNode, type RefObject, useEffect, useRef } from 'react';
import { AppContextMenu, MenuEntries, type MenuEntry } from '@/components/app-context-menu';
import { TextMorph } from '@/components/text-morph';
import { closeLive, closeLog, solo, type Source, sourceId, toggleHidden } from '@/data/source';
import { highlightedSourceStore } from '@/data/source-store';
import { duration, reducesMotion } from '@/lib/motion';
import { useSourceDrag, useSourceDrop } from '@/sidebar/move-source';
import { useSidebar } from '@/sidebar/sidebar-context';
import { SidebarMenuButton, SidebarMenuItem } from '@/sidebar/sidebar-ui';
import { SourceIcon } from '@/sidebar/source-icon';
import { sourceLabels } from '@/sidebar/source-labels';
import { matchIcons } from '@/sync/match-icons';
import { LineSample } from '@/widgets/line-sample';

const styles = stylex.create({
	row: {
		position: 'relative',
		// Room for the visibility and close buttons, see `sidebar-ui.css`
		'--menu-action-space': `calc(${spacingVars['--spacing-12']} + ${spacingVars['--spacing-2']})`,
	},
	hidden: {
		color: colorVars['--color-text-secondary'],
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
	actions: {
		position: 'absolute',
		insetBlock: 0,
		insetInlineEnd: spacingVars['--spacing-0-5'],
		display: 'flex',
		alignItems: 'center',
	},
	sample: {
		display: 'flex',
		flexShrink: 0,
		color: colorVars['--color-icon-secondary'],
	},
	dropBefore: {
		boxShadow: `inset 0 2px 0 ${colorVars['--color-accent']}`,
	},
	dropAfter: {
		boxShadow: `inset 0 -2px 0 ${colorVars['--color-accent']}`,
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

/** The row's tooltip: its labels when the sidebar is collapsed, its match type, file name, and whether it's hidden */
function rowDescription(source: Source, collapsed: boolean, hidden: boolean): string {
	const { name, detail, matchType } = sourceLabels(source);
	const fileName = source.type === 'log' && source.fileName !== name ? source.fileName : undefined;
	return [
		collapsed ? `${name}: ${detail}` : undefined,
		matchType && matchIcons[matchType].label,
		fileName,
		hidden ? 'Hidden' : undefined,
	]
		.filter(Boolean)
		.join('\n');
}

/** Where the dragged log would drop: above this log, or below it when it's the last one */
function dropLines(
	drop: ReturnType<typeof useSourceDrop>,
	id: string,
	logIndex: number | undefined,
	list: HTMLUListElement | null,
): { dropBefore: boolean; dropAfter: boolean } {
	if (drop?.index === undefined || drop.id === id || logIndex === undefined) {
		return { dropBefore: false, dropAfter: false };
	}
	const lastLog = list?.querySelectorAll('[data-log-index]').length === logIndex + 1;
	return { dropBefore: drop.index === logIndex, dropAfter: lastLog && drop.index === logIndex + 1 };
}

/** The row's visibility toggle, which solos it when Alt-clicked, and its close button */
function RowActions({ source, name, hidden }: { source: Source; name: string; hidden: boolean }) {
	const closeLabel = source.type === 'log' ? 'Close log' : 'Disconnect and clear live data';
	const visibilityLabel = hidden ? 'Show' : 'Hide';
	return (
		<div data-sidebar="menu-action" {...stylex.props(styles.actions)}>
			<IconButton
				label={`${visibilityLabel} ${name}`}
				tooltip={`${visibilityLabel}, Alt-click to solo`}
				icon={hidden ? <EyeOffIcon /> : <EyeIcon />}
				variant="ghost"
				size="sm"
				onClick={(event) => (event.altKey ? solo(source) : toggleHidden(source))}
			/>
			<IconButton
				label={closeLabel}
				tooltip={closeLabel}
				icon={<XIcon />}
				variant="ghost"
				size="sm"
				onClick={source.type === 'log' ? () => closeLog(source.id) : closeLive}
			/>
		</div>
	);
}

export function SourceRow({
	source,
	visibleIndex,
	logIndex,
	list,
	menuItems,
	header,
	onOpenChange,
}: {
	source: Source;
	/** Position among the visible sources, `undefined` while hidden */
	visibleIndex: number | undefined;
	/** Position among the logs, `undefined` for the live session */
	logIndex: number | undefined;
	list: RefObject<HTMLUListElement | null>;
	menuItems: MenuEntry[];
	header?: ReactNode;
	onOpenChange?: (open: boolean) => void;
}) {
	const { collapsed } = useSidebar();
	const id = sourceId(source);
	const ref = useHighlight(id);
	const drag = useSourceDrag(source, list);
	const { name, detail } = sourceLabels(source);
	const hidden = visibleIndex === undefined;
	const description = rowDescription(source, collapsed, hidden);
	const { dropBefore, dropAfter } = dropLines(useSourceDrop(), id, logIndex, list.current);

	return (
		<SidebarMenuItem
			ref={ref}
			data-log-index={logIndex}
			xstyle={[styles.row, dropBefore && styles.dropBefore, dropAfter && styles.dropAfter]}
		>
			<AppContextMenu items={menuItems} label={`${name} actions`}>
				<DropdownMenu
					menuWidth={240}
					header={header}
					onOpenChange={onOpenChange}
					renderTrigger={(trigger) => (
						<Tooltip
							content={<span {...stylex.props(styles.tooltip)}>{description}</span>}
							placement="end"
							isEnabled={description !== ''}
						>
							<SidebarMenuButton
								{...trigger}
								size="lg"
								xstyle={hidden && styles.hidden}
								// A mouse press would open the menu, so it opens on click instead and pressing can drag the row
								onPointerDown={(event) => {
									if (event.pointerType === 'touch') {
										trigger.onPointerDown(event);
									}
									drag.onPointerDown(event);
								}}
								onPointerMove={drag.onPointerMove}
								onPointerUp={drag.onPointerUp}
								onPointerCancel={drag.onPointerCancel}
								onClickCapture={(event) => {
									drag.onClickCapture(event);
									if (!event.isPropagationStopped()) {
										trigger.onClickCapture(event);
									}
								}}
							>
								<SourceIcon source={source} />
								<SourceLabels name={name} detail={detail} reconnecting={source.status === 'reconnecting'} />
								{!hidden && (
									<span {...stylex.props(styles.sample)}>
										<LineSample index={visibleIndex} />
									</span>
								)}
							</SidebarMenuButton>
						</Tooltip>
					)}
				>
					<MenuEntries items={menuItems} />
				</DropdownMenu>
			</AppContextMenu>
			<RowActions source={source} name={name} hidden={hidden} />
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
			{/* Numbers are off so addresses aren't morphed like decimals */}
			<TextMorph as="span" numbers={false} {...stylex.props(styles.name)}>
				{name}
			</TextMorph>
			<TextMorph as="span" numbers={false} {...stylex.props(styles.detail, reconnecting && styles.reconnecting)}>
				{detail}
			</TextMorph>
		</span>
	);
}
