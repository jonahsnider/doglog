// The field widget in 3D, see `@/three/field-scene`
import HouseIcon from 'lucide-react/icons/house';
import XIcon from 'lucide-react/icons/x';
import { Suspense, useCallback, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useDataVersion } from '@/data/data-store';
import { cn } from '@/lib/utils';
import { useWidgetMenu } from '@/panes/widget-menu';
import { FieldDrawings, type FieldDrawingProps, type RobotDrawing } from '@/three/field-drawings';
import { FieldImageFloor, FieldModel, FloorPointer, type FloorProjection, FloorSketch } from '@/three/field-scene';
import { useRobotProjects } from '@/three/robot-projects';
import { Scene3d, type Scene3dHandle } from '@/three/scene';
import { useCursorTime } from '@/timeline/timeline';
import { setCameraMatch, useCameraMatch } from '@/widgets/field/camera-match';
import { type FieldCoordinates, type FieldPoint, fieldLength, fieldWidth, toBlueWall } from '@/widgets/field/geometry';
import { fieldLegendItems } from '@/widgets/field/legend-items';
import { CursorPosition, hiddenWhileIdle, ToolButtons } from '@/widgets/field/readout';
import { useCopyPosition } from '@/widgets/field/copy-position';
import { fieldRobot, isRobotBinding, missingRobotNotes } from '@/widgets/field/robots';
import { useRobotFollow } from '@/widgets/field/robot-follow';
import { attachedRoles } from '@/widgets/field/roles';
import { useFieldCameras } from '@/widgets/field/use-field-cameras';
import { useFloorPencil } from '@/widgets/field/use-floor-pencil';
import { widgetOptions } from '@/widgets/widget-info';
import { FollowContext } from '@/widgets/legend/follow-context';
import { Legend } from '@/widgets/legend/legend';
import { mechanismPlane } from '@/widgets/robot/roles';
import { SceneControls } from '@/widgets/scene-controls';
import { useMechanisms } from '@/widgets/use-mechanisms';
import { useSceneControls } from '@/widgets/use-scene-controls';
import { ViewToggle } from '@/widgets/view-toggle';
import type { WidgetBinding, WidgetProps } from '@/widgets/widget-type';

/** Where the default view looks from for each orientation, the 2D view's bottom edge, in radians from +X */
const azimuths: Readonly<Record<string, number>> = {
	'blue-left': -Math.PI / 2,
	'red-left': Math.PI / 2,
	'blue-top': 0,
	'red-top': Math.PI,
};

const defaultFov = Number(widgetOptions.field.fov.default);

const isAttached = (binding: WidgetBinding) => binding.role !== undefined && attachedRoles.has(binding.role.id);

