import { spacingVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import { useHotkey } from '@tanstack/react-hotkeys';
import { lazy, type PointerEvent, Suspense, useEffect, useId, useRef, useState } from 'react';
import { type Entry, useDataVersion } from '@/data/data-store';
import { useCursorTime } from '@/timeline/timeline';
import { setCameraMatch } from '@/widgets/field/camera-match';
import {
	type FieldCoordinates,
	type FieldPoint,
	type Measurement,
	coordinatesTransform,
	fieldLayout,
	measurementLabel,
	orientedField,
	snapTo45,
	toBlueWall,
} from '@/widgets/field/geometry';
import { FieldImage, Minimap } from '@/widgets/field/image';
import { loadField3d, preloadField3d } from '@/widgets/field/load-3d';
import { MeasurementDrawing, MeasurementLabel, PencilDrawing } from '@/widgets/field/measure';
import { type FieldTool, usePencil } from '@/widgets/field/pencil';
import { FieldLegend } from '@/widgets/field/field-legend';
import { fieldLegendItems } from '@/widgets/field/legend-items';
import { fieldMarker } from './markers.stylex';
import { IdleHidden, Readout } from '@/widgets/field/readout';
import { useCopyPosition2d } from '@/widgets/field/copy-position';
import { fieldDrawings } from '@/widgets/field/roles';
import { useFieldBox } from '@/widgets/field/use-field-box';
import { useFieldZoom } from '@/widgets/field/zoom';
import { SceneControls } from '@/widgets/scene-controls';
import { useMechanisms } from '@/widgets/use-mechanisms';
import { useSceneControls } from '@/widgets/use-scene-controls';
import { ViewToggle } from '@/widgets/view-toggle';
import type { WidgetProps } from '@/widgets/widget-type';

const styles = stylex.create({
	root: { height: '100%', padding: spacingVars['--spacing-2'], containerType: 'size' },
	landscape: { containerName: 'field-landscape' },
	portrait: { containerName: 'field-portrait' },
	column: { display: 'flex', height: '100%', flexDirection: 'column', gap: spacingVars['--spacing-1'] },
	stage: { position: 'relative', minHeight: 0, flex: 1 },
	box: { position: 'absolute', inset: 0, overflow: 'hidden', touchAction: 'none' },
	pannable: { cursor: { default: 'grab', ':active': 'grabbing' } },
	measuring: { cursor: 'crosshair' },
	svg: { display: 'block', width: '100%', height: '100%' },
	area: { pointerEvents: 'none', position: 'absolute' },
	controls: { position: 'absolute', inset: 0 },
});

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

function Field2d({ bindings, options, setOption, paneId }: WidgetProps) {
	useEffect(() => setCameraMatch(paneId, undefined), [paneId]);
	// three.js and the field's model load in the background, so switching to 3D doesn't wait for them
	useEffect(() => {
		const timeout = setTimeout(preloadField3d, preloadDelay);
		return () => clearTimeout(timeout);
	}, []);
	const coordinates: FieldCoordinates = options['coordinates'] === 'center' ? 'center' : 'blue-wall';
	const field = orientedField(options['orientation']);
	const { bounds, vertical } = field;
	const time = useCursorTime();
	// Values at the cursor change as samples arrive
	useDataVersion();

	const { box, boxRef, legendRef } = useFieldBox();
	const { view, area } = fieldLayout(bounds, box);
	const clipId = useId();
	const { svgRef, zoom, active, transform, contentPointAt, startPan, movePan, endPan, reset } = useFieldZoom(
		bounds,
		view,
	);
	/** Field position under the pointer, the last one while it's not over the field so the readout can fade out */
	const [pointer, setPointer] = useState<FieldPoint>();
	const [hovered, setHovered] = useState(false);
	const [minimapLeft, setMinimapLeft] = useState(false);
	const { copied, fieldRef } = useCopyPosition2d(pointer, hovered, boxRef, field, coordinates);
	const unbound = bindings.length === 0;
	const controls = useSceneControls(unbound);
	const [tool, setTool] = useState<FieldTool>();
	const [measurement, setMeasurement] = useState<Measurement>();
	const measuring = useRef(false);
	const pencil = usePencil();

	const selectTool = (next: FieldTool | undefined) => {
		setTool(next);
		setMeasurement(undefined);
		measuring.current = false;
		pencil.clear();
		endPan();
	};
	const toggleTool = (next: FieldTool) => selectTool(tool === next ? undefined : next);
	// Every field widget registers these, but only the hovered one is enabled
	const whileHovered = { enabled: hovered, conflictBehavior: 'allow' } as const;
	useHotkey('M', () => toggleTool('distance'), whileHovered);
	useHotkey('A', () => toggleTool('angle'), whileHovered);
	useHotkey('P', () => toggleTool('pencil'), whileHovered);
	useHotkey('Escape', () => selectTool(undefined), { ...whileHovered, enabled: hovered && tool !== undefined });

	const projectPointer = () => {
		const toContent = contentPointAt();
		return (event: Pick<PointerEvent, 'clientX' | 'clientY'>) => field.fromSvg(toContent(event));
	};
	const cancelDrag = (event: PointerEvent) => {
		endPan();
		pencil.cancel(event);
		if (measuring.current) {
			measuring.current = false;
			setMeasurement(undefined);
		}
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
		<div {...stylex.props(fieldMarker, styles.root, vertical ? styles.portrait : styles.landscape)}>
			<div {...stylex.props(styles.column)}>
				<div {...stylex.props(styles.stage)}>
					<div
						ref={boxRef}
						{...stylex.props(styles.box, tool === undefined ? zoom.scale > 1 && styles.pannable : styles.measuring)}
						{...controls.handlers}
						onPointerDown={(event) => {
							if (event.button !== 0) {
								return;
							}
							if (tool === undefined) {
								startPan(event);
								return;
							}
							const point = projectPointer()(event);
							if (tool === 'pencil') {
								pencil.start(event, point);
								return;
							}
							event.currentTarget.setPointerCapture(event.pointerId);
							measuring.current = true;
							const position = toBlueWall(point, coordinates);
							setMeasurement({ tool, from: position, to: position });
						}}
						onPointerMove={(event) => {
							const pointAt = projectPointer();
							const fieldPoint = pointAt(event);
							const point = toBlueWall(fieldPoint, coordinates);
							setPointer(point);
							setHovered(true);
							// The minimap only switches sides past the middle, so it doesn't flicker while the pointer is near it
							const { x } = toFraction(point);
							setMinimapLeft((current) => (x > 0.6 ? true : x < 0.4 ? false : current));
							if (pencil.isDrawing(event)) {
								pencil.move(event, pointAt, fieldPoint);
							} else if (measuring.current) {
								setMeasurement(
									(current) => current && { ...current, to: event.shiftKey ? snapTo45(current.from, point) : point },
								);
							} else {
								movePan(event);
							}
						}}
						onPointerUp={(event) => {
							endPan();
							if (pencil.isDrawing(event)) {
								pencil.finish(event, projectPointer()(event));
							}
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
						onPointerCancel={cancelDrag}
						onLostPointerCapture={cancelDrag}
						onPointerEnter={() => setHovered(true)}
						onPointerLeave={() => setHovered(false)}
						onDoubleClick={() => {
							if (tool === undefined) {
								reset();
							}
						}}
					>
						<svg
							ref={svgRef}
							{...stylex.props(styles.svg)}
							viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
							role="img"
							aria-label="Robot poses on the 2026 field"
						>
							<clipPath id={clipId}>
								<rect {...bounds} />
							</clipPath>
							{/* The field is cut off at the view's margin, so the driver stations don't show in the spare room */}
							<g ref={fieldRef} transform={transform} clipPath={`url(#${clipId})`}>
								<g transform={field.transform}>
									<FieldImage />
									<g transform="scale(1 -1)">
										<g transform={coordinatesTransform(coordinates)}>
											{fieldDrawings(bindings, (binding) => valueOf(binding.entry))}
											{measurement && <MeasurementDrawing measurement={measurement} />}
										</g>
										<PencilDrawing points={pencil.points} />
									</g>
								</g>
							</g>
						</svg>
						{label && <MeasurementLabel text={label.text} position={toPercent(label.at)} />}
						<div {...stylex.props(styles.area)} style={area}>
							<Minimap shown={shown} visible={zoom.scale > 1 && active} left={minimapLeft} field={field} />
						</div>
					</div>
					<FieldLegend ref={legendRef} items={legend} isUnderZoom={underLegend} />
					{unbound && (
						<SceneControls view="2d" visible={controls.visible} className={stylex.props(styles.controls).className} />
					)}
				</div>
				<Readout pointer={pointer} hovered={hovered} copied={copied} tool={tool} onToggle={toggleTool}>
					<IdleHidden>
						<ViewToggle view="2d" onChange={(next) => setOption('view', next)} />
					</IdleHidden>
				</Readout>
			</div>
		</div>
	);
}
