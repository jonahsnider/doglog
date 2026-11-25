import { colorVars, radiusVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import { use } from 'react';
import { VideoRange } from '@/timeline/video-range';
import { useHoverTime } from '@/timeline/hover';
import type { TimeScale } from '@/timeline/scale';
import { TimelineCursorContext } from '@/timeline/timeline';
import { useZoomedRange } from '@/widgets/graph/view';

const styles = stylex.create({
	zoomed: {
		position: 'absolute',
		insetBlock: 0,
		borderRadius: radiusVars['--radius-inner'],
		backgroundColor: `color-mix(in srgb, ${colorVars['--color-text-primary']} 8%, transparent)`,
		boxShadow: `inset 0 0 0 1px ${colorVars['--color-border-emphasized']}`,
		pointerEvents: 'none',
	},
	hover: {
		position: 'absolute',
		insetBlock: 0,
		width: 1,
		translate: '-50% 0',
		backgroundColor: colorVars['--color-text-secondary'],
	},
});

/** The playhead and filled track can move without rebuilding the tooltip or the track's other marks. */
export function ScrubberPosition({
	toPercent,
	xstyle,
	property,
}: {
	toPercent: (time: number) => number;
	xstyle: stylex.StyleXStyles;
	property: 'left' | 'width';
}) {
	const time = use(TimelineCursorContext)!;
	return <div {...stylex.props(xstyle)} style={{ [property]: `${toPercent(time)}%` }} />;
}

/**
 * The time range graphs are zoomed to, so it's clear where they are in the whole source, the hovered time: the one
 * the tooltip is about, or the one hovered in a graph, and the range of a video being exported
 */
export function GraphMarks({ scale, hoverTime }: { scale: TimeScale; hoverTime: number | undefined }) {
	const { toPercent } = scale;
	const zoomed = useZoomedRange();
	const graphHover = useHoverTime();
	const hover = hoverTime ?? graphHover;
	const hoverLine = stylex.props(styles.hover);
	return (
		<>
			{zoomed && (
				<div
					{...stylex.props(styles.zoomed)}
					style={{ left: `${toPercent(zoomed.start)}%`, width: `${toPercent(zoomed.end) - toPercent(zoomed.start)}%` }}
				/>
			)}
			{hover !== undefined && (
				<div
					{...hoverLine}
					className={`${hoverLine.className} capture-invisible`}
					style={{ left: `${toPercent(hover)}%` }}
				/>
			)}
			<VideoRange scale={scale} />
		</>
	);
}
