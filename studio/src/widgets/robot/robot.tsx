import { SplineIcon } from 'lucide-react';
import { useMemo } from 'react';
import { useDataVersion, useEntries } from '@/data/data-store';
import { type Mechanism, mechanismLayout, readMechanism } from '@/data/mechanism';
import { cn } from '@/lib/utils';
import { useCursorTime } from '@/timeline/timeline';
import { useFieldZoom } from '@/widgets/field/zoom';
import { Legend, type LegendItem } from '@/widgets/legend/legend';
import { NoData } from '@/widgets/no-data';
import type { WidgetProps } from '@/widgets/widget-type';

/** A mechanism's canvas fit to the widget, which zooms and pans like the field */
function MechanismCanvas({ mechanism }: { mechanism: Mechanism }) {
	const { width, height, backgroundColor, lines } = mechanism;
	const bounds = useMemo(() => ({ x: 0, y: 0, width, height }), [width, height]);
	const { svgRef, zoom, transform, startPan, movePan, endPan, reset } = useFieldZoom(bounds);

	return (
		<div
			className={cn('relative touch-none overflow-hidden', zoom.scale > 1 && 'cursor-grab active:cursor-grabbing')}
			style={{ width: `min(100cqw, 100cqh * ${width / height})`, aspectRatio: `${width} / ${height}` }}
			onPointerDown={(event) => {
				if (event.button === 0) {
					startPan(event);
				}
			}}
			onPointerMove={(event) => {
				movePan(event);
			}}
			onPointerUp={endPan}
			onPointerCancel={endPan}
			onDoubleClick={reset}
		>
			<svg
				ref={svgRef}
				className="block size-full"
				viewBox={`0 0 ${width} ${height}`}
				role="img"
				aria-label="Mechanism"
			>
				<g transform={transform}>
					{/* Colors are drawn as logged, they don't follow the theme */}
					<rect width={width} height={height} fill={backgroundColor} />
					<g transform={`translate(0 ${height}) scale(1 -1)`}>
						{lines.map((line) => (
							<line
								key={line.id}
								x1={line.start.x}
								y1={line.start.y}
								x2={line.end.x}
								y2={line.end.y}
								stroke={line.color}
								// Weights are in pixels, zoomed with the mechanism
								strokeWidth={line.weight * zoom.scale}
								strokeLinecap="round"
								vectorEffect="non-scaling-stroke"
							/>
						))}
					</g>
				</g>
			</svg>
		</div>
	);
}

export function Robot({ bindings }: WidgetProps) {
	const time = useCursorTime();
	// Values at the cursor change as samples arrive
	useDataVersion();
	const entries = useEntries();

	// Only one mechanism is drawn in 2D, the others are for 3D
	const shown = bindings.find((binding) => binding.entry !== undefined && !binding.hidden);
	const shownName = shown?.entry?.name;
	const layout = useMemo(
		() => (shownName === undefined ? undefined : mechanismLayout(shownName, entries)),
		[shownName, entries],
	);
	const mechanism = layout && time !== undefined ? readMechanism(layout, time) : undefined;

	const legend = bindings.map((binding): LegendItem => ({
		binding,
		icon: <SplineIcon className="size-3.5" />,
		dimmed: binding.entry === undefined || (binding === shown && mechanism === undefined),
		...(binding.entry !== undefined && !binding.hidden && binding !== shown && { note: '3D only' }),
	}));

	return (
		<div className="h-full p-2 [container-type:size]">
			<div className="flex h-full flex-col gap-2">
				<div className="max-h-[33%] shrink-0 overflow-y-auto">
					<Legend items={legend} />
				</div>
				<div className="flex min-h-0 min-w-0 flex-1 items-center justify-center [container-type:size]">
					{mechanism ? <MechanismCanvas mechanism={mechanism} /> : <NoData />}
				</div>
			</div>
		</div>
	);
}