export function Field3d({ bindings, options, setOption, paneId, layout }: WidgetProps) {
	const time = useCursorTime();
	// Values at the cursor change as samples arrive
	useDataVersion();
	const scene = useRef<Scene3dHandle>(null);
	const sceneElement = useRef<HTMLDivElement>(null);
	const field = useMemo(
		() => ({
			length: fieldLength,
			width: fieldWidth,
			azimuth: azimuths[options['orientation'] ?? ''] ?? -Math.PI / 2,
			fov: Number(options['fov']) || defaultFov,
		}),
		[options],
	);
	const coordinates: FieldCoordinates = options['coordinates'] === 'center' ? 'center' : 'blue-wall';
	const mechanisms = useMechanisms(bindings);
	const projects = useRobotProjects();
	const cameraMatch = useCameraMatch(paneId);
	const exitCameraMatch = () => setCameraMatch(paneId, undefined);
	const cameraMatched = cameraMatch !== undefined;
	const [ResetIcon, resetLabel] = cameraMatched ? [XIcon, 'Exit camera match'] : [HouseIcon, 'Reset view'];
	const showControls = bindings.length === 0 && !cameraMatched;
	const controls = useSceneControls(showControls);

	/** The robot under the pointer, so its binding can be removed by middle-clicking it or from the context menu */
	const [pointed, setPointed] = useState<string>();
	const [pointer, setPointer] = useState<FieldPoint>();
	const [overField, setOverField] = useState(false);
	const { copied, copyMenuItems } = useCopyPosition(pointer, overField);
	const movePointer = useCallback(
		(point: FieldPoint | undefined) => {
			// The last position stays shown while it fades out
			if (point) {
				setPointer(toBlueWall(point, coordinates));
			}
			setOverField(point !== undefined);
		},
		[coordinates],
	);
	const projectFloor = useRef<FloorProjection>(null);
	const pencil = useFloorPencil(projectFloor, movePointer, controls.handlers.onPointerDownCapture);

	const valueOf = (binding: WidgetBinding) =>
		binding.hidden || binding.entry === undefined || time === undefined
			? undefined
			: binding.entry.samples.valueAt(time);

	// Parts and mechanisms are drawn on the robots they're connected to, or on the only robot
	const robots = bindings.filter((binding) => binding.role?.id === 'robot');
	const onlyRobot = robots.length === 1 ? robots[0] : undefined;
	const robotDrawing = (robot: WidgetBinding): RobotDrawing => {
		const attached = bindings.filter(
			(binding) =>
				isAttached(binding) &&
				!binding.hidden &&
				(binding.sources.length === 0 ? robot === onlyRobot : binding.sources.some(({ id }) => id === robot.id)),
		);
		const parts = attached.find((binding) => binding.role?.id === 'parts');
		return {
			name: fieldRobot(robot, bindings),
			parts: parts && valueOf(parts),
			mechanisms: attached.flatMap((binding) => {
				const mechanism = binding.entry?.kind === 'mechanism2d' ? mechanisms.get(binding.name) : undefined;
				return mechanism ? [{ id: binding.id, mechanism, plane: mechanismPlane(binding) }] : [];
			}),
		};
	};

	const notes = missingRobotNotes(bindings, projects);
	for (const binding of bindings) {
		if (isAttached(binding) && binding.entry !== undefined && binding.sources.length === 0 && !onlyRobot) {
			notes.set(binding.id, 'Connect to a robot');
		}
	}
	const {
		controls: followControls,
		legend: followedInLegend,
		following,
		label: followLabel,
		stopFollowing,
		followMenuItems,
	} = useRobotFollow(scene, bindings, valueOf, coordinates, cameraMatched, time);
	useWidgetMenu((binding, target, point) => ({
		contextual: [
			...copyMenuItems(sceneElement.current, target, point, (origin) => {
				const position = projectFloor.current?.()(origin);
				return position && toBlueWall(position, coordinates);
			}),
			...followMenuItems(binding),
		],
	}));
	const { legend, cameraImages } = useFieldCameras({
		items: fieldLegendItems(bindings, { view: '3d', time, mechanisms, notes, followed: followedInLegend }),
		paneId,
		layout,
		hasPose: (binding) => valueOf(binding) !== undefined,
	});

	const drawings = bindings.flatMap((binding, index): FieldDrawingProps[] => {
		const value = valueOf(binding);
		const image = cameraImages.get(binding.id);
		if (value === undefined || isAttached(binding) || (binding.role?.id === 'camera' && image === undefined)) {
			return [];
		}
		const sources = binding.sources.flatMap((source) => {
			const sourceValue = valueOf(source);
			return sourceValue === undefined ? [] : [{ binding: source, value: sourceValue }];
		});
		return [
			{
				binding,
				value,
				sources,
				bindingIndex: index,
				...(isRobotBinding(binding) && { robot: robotDrawing(binding) }),
				...(image && { image }),
				onPoint: (id, on) => setPointed((current) => (on ? id : current === id ? undefined : current)),
			},
		];
	});

	return (
		<div className="group/field h-full p-2">
			<div className="flex h-full flex-col gap-1">
				{/* Marks the robot under the pointer, see `bindingIdAt()` in the pane */}
				<div
					className={cn('relative min-h-0 flex-1', cameraMatch && 'grid place-items-center [container-type:size]')}
					data-binding-id={pointed}
				>
					<div
						ref={sceneElement}
						className="size-full data-[tool=pencil]:cursor-crosshair"
						data-tool={pencil.tool}
						{...controls.handlers}
						{...pencil.handlers}
						style={
							cameraMatch && {
								width: `min(100cqw, calc(100cqh * ${cameraMatch.aspect}))`,
								height: `min(100cqh, calc(100cqw / ${cameraMatch.aspect}))`,
							}
						}
					>
						<Scene3d
							ref={scene}
							field={field}
							label="Robot poses on the 2026 field"
							following={following}
							onStopFollowing={stopFollowing}
							viewKey={paneId}
							cameraMatch={cameraMatch}
							onExitCameraMatch={exitCameraMatch}
						>
							<Suspense fallback={<FieldImageFloor />}>
								<FieldModel
									stagedGamePieces={options['stagedGamePieces'] !== 'hidden'}
									seeThroughBorder={options['fieldBorder'] === 'see-through'}
								/>
							</Suspense>
							<FieldDrawings coordinates={coordinates} drawings={drawings} />
							<FloorSketch points={pencil.points} />
							<FloorPointer ref={projectFloor} onMove={movePointer} />
						</Scene3d>
					</div>
					<div className="pointer-events-none absolute inset-0 flex flex-col">
						{legend.length > 0 && (
							<div className="pointer-events-auto mt-1.5 ms-1.5 max-h-1/2 w-fit max-w-1/2 shrink-0 overflow-y-auto rounded-md bg-background px-1.5">
								<FollowContext value={followControls}>
									<Legend items={legend} vertical />
								</FollowContext>
							</div>
						)}
						<SceneControls view="3d" visible={controls.visible} disabled={!showControls} />
					</div>
					{followLabel !== undefined && (
						<div className="absolute top-1.5 right-1.5 flex max-w-1/2 items-center gap-1 rounded-md bg-background ps-1.5 text-xs capture:invisible">
							<span className="truncate">{followLabel}</span>
							<Button variant="ghost" size="icon-xs" aria-label="Stop following" onClick={stopFollowing}>
								<XIcon />
							</Button>
						</div>
					)}
				</div>
				<div className="flex h-5 items-center justify-between gap-2 text-muted-foreground text-xs capture:invisible">
					<CursorPosition pointer={pointer} hovered={overField} copied={copied} />
					<div className="flex items-center gap-2">
						<ToolButtons tool={pencil.tool} onToggle={pencil.toggle} measure={false} />
						<div className={cn('flex items-center gap-2', !cameraMatch && hiddenWhileIdle)}>
							<Button
								variant="ghost"
								size="xs"
								className="h-5 sm:h-5"
								onClick={() => {
									controls.input();
									stopFollowing();
									scene.current?.reset();
								}}
							>
								<ResetIcon />
								{resetLabel}
							</Button>
							<ViewToggle compact view="3d" onChange={(view) => setOption('view', view)} />
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
