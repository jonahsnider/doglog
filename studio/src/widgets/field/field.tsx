import { useHotkey } from '@tanstack/react-hotkeys';
import { lazy, type PointerEvent, Suspense, useEffect, useId, useRef, useState } from 'react';
import { useResizeObserver } from 'usehooks-ts';
import { type Entry, useDataVersion } from '@/data/data-store';
import { cn } from '@/lib/utils';
import { useCursorTime } from '@/timeline/timeline';
import {
	type FieldBox,
	type FieldCoordinates,
	type FieldPoint,
	type Measurement,
	type MeasureTool,
	coordinatesTransform,
	fieldLayout,
	measurementLabel,
	orientedField,
	snapTo45,
	toBlueWall,
} from '@/widgets/field/geometry';
import { FieldImage, Minimap } from '@/widgets/field/image';
import { MeasurementDrawing } from '@/widgets/field/measure';
import { fieldLegendItems } from '@/widgets/field/legend-items';
import { CursorPosition, hiddenWhileIdle, ToolButtons } from '@/widgets/field/readout';
import { useCopyPosition } from '@/widgets/field/copy-position';
import { fieldDrawings } from '@/widgets/field/roles';
import { useFieldZoom } from '@/widgets/field/zoom';
import { Legend } from '@/widgets/legend/legend';
import { useMechanisms } from '@/widgets/use-mechanisms';
import { ViewToggle } from '@/widgets/view-toggle';
import type { WidgetProps } from '@/widgets/widget-type';

const loadField3d = async () => ({ default: (await import('@/widgets/field/field-3d')).Field3d });
const Field3d = lazy(loadField3d);
/** Milliseconds after a field appears in 2D that its 3D view starts loading, so it doesn't slow down opening the log */
const preloadDelay = 2000;

/** The field in 2D, or in 3D once its renderer has loaded */
export function Field(props: WidgetProps) {
	return props.options['view'] === '3d' ? (
		<Suspense fallback={null}>
			<Field3d {...props} />
		</Suspense>
	) : (
		<Field2d {...props} />
	);
}

/** Shorter measurements are dropped as accidental clicks */
const minMeasurePixels = 8;

