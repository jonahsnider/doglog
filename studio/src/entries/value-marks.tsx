import { CheckboxIndicator } from '@astryxdesign/core/Indicator';
import { colorVars, typeScaleVars, typographyVars } from '@astryxdesign/core/theme/tokens.stylex';
import { Tooltip } from '@astryxdesign/core/Tooltip';
import * as stylex from '@stylexjs/stylex';
import { useSelector } from '@tanstack/react-store';
import BinaryIcon from 'lucide-react/icons/binary';
import BoxIcon from 'lucide-react/icons/box';
import BoxesIcon from 'lucide-react/icons/boxes';
import BracesIcon from 'lucide-react/icons/braces';
import CheckIcon from 'lucide-react/icons/check';
import FileArchiveIcon from 'lucide-react/icons/file-archive';
import HashIcon from 'lucide-react/icons/hash';
import ListChecksIcon from 'lucide-react/icons/list-checks';
import ListIcon from 'lucide-react/icons/list';
import ListOrderedIcon from 'lucide-react/icons/list-ordered';
import SplineIcon from 'lucide-react/icons/spline';
import ToggleRightIcon from 'lucide-react/icons/toggle-right';
import TypeIcon from 'lucide-react/icons/type';
import type { LucideIcon } from 'lucide-react/types';
import { TreeItemCheckbox } from '@ui-sdk/react/tree';
import type { EntryKind } from '@/data/entry-kind';
import { renamedDevicesStore } from '@/data/device-names';
import { embeddedLogFormat, formatEntryType, getEntryKind } from '@/data/samples';
import { knownGroup } from '@/entries/known-groups';
import { entryRowMarker } from './markers.stylex';

const styles = stylex.create({
	mark: {
		display: 'flex',
		flexShrink: 0,
		alignItems: 'center',
		justifyContent: 'center',
		width: 16,
		height: 16,
		color: colorVars['--color-icon-secondary'],
	},
	checked: {
		borderRadius: '0.25rem',
		backgroundColor: colorVars['--color-accent'],
		color: colorVars['--color-on-accent'],
	},
	unchecked: {
		borderWidth: 1,
		borderStyle: 'solid',
		borderRadius: '0.25rem',
		borderColor: colorVars['--color-border-emphasized'],
	},
	checkIcon: {
		width: 12,
		height: 12,
	},
	groupIndicator: {
		width: 16,
		height: 16,
	},
	icon: {
		width: 14,
		height: 14,
	},
	device: {
		flexShrink: 0,
		fontFamily: typographyVars['--font-family-code'],
		fontSize: typeScaleVars['--text-supporting-size'],
		lineHeight: '1rem',
		color: colorVars['--color-text-secondary'],
		whiteSpace: 'nowrap',
	},
	// Gives way to the empty checkbox while its row is hovered or focused
	checkableIcon: {
		display: {
			default: null,
			[stylex.when.ancestor(':hover', entryRowMarker)]: 'none',
			[stylex.when.ancestor(':focus-visible', entryRowMarker)]: 'none',
		},
	},
	emptyCheckbox: {
		display: {
			default: 'none',
			[stylex.when.ancestor(':hover', entryRowMarker)]: 'block',
			[stylex.when.ancestor(':focus-visible', entryRowMarker)]: 'block',
		},
		width: 16,
		height: 16,
	},
});

const kindIcons: Record<EntryKind, LucideIcon> = {
	number: HashIcon,
	boolean: ToggleRightIcon,
	string: TypeIcon,
	struct: BoxIcon,
	'number[]': ListOrderedIcon,
	'boolean[]': ListChecksIcon,
	'string[]': ListIcon,
	'struct[]': BoxesIcon,
	mechanism2d: SplineIcon,
	unsupported: BinaryIcon,
};

/** Icon for an entry type, ex. `#` for `int64` */
export function EntryTypeIcon({ type, className }: { type: string; className?: string | undefined }) {
	const Icon =
		type === 'json'
			? BracesIcon
			: embeddedLogFormat(type) === undefined
				? kindIcons[getEntryKind(type)]
				: FileArchiveIcon;
	return <Icon aria-hidden className={className} />;
}

/**
 * Compact icon for an entry type, with the full type in a tooltip. `checked` shows a checked checkbox in its place, and
 * `checkable` shows an empty one while its `group/entry-row` is hovered or focused.
 */
export function TypeMark({
	type,
	checked = false,
	checkable = false,
}: {
	type: string;
	checked?: boolean;
	checkable?: boolean;
}) {
	return (
		<Tooltip content={formatEntryType(type)}>
			<span
				role="img"
				aria-label={`Type: ${formatEntryType(type)}`}
				{...stylex.props(styles.mark, checked && styles.checked)}
			>
				{checked ? (
					<CheckIcon aria-hidden {...stylex.props(styles.checkIcon)} strokeWidth={3} />
				) : (
					<>
						<EntryTypeIcon type={type} {...stylex.props(styles.icon, checkable && styles.checkableIcon)} />
						{checkable && <span aria-hidden {...stylex.props(styles.unchecked, styles.emptyCheckbox)} />}
					</>
				)}
			</span>
		</Tooltip>
	);
}

/** How many of a group's entries the edited widget shows, see `GroupCheckbox` */
export type GroupCheck = 'checked' | 'partial' | 'unchecked';

/**
 * Binds or unbinds every entry in a group while editing, after its chevron like the checkbox of a group that's also an
 * entry. `sticky` draws it on a pinned copy of the row, outside the tree. Renders nothing without a `check`.
 */
export function GroupCheckbox({ check, sticky = false }: { check: GroupCheck | undefined; sticky?: boolean }) {
	if (check === undefined) {
		return null;
	}
	const sx = stylex.props(styles.mark);
	const indicator = (
		<CheckboxIndicator state={check === 'partial' ? 'indeterminate' : check} size="sm" xstyle={styles.groupIndicator} />
	);
	return sticky ? (
		<span aria-hidden {...sx}>
			{indicator}
		</span>
	) : (
		<TreeItemCheckbox {...sx}>{indicator}</TreeItemCheckbox>
	);
}

/**
 * What the group at `path` is when it's a known group (see `knownGroup()`), or a renamed HOOT device's model and ID, at
 * the end of its row where entries show their values. Renders nothing for other groups.
 */
export function GroupMark({ path }: { path: string }) {
	const group = knownGroup(path);
	const device = useSelector(renamedDevicesStore, (devices) => devices.get(path));
	if (device) {
		return (
			<Tooltip content={`Named by ${device.robot}`}>
				<span {...stylex.props(styles.device)}>{device.id}</span>
			</Tooltip>
		);
	}
	if (!group) {
		return null;
	}

	const { name, icon: Icon } = group;
	return (
		<Tooltip content={name}>
			<span role="img" aria-label={name} {...stylex.props(styles.mark)}>
				<Icon aria-hidden {...stylex.props(styles.icon)} />
			</span>
		</Tooltip>
	);
}
