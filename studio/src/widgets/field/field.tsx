import { useHotkey } from '@tanstack/react-hotkeys';
import { type PointerEvent, useEffect, useRef, useState } from 'react';
import { type Entry, useDataVersion } from '@/data/data-store';
import { cn } from '@/lib/utils';
import { useCursorTime } from '@/timeline/timeline';
import {
	type FieldCoordinates,
	type FieldPoint,
	type Measurement,
	type MeasureTool,
	coordinatesTransform,
	measurementLabel,
	orientedField,
	snapTo45,
	toBlueWall,
} from '@/widgets/field/geometry';
import { FieldImage, Minimap } from '@/widgets/field/image';
import { MeasurementDrawing } from '@/widgets/field/measure';
import { CursorPosition, ToolButtons } from '@/widgets/field/readout';
import { fieldDrawings } from '@/widgets/field/roles';
import { useFieldZoom } from '@/widgets/field/zoom';
import { Legend, type LegendItem } from '@/widgets/legend/legend';
import { bindingColor } from '@/widgets/series-color';
import type { WidgetProps } from '@/widgets/widget-type';

/** Height of the cursor position row under the field, and the gap above it */
const readoutHeight = '1.5rem';

/** Shorter measurements are dropped as accidental clicks */
const minMeasurePixels = 8;

function formatPosition({ x, y }: FieldPoint): string {
	return `${x.toFixed(2)}, ${y.toFixed(2)}`;
}

export function Field({ bindings, options }: WidgetProps) {
	const coordinates: FieldCoordinates = options['coordinates'] === 'center' ? 'center' : 'blue-wall';
	const field = orientedField(options['orientation']);
	const { aspectRatio, bounds, vertical } = field;
	const time = useCursorTime();
	// Values at the cursor change as samples arrive
	useDataVersion();

	const { svgRef, zoom, active, transform, toContent, startPan, movePan, endPan, reset } = useFieldZoom(bounds);
	/** Field position under the pointer, the last one while it's not over the field so the readout can fade out */
	const [pointer, setPointer] = useState<FieldPoint>();
	const [hovered, setHovered] = useState(false);
	const [minimapLeft, setMinimapLeft] = useState(false);
	const [copied, setCopied] = useState(false);
	const copiedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
	useEffect(() => () => clearTimeout(copiedTimer.current), []);
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
	useHotkey(
		'Mod+C',
		() => {
			void navigator.clipboard.writeText(formatPosition(pointer!));
			setCopied(true);
			clearTimeout(copiedTimer.current);
			copiedTimer.current = setTimeout(() => setCopied(false), 1200);
		},
		whileHovered,
	);

	const fieldPointAt = (event: PointerEvent) => {
		const content = toContent(event.clientX, event.clientY);
		return toBlueWall(field.fromSvg(content), coordinates);
	};
	/** Where a field point is in the field's box, as fractions of its width and height */
	const toFraction = (point: FieldPoint) => {
		const { x, y } = field.toSvg(toBlueWall(point, coordinates));
		return {
			x: (zoom.scale * x + zoom.x - bounds.x) / bounds.width,
			y: (zoom.scale * y + zoom.y - bounds.y) / bounds.height,
		};
	};
	const toPercent = (point: FieldPoint) => {
		const { x, y } = toFraction(point);
		return { left: `${x * 100}%`, top: `${y * 100}%` };
	};

	const valueOf = (entry: Entry | undefined) => (entry && time !== undefined ? entry.samples.valueAt(time) : undefined);
	const legend = bindings.map((binding, index): LegendItem => ({
		binding,
		color: bindingColor(binding, index),
		dimmed: valueOf(binding.entry) === undefined,
	}));

	const label = measurement && measurementLabel(measurement);
	const fieldWidth = `(100cqh - ${readoutHeight}) * ${aspectRatio}`;

	return (
		// The legend goes above the field, unless the widget is wider than the field and has room beside it. There, the
		// field is centered between equal columns, and only moves right as far as the legend needs.
		<div
			className={cn(
				'h-full p-2 [container-type:size]',
				vertical ? '[container-name:field-portrait]' : '[container-name:field-landscape]',
			)}
		>
			<div className="flex h-full flex-col gap-2 field-aside:grid field-aside:grid-cols-[1fr_minmax(0,max-content)_1fr] field-aside:gap-x-0">
				{legend.length > 0 && (
					<div className="max-h-[33%] shrink-0 overflow-y-auto field-aside:me-2 field-aside:max-h-none field-aside:w-max field-aside:max-w-[33cqw]">
						<Legend items={legend} vertical />
					</div>
				)}
				<div className="flex min-h-0 min-w-0 flex-1 items-center justify-center [container-type:size] field-aside:col-start-2 field-aside:[container-type:normal]">
					<div
						className="flex max-w-full flex-col gap-1"
						// In short panes the portrait image can be narrower than the controls below it.
						style={{ width: `min(100cqw, ${vertical ? `max(18rem, ${fieldWidth})` : fieldWidth})` }}
					>
						<div
							className={cn(
								'relative self-center touch-none overflow-hidden',
								tool === undefined ? zoom.scale > 1 && 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair',
							)}
							style={{ aspectRatio, width: `min(100%, ${fieldWidth})` }}
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
									const pixelsPerMeter = zoom.scale * svgRef.current!.getScreenCTM()!.a;
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
								viewBox={field.viewBox}
								role="img"
								aria-label="Robot poses on the 2026 field"
							>
								<g transform={transform}>
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
							<Minimap zoom={zoom} visible={zoom.scale > 1 && active} left={minimapLeft} field={field} />
						</div>
						<div className="flex h-5 items-center justify-between gap-2 text-muted-foreground text-xs">
							<CursorPosition pointer={pointer} hovered={hovered} copied={copied} />
							<ToolButtons tool={tool} onToggle={toggleTool} />
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
