// The field widget in 3D, see `@/three/field-scene`
import HouseIcon from 'lucide-react/icons/house';
import XIcon from 'lucide-react/icons/x';
import { type RefObject, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Vector3 } from 'three';
import type { MenuEntry } from '@/components/app-context-menu';
import { Button } from '@/components/ui/button';
import { useDataVersion } from '@/data/data-store';
import type { Value } from '@/data/samples';
import { cn } from '@/lib/utils';
import { useWidgetMenu } from '@/panes/widget-menu';
import { FieldDrawings, type FieldDrawingProps, type RobotDrawing } from '@/three/field-drawings';
import { robotPosition } from '@/three/field-poses';
import { FieldImageFloor, FieldModel, FloorPointer } from '@/three/field-scene';
import { useRobotProjects } from '@/three/robot-projects';
import { Scene3d, type Scene3dHandle } from '@/three/scene';
import { useCursorTime } from '@/timeline/timeline';
import { bindingLabel } from '@/widgets/bindings';
import { setCameraMatch, useCameraMatch } from '@/widgets/field/camera-match';
import { type FieldCoordinates, type FieldPoint, fieldLength, fieldWidth } from '@/widgets/field/geometry';
import { fieldLegendItems } from '@/widgets/field/legend-items';
import { CursorPosition, hiddenWhileIdle } from '@/widgets/field/readout';
import { useCopyPosition } from '@/widgets/field/copy-position';
import { fieldRobot, isRobotBinding, missingRobotNotes } from '@/widgets/field/robots';
import { roles3d } from '@/widgets/field/roles';
import { Legend } from '@/widgets/legend/legend';
import { mechanismPlane } from '@/widgets/robot/roles';
import { bindingColor } from '@/widgets/series-color';
import { useMechanisms } from '@/widgets/use-mechanisms';
import { ViewToggle } from '@/widgets/view-toggle';
import type { WidgetBinding, WidgetProps } from '@/widgets/widget-type';

/** Where the default view looks from for each orientation, the 2D view's bottom edge, in radians from +X */
const azimuths: Readonly<Record<string, number>> = {
	'blue-left': -Math.PI / 2,
	'red-left': Math.PI / 2,
	'blue-top': 0,
	'red-top': Math.PI,
};

const isAttached = (binding: WidgetBinding) => binding.role !== undefined && roles3d.has(binding.role.id);

function useRobotFollow(
	scene: RefObject<Scene3dHandle | null>,
	bindings: WidgetProps['bindings'],
	valueOf: (binding: WidgetBinding) => Value | undefined,
	coordinates: FieldCoordinates,
	cameraMatched: boolean,
) {
	const [followedId, setFollowedId] = useState<string>();
	const stopFollowing = () => setFollowedId(undefined);
	const followed = bindings.find((binding) => binding.id === followedId && !binding.hidden && isRobotBinding(binding));
	// Following stops when the binding is hidden or removed, or the camera is matched to video.
	if (followedId !== undefined && (followed === undefined || cameraMatched)) {
		setFollowedId(undefined);
	}
	const followedValue = followed && valueOf(followed);
	const [x, y, z] = followedValue === undefined ? [] : robotPosition(followedValue, coordinates).toArray();
	const lastFollowed = useRef<string>(undefined);
	useEffect(() => {
		// Following another robot starts again from it, instead of moving the camera as far as it is from the last one
		if (lastFollowed.current !== followedId) {
			lastFollowed.current = followedId;
			scene.current?.follow(undefined);
		}
		scene.current?.follow(x === undefined ? undefined : new Vector3(x, y, z));
	}, [scene, followedId, x, y, z]);

	useWidgetMenu((binding): MenuEntry[] =>
		!cameraMatched && binding && isRobotBinding(binding)
			? [
					'separator',
					binding.id === followedId
						? { label: 'Stop following', onSelect: stopFollowing }
						: { label: 'Follow', disabled: binding.hidden, onSelect: () => setFollowedId(binding.id) },
				]
			: [],
	);
	return { followed, stopFollowing };
}

