import * as stylex from '@stylexjs/stylex';
import type { Mechanism } from '@/data/mechanism';
import { useFieldZoom } from '@/widgets/field/zoom';

const styles = stylex.create({
	canvas: { position: 'relative', overflow: 'hidden', touchAction: 'none' },
	pannable: { cursor: { default: 'grab', ':active': 'grabbing' } },
	svg: { display: 'block', width: '100%', height: '100%' },
});

/** A mechanism's canvas fit to the widget, which zooms and pans like the field */
export function MechanismCanvas({ mechanism }: { mechanism: Mechanism }) {
	const { width, height, backgroundColor, lines } = mechanism;
	const bounds = { x: 0, y: 0, width, height };
	const { svgRef, zoom, transform, startPan, movePan, endPan, reset } = useFieldZoom(bounds);

	return (
		<div
			{...stylex.props(styles.canvas, zoom.scale > 1 && styles.pannable)}
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
				{...stylex.props(styles.svg)}
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
