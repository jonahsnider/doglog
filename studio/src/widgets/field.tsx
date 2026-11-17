import { useHotkey } from '@tanstack/react-hotkeys';
import { type PointerEvent, useEffect, useRef, useState } from 'react';
import { ControlTooltip } from '@/components/control-tooltip';
import { Kbd } from '@/components/ui/kbd';
import { Toggle } from '@/components/ui/toggle';
import { type Entry, useDataVersion } from '@/data/data-store';
import { cn } from '@/lib/utils';
import { useCursorTime } from '@/timeline';
import {
	type FieldPoint,
	type Measurement,
	type MeasureTool,
	aspectRatio,
	measurementLabel,
	snapTo45,
	view,
} from '@/widgets/field-geometry';
import { FieldImage, Minimap } from '@/widgets/field-image';
import { MeasurementDrawing } from '@/widgets/field-measure';
import { fieldDrawings } from '@/widgets/field-roles';
import { useFieldZoom } from '@/widgets/field-zoom';
import { Legend, type LegendItem } from '@/widgets/legend';
import { seriesColor } from '@/widgets/series-color';
import type { WidgetProps } from '@/widgets/widget-type';

/** Height of the cursor position row under the field, and the gap above it */
const readoutHeight = '1.5rem';

/** Shorter measurements are dropped as accidental clicks */
const minMeasurePixels = 8;

const tools: readonly { tool: MeasureTool; key: 'M' | 'A'; label: string; hint: string }[] = [
	{ tool: 'distance', key: 'M', label: 'Distance', hint: 'Drag to measure distance, hold Shift to snap to 45°' },
	{ tool: 'angle', key: 'A', label: 'Angle', hint: 'Drag to measure the angle from +X, hold Shift to snap to 45°' },
];

function formatPosition({ x, y }: FieldPoint): string {
	return `${x.toFixed(2)}, ${y.toFixed(2)}`;
}

/** The field position under the pointer. Like a hovered pane title, it gets a background while it says it was copied. */
function CursorPosition({
	pointer,
	hovered,
	copied,
}: {
	pointer: FieldPoint | undefined;
	hovered: boolean;
	copied: boolean;
}) {
	return (
		<span
			className={cn(
				'-ms-1 grid rounded-md px-1 py-0.5 transition-[background-color,color,opacity] duration-150',
				copied && 'bg-accent text-accent-foreground',
				hovered || copied ? 'opacity-100' : 'opacity-0',
			)}
		>
			{/* Both stay rendered so the label keeps the position's width while they cross-fade */}
			<span
				className={cn('font-mono tabular-nums transition-opacity duration-150 [grid-area:1/1]', copied && 'opacity-0')}
			>
				{pointer && `X ${pointer.x.toFixed(2)} m  Y ${pointer.y.toFixed(2)} m`}
			</span>
			<span
				className={cn(
					'text-center font-medium transition-opacity duration-150 [grid-area:1/1]',
					!copied && 'opacity-0',
				)}
			>
				Copied
			</span>
		</span>
	);
}

/** Toggles the measuring tools, showing their keys */
function ToolButtons({ tool, onToggle }: { tool: MeasureTool | undefined; onToggle: (tool: MeasureTool) => void }) {
	return (
		<div className="flex gap-1">
			{tools.map((option) => (
				<ControlTooltip
					key={option.tool}
					label={option.hint}
					render={
						<Toggle
							className="h-5 gap-1 rounded-md border-0 px-1 text-xs sm:h-5 sm:text-xs"
							pressed={tool === option.tool}
							onPressedChange={() => onToggle(option.tool)}
						/>
					}
				>
					<>
						<Kbd className="h-4 min-w-4">{option.key}</Kbd>
						{option.label}
					</>
				</ControlTooltip>
			))}
		</div>
	);
}

export function Field({ bindings }: WidgetProps) {
	const time = useCursorTime();
	// Values at the cursor change as samples arrive
	useDataVersion();

	const { svgRef, zoom, active, transform, toContent, startPan, movePan, endPan, reset } = useFieldZoom(view);
	/** Field position under the pointer, the last one while it's not over the field so the readout can fade out */
	const [pointer, setPointer] = useState<FieldPoint>();
	const [hovered, setHovered] = useState(false);
	const [minimapLeft, setMinimapLeft] = useState(false);
	/** Shown in place of the cursor position for a moment after it's copied */
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
		return { x: content.x, y: -content.y };
	};
	/** Where a field point is in the field's box, as fractions of its width and height */
	const toFraction = ({ x, y }: FieldPoint) => ({
		x: (zoom.scale * x + zoom.x - view.x) / view.width,
		y: (zoom.scale * -y + zoom.y - view.y) / view.height,
	});
	const toPercent = (point: FieldPoint) => {
		const { x, y } = toFraction(point);
		return { left: `${x * 100}%`, top: `${y * 100}%` };
	};

	const valueOf = (entry: Entry | undefined) => (entry && time !== undefined ? entry.samples.valueAt(time) : undefined);
	const legend = bindings.map((binding, index): LegendItem => ({
		binding,
		color: seriesColor(index),
		dimmed: valueOf(binding.entry) === undefined,
	}));

	const label = measurement && measurementLabel(measurement);

	return (
		// The legend goes above the field, unless the widget is wider than the field and has room beside it
		<div className="h-full p-2 [container-type:size]">
			<div className="flex h-full flex-col gap-2 [@container(min-aspect-ratio:1.925)]:flex-row">
				{legend.length > 0 && (
					<div className="max-h-[33%] shrink-0 overflow-y-auto [@container(min-aspect-ratio:1.925)]:max-h-none [@container(min-aspect-ratio:1.925)]:max-w-[33%]">
						<Legend items={legend} vertical />
					</div>
				)}
				{/* Sized to the view's aspect ratio, so the image outside the view is cropped instead of filling the widget */}
				<div className="flex min-h-0 min-w-0 flex-1 items-center justify-center [container-type:size]">
					<div
						className="flex flex-col gap-1"
						style={{ width: `min(100cqw, (100cqh - ${readoutHeight}) * ${aspectRatio})` }}
					>
						<div
							className={cn(
								'relative touch-none overflow-hidden',
								tool === undefined ? zoom.scale > 1 && 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair',
							)}
							style={{ aspectRatio }}
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
								viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
								role="img"
								aria-label="Robot poses on the 2026 field"
							>
								<g transform={transform}>
									<FieldImage />
									<g transform="scale(1 -1)">
										{fieldDrawings(bindings, (binding) => valueOf(binding.entry))}
										{measurement && <MeasurementDrawing measurement={measurement} />}
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
							<Minimap zoom={zoom} visible={zoom.scale > 1 && active} left={minimapLeft} />
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