export function Field3d({ bindings, options, setOption, paneId }: WidgetProps) {
	const time = useCursorTime();
	// Values at the cursor change as samples arrive
	useDataVersion();
	const scene = useRef<Scene3dHandle>(null);
	const field = useMemo(
		() => ({ length: fieldLength, width: fieldWidth, azimuth: azimuths[options['orientation'] ?? ''] ?? -Math.PI / 2 }),
		[options],
	);
	const coordinates: FieldCoordinates = options['coordinates'] === 'center' ? 'center' : 'blue-wall';
	const mechanisms = useMechanisms(bindings);
	const projects = useRobotProjects();
	const cameraMatch = useCameraMatch(paneId);
	const exitCameraMatch = () => setCameraMatch(paneId, undefined);

	/** The robot under the pointer, so its binding can be removed by middle-clicking it or from the context menu */
	const [pointed, setPointed] = useState<string>();
	const [pointer, setPointer] = useState<FieldPoint>();
	const [overField, setOverField] = useState(false);
	const copied = useCopyPosition(pointer, overField);
	const movePointer = useCallback((point: FieldPoint | undefined) => {
		// The last position stays shown while it fades out
		if (point) {
			setPointer(point);
		}
		setOverField(point !== undefined);
	}, []);

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
	const legend = fieldLegendItems(bindings, { view: '3d', time, mechanisms, notes });

	const { followed, stopFollowing } = useRobotFollow(scene, bindings, valueOf, coordinates, cameraMatch !== undefined);

	const drawings = bindings.flatMap((binding, index): FieldDrawingProps[] => {
		const value = valueOf(binding);
		if (value === undefined || isAttached(binding)) {
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
				cssColor: bindingColor(binding, index),
				...(isRobotBinding(binding) && { robot: robotDrawing(binding) }),
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
						className="size-full"
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
							following={followed !== undefined}
							onStopFollowing={stopFollowing}
							viewKey={paneId}
							cameraMatch={cameraMatch}
							onExitCameraMatch={exitCameraMatch}
						>
							<Suspense fallback={<FieldImageFloor />}>
								<FieldModel stagedGamePieces={options['stagedGamePieces'] !== 'hidden'} />
							</Suspense>
							<FieldDrawings coordinates={coordinates} drawings={drawings} />
							<FloorPointer coordinates={coordinates} onMove={movePointer} />
						</Scene3d>
					</div>
					{legend.length > 0 && (
						// Over the scene's top-left corner, so the scene fills the widget
						<div className="absolute top-1.5 left-1.5 max-h-1/2 w-fit max-w-1/2 overflow-y-auto rounded-md bg-background px-1.5">
							<Legend items={legend} vertical />
						</div>
					)}
					{followed && (
						<div className="absolute top-1.5 right-1.5 flex max-w-1/2 items-center gap-1 rounded-md bg-background ps-1.5 text-xs capture:invisible">
							<span className="truncate">Following {bindingLabel(followed)}</span>
							<Button variant="ghost" size="icon-xs" aria-label="Stop following" onClick={stopFollowing}>
								<XIcon />
							</Button>
						</div>
					)}
				</div>
				<div className="flex h-5 items-center justify-between gap-2 text-muted-foreground text-xs capture:invisible">
					<CursorPosition pointer={pointer} hovered={overField} copied={copied} />
					<div className={cn('flex items-center gap-2', !cameraMatch && hiddenWhileIdle)}>
						<Button
							variant="ghost"
							size="xs"
							className="h-5 sm:h-5"
							onClick={() => {
								stopFollowing();
								scene.current?.reset();
							}}
						>
							{cameraMatch ? <XIcon /> : <HouseIcon />}
							{cameraMatch ? 'Exit camera match' : 'Reset view'}
						</Button>
						<ViewToggle compact view="3d" onChange={(view) => setOption('view', view)} />
					</div>
				</div>
			</div>
		</div>
	);
}
