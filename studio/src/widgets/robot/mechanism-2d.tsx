import { useMemo } from 'react';
import type { Mechanism } from '@/data/mechanism';
import { cn } from '@/lib/utils';
import { useFieldZoom } from '@/widgets/field/zoom';

/** A mechanism's canvas fit to the widget, which zooms and pans like the field */
export function MechanismCanvas({ mechanism }: { mechanism: Mechanism }) {
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
