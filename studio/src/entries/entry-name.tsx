import { colorVars, durationVars, easeVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import { HighlightedText } from '@/components/highlighted-text';
import { commonPrefixMarker, entryNameMarker, nameSegmentMarker } from './markers.stylex';
import { ambiguousSegments, distinctSegments, hiddenNameLetters, lastSegmentsStart } from '@/entries/short-names';

const styles = stylex.create({
	dimmed: {
		color: colorVars['--color-text-secondary'],
	},
	// Animating the column from 0fr to 1fr grows the text to its own width
	shortened: {
		display: 'inline-grid',
		verticalAlign: 'bottom',
		transitionProperty: 'grid-template-columns',
		transitionDuration: `calc(${durationVars['--duration-fast']} * var(--motion-scale))`,
		transitionTimingFunction: easeVars['--ease-move'],
	},
	inCommonPrefix: {
		gridTemplateColumns: { default: '0fr', [stylex.when.ancestor(':hover', commonPrefixMarker)]: '1fr' },
		transitionDelay: {
			default: null,
			[stylex.when.ancestor(':hover', commonPrefixMarker)]: 'calc(300ms * var(--motion-scale))',
		},
	},
	inSegment: {
		gridTemplateColumns: {
			default: '0fr',
			[stylex.when.ancestor(':hover', nameSegmentMarker)]: '1fr',
			[stylex.when.ancestor(':has([data-common-prefix]:hover)', entryNameMarker)]: '1fr',
		},
		transitionDelay: {
			default: null,
			[stylex.when.ancestor(':hover', nameSegmentMarker)]: 'calc(300ms * var(--motion-scale))',
			[stylex.when.ancestor(':has([data-common-prefix]:hover)', entryNameMarker)]: 'calc(300ms * var(--motion-scale))',
		},
	},
	clip: {
		overflow: 'hidden',
	},
});

/**
 * Prefixes shortened to their slashes and capital letters, like fish shortens paths, ex. `/Robot/Arm/Angle` is shown
 * as `/R/Arm/Angle` and `/AdvantageKit/RealOutputs/Arm/Angle` as `/AK/RO/Arm/Angle`. Longer prefixes come first.
 */
const shortenedPrefixes = [
	'/AdvantageKit/RealOutputs',
	'/AdvantageKit/DriverStation',
	'/AdvantageKit',
	'/RealOutputs',
	'/Robot',
];

type Ranges = readonly number[] | undefined;

/**
 * An entry's name with dimmed slashes and common prefixes shortened. Hovering a shortened segment shows it in full, and
 * hovering the dimmed common prefix shows the whole name. `ranges` of the name are highlighted, ex. the parts matching a
 * search. `collapsed` also shortens the first segment after the common prefix when it isn't the last, ex.
 * `/Robot/Drive/Pose` is shown as `/R/D/Pose`. `distinctFrom` shortens every segment instead, but the last ones that
 * tell the name apart from those names and the ones that would shorten the same as theirs, ex. `/Robot/Drive/Pose` is
 * shown as `/R/D/Pose` beside `/Robot/Arm/Angle`, and `/R/Drive/Pose` beside `/Robot/Dashboard/Mode`.
 */
export function EntryName({
	name,
	ranges,
	collapsed = false,
	distinctFrom,
}: {
	name: string;
	ranges?: Ranges;
	collapsed?: boolean | undefined;
	distinctFrom?: readonly string[] | undefined;
}) {
	const common = shortenedPrefixes.find((candidate) => name.startsWith(`${candidate}/`)) ?? '';
	let shortened = common;
	if (distinctFrom) {
		shortened = name.slice(0, lastSegmentsStart(name, distinctSegments(name, distinctFrom)));
	} else if (collapsed) {
		shortened = common + (/^\/?[^/]+(?=\/)/u.exec(name.slice(common.length))?.[0] ?? '');
	}
	const prefix = shortened.length > common.length ? shortened : common;
	if (prefix === '') {
		return <DimmedSlashes text={name} ranges={ranges} offset={0} />;
	}
	const full = distinctFrom ? ambiguousSegments(name, distinctFrom) : new Set<number>();

	return (
		<span>
			<span {...stylex.props(entryNameMarker)}>
				{common !== '' && (
					// Dimmed, a collapsed segment is as important as the rest of the name
					<span data-common-prefix {...stylex.props(commonPrefixMarker, styles.dimmed)}>
						<Shortened text={common} ranges={ranges} offset={0} common />
					</span>
				)}
				{Array.from(prefix.slice(common.length).matchAll(/\/?[^/]+/gu), ({ 0: segment, index }) => {
					const start = common.length + index;
					return full.has(start) ? (
						<DimmedSlashes key={start} text={segment} ranges={ranges} offset={start} />
					) : (
						<span key={start} {...stylex.props(nameSegmentMarker)}>
							<Shortened text={segment} ranges={ranges} offset={start} common={false} />
						</span>
					);
				})}
			</span>
			<DimmedSlashes text={name.slice(prefix.length)} ranges={ranges} offset={prefix.length} />
		</span>
	);
}

/**
 * Part of a name shortened to its slashes, first letters, and capitals, shown in full while hovered. Segments after the
 * common prefix are also shown in full while it's hovered.
 */
function Shortened({
	text,
	ranges,
	offset,
	common,
}: {
	text: string;
	ranges: Ranges;
	offset: number;
	common: boolean;
}) {
	let next = offset;
	// The captured runs land at odd indexes, between the parts that stay visible.
	return text.split(hiddenNameLetters).map((part, index) => {
		const start = next;
		next += part.length;
		if (part === '') {
			return null;
		}
		if (index % 2 === 0) {
			return common ? (
				<HighlightedText key={start} text={part} ranges={ranges} offset={start} />
			) : (
				<DimmedSlashes key={start} text={part} ranges={ranges} offset={start} />
			);
		}
		return (
			<span key={start} {...stylex.props(styles.shortened, common ? styles.inCommonPrefix : styles.inSegment)}>
				<span {...stylex.props(styles.clip)}>
					<HighlightedText text={part} ranges={ranges} offset={start} />
				</span>
			</span>
		);
	});
}

function DimmedSlashes({ text, ranges, offset }: { text: string; ranges: Ranges; offset: number }) {
	return Array.from(text.matchAll(/\/+|[^/]+/gu), ({ 0: part, index: start }) => {
		const highlighted = <HighlightedText key={start} text={part} ranges={ranges} offset={offset + start} />;
		return part.startsWith('/') ? (
			<span key={start} {...stylex.props(styles.dimmed)}>
				{highlighted}
			</span>
		) : (
			highlighted
		);
	});
}