function Field2d({ bindings, options, setOption }: WidgetProps) {
	// three.js and the field's model load in the background, so switching to 3D doesn't wait for them
	useEffect(() => {
		const timeout = setTimeout(() => void loadField3d(), preloadDelay);
		return () => clearTimeout(timeout);
	}, []);
	const coordinates: FieldCoordinates = options['coordinates'] === 'center' ? 'center' : 'blue-wall';
	const field = orientedField(options['orientation']);
	const { bounds, vertical } = field;
	const time = useCursorTime();
	// Values at the cursor change as samples arrive
	useDataVersion();

	const boxRef = useRef<HTMLDivElement>(null!);
	const legendRef = useRef<HTMLDivElement>(null!);
	const [box, setBox] = useState<FieldBox>({ width: 0, height: 0, legendWidth: 0, legendHeight: 0 });
	const measure = () =>
		setBox({
			width: boxRef.current.clientWidth,
			height: boxRef.current.clientHeight,
			legendWidth: legendRef.current.offsetWidth,
			legendHeight: legendRef.current.offsetHeight,
		});
	useResizeObserver({ ref: boxRef, onResize: measure });
	useResizeObserver({ ref: legendRef, onResize: measure });
	const { view, area } = fieldLayout(bounds, box);
	const clipId = useId();
	const { svgRef, zoom, active, transform, toContent, startPan, movePan, endPan, reset } = useFieldZoom(bounds, view);
	/** Field position under the pointer, the last one while it's not over the field so the readout can fade out */
	const [pointer, setPointer] = useState<FieldPoint>();
	const [hovered, setHovered] = useState(false);
	const [minimapLeft, setMinimapLeft] = useState(false);
	const copied = useCopyPosition(pointer, hovered);
	const [tool, setTool] = useState<MeasureTool>();
	const [measurement, setMeasurement] = useState<Measurement>();
	const measuring = useRef(false);

	const toggleTool = (next: MeasureTool) => {
		setTool((current) => (current === next ? undefined : next));
		setMeasurement(undefined);
	};
	// Every field widget registers these, but only the hovered one is enabled
	const whileHovered = { enabled: hovered, conflictBehavior: 'allow' } as const;
	useHotkey('M', () => toggleTool('distance'), whileHovered);
	useHotkey('A', () => toggleTool('angle'), whileHovered);
	useHotkey(
		'Escape',
		() => {
			setTool(undefined);
			setMeasurement(undefined);
		},
		{ ...whileHovered, enabled: hovered && (tool !== undefined || measurement !== undefined) },
	);

	const fieldPointAt = (event: PointerEvent) => {
		const content = toContent(event.clientX, event.clientY);
		return toBlueWall(field.fromSvg(content), coordinates);
	};
	/** Where a field point is in the field's box, as fractions of its width and height */
	const toFraction = (point: FieldPoint) => {
		const { x, y } = field.toSvg(toBlueWall(point, coordinates));
		return {
			x: (zoom.scale * x + zoom.x - view.x) / view.width,
			y: (zoom.scale * y + zoom.y - view.y) / view.height,
		};
	};
	// The part of the field that's shown, for the minimap to outline
	const shownLeft = Math.max((view.x - zoom.x) / zoom.scale, bounds.x);
	const shownTop = Math.max((view.y - zoom.y) / zoom.scale, bounds.y);
	const shown = {
		x: shownLeft,
		y: shownTop,
		width: Math.min((view.x + view.width - zoom.x) / zoom.scale, bounds.x + bounds.width) - shownLeft,
		height: Math.min((view.y + view.height - zoom.y) / zoom.scale, bounds.y + bounds.height) - shownTop,
	};
	const pixelsPerUnit = box.width / view.width;
	// The zoomed field's top-left corner reaches under the legend
	const underLegend =
		(zoom.scale * bounds.x + zoom.x - view.x) * pixelsPerUnit < box.legendWidth &&
		(zoom.scale * bounds.y + zoom.y - view.y) * pixelsPerUnit < box.legendHeight;
	const toPercent = (point: FieldPoint) => {
		const { x, y } = toFraction(point);
		return { left: `${x * 100}%`, top: `${y * 100}%` };
	};

	const valueOf = (entry: Entry | undefined) => (entry && time !== undefined ? entry.samples.valueAt(time) : undefined);
	const mechanisms = useMechanisms(bindings);
	const legend = fieldLegendItems(bindings, { view: '2d', time, mechanisms });

	const label = measurement && measurementLabel(measurement);

	return (
		// The legend floats over the top-left corner, wide when it's above the field and tall when the widget is wider
		// than the field and has room beside it. The field fits beside or under it, and zooms in under it.
		<div
			className={cn(
				'group/field h-full p-2 [container-type:size]',
				vertical ? '[container-name:field-portrait]' : '[container-name:field-landscape]',
			)}
		>
			<div className="flex h-full flex-col gap-1">
				<div className="relative min-h-0 flex-1">
					<div
						ref={boxRef}
						className={cn(
							'absolute inset-0 touch-none overflow-hidden',
							tool === undefined ? zoom.scale > 1 && 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair',
						)}
						onPointerDown={(event) => {
							if (event.button !== 0) {
								return;
							}
							if (tool === undefined) {
								startPan(event);
								return;
							}
							event.currentTarget.setPointerCapture(event.pointerId);
							measuring.current = true;
							const point = fieldPointAt(event);
							setMeasurement({ tool, from: point, to: point });
						}}
						onPointerMove={(event) => {
							const point = fieldPointAt(event);
							setPointer(point);
							setHovered(true);
							// The minimap only switches sides past the middle, so it doesn't flicker while the pointer is near it
							const { x } = toFraction(point);
							setMinimapLeft((current) => (x > 0.6 ? true : x < 0.4 ? false : current));
							if (measuring.current) {
								setMeasurement(
									(current) => current && { ...current, to: event.shiftKey ? snapTo45(current.from, point) : point },
								);
							} else {
								movePan(event);
							}
						}}
						onPointerUp={() => {
							endPan();
							if (measuring.current) {
								measuring.current = false;
								// A click, or a drag too short to see, measures nothing
								const pixelsPerMeter = zoom.scale * svgRef.current.getScreenCTM()!.a;
								setMeasurement((current) =>
									current &&
									Math.hypot(current.to.x - current.from.x, current.to.y - current.from.y) * pixelsPerMeter >=
										minMeasurePixels
										? current
										: undefined,
								);
							}
						}}
						onPointerCancel={() => {
							endPan();
							if (measuring.current) {
								measuring.current = false;
								setMeasurement(undefined);
							}
						}}
						onPointerLeave={() => setHovered(false)}
						onDoubleClick={() => {
							if (tool === undefined) {
								reset();
							}
						}}
					>
						<svg
							ref={svgRef}
							className="block size-full"
							viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
							role="img"
							aria-label="Robot poses on the 2026 field"
						>
							<clipPath id={clipId}>
								<rect {...bounds} />
							</clipPath>
							{/* The field is cut off at the view's margin, so the driver stations don't show in the spare room */}
							<g transform={transform} clipPath={`url(#${clipId})`}>
								<g transform={field.transform}>
									<FieldImage />
									<g transform="scale(1 -1)">
										<g transform={coordinatesTransform(coordinates)}>
											{fieldDrawings(bindings, (binding) => valueOf(binding.entry))}
											{measurement && <MeasurementDrawing measurement={measurement} />}
										</g>
									</g>
								</g>
							</g>
						</svg>
						{label && (
							<div
								className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-sm bg-popover px-1.5 py-0.5 font-mono text-popover-foreground text-xs tabular-nums shadow-sm"
								style={toPercent(label.at)}
							>
								{label.text}
							</div>
						)}
						<div className="pointer-events-none absolute" style={area}>
							<Minimap shown={shown} visible={zoom.scale > 1 && active} left={minimapLeft} field={field} />
						</div>
					</div>
					{/* Opaque so it's readable over the zoomed field, it matches the pane until then */}
					<div
						ref={legendRef}
						className={cn(
							'absolute top-0 left-0 max-h-[33%] w-max max-w-full overflow-y-auto rounded-ee-lg bg-background pe-2 pb-2 transition-shadow field-aside:max-h-full field-aside:max-w-[33cqw]',
							legend.length === 0 && 'hidden',
							underLegend && 'shadow-lg',
						)}
					>
						<Legend items={legend} vertical />
					</div>
				</div>
				<div className="flex h-5 items-center justify-between gap-2 text-muted-foreground text-xs capture:invisible">
					<CursorPosition pointer={pointer} hovered={hovered} copied={copied} />
					<div className="flex items-center gap-2">
						<ToolButtons tool={tool} onToggle={toggleTool} />
						<ViewToggle compact className={hiddenWhileIdle} view="2d" onChange={(next) => setOption('view', next)} />
					</div>
				</div>
			</div>
		</div>
	);
}
