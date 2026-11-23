// Following a robot with the field widget's 3D camera, see `Rig.follow`
import { type RefObject, useEffect, useRef, useState } from 'react';
import { Vector3 } from 'three';
import type { MenuEntry } from '@/components/app-context-menu';
import { getEntry } from '@/data/data-store';
import type { Value } from '@/data/samples';
import { useWidgetMenu } from '@/panes/widget-menu';
import { bindingLabel } from '@/widgets/bindings';
import {
	type DriverStation,
	driverEye,
	driverStationKey,
	driverStationLabel,
	driverStations,
	robotPosition,
} from '@/three/field-poses';
import type { Scene3dHandle } from '@/three/scene';
import type { FieldCoordinates } from '@/widgets/field/geometry';
import { isRobotBinding } from '@/widgets/field/robots';
import type { WidgetBinding, WidgetProps } from '@/widgets/widget-type';

/**
 * The robot's driver station at `time`, from NetworkTables' FMSInfo, which the Driver Station publishes with or without
 * a field
 */
function robotDriverStation(time: number | undefined): DriverStation | undefined {
	if (time === undefined) {
		return undefined;
	}
	for (const prefix of ['/NT:/FMSInfo/', '/FMSInfo/']) {
		const red = getEntry(`${prefix}IsRedAlliance`)?.samples.valueAt(time);
		const number = getEntry(`${prefix}StationNumber`)?.samples.valueAt(time);
		if (typeof red === 'boolean' && (number === 1 || number === 2 || number === 3)) {
			return { alliance: red ? 'red' : 'blue', number };
		}
	}
	return undefined;
}

/** The robot binding the camera follows, moving with it or from a driver station */
type Follow = { id: string; from?: DriverStation };

export function useRobotFollow(
	scene: RefObject<Scene3dHandle | null>,
	bindings: WidgetProps['bindings'],
	valueOf: (binding: WidgetBinding) => Value | undefined,
	coordinates: FieldCoordinates,
	cameraMatched: boolean,
	time: number | undefined,
) {
	const [follow, setFollow] = useState<Follow>();
	const stopFollowing = () => setFollow(undefined);
	const followed = bindings.find((binding) => binding.id === follow?.id && !binding.hidden && isRobotBinding(binding));
	// Following stops when the binding is hidden or removed, or the camera is matched to video.
	if (follow !== undefined && (followed === undefined || cameraMatched)) {
		setFollow(undefined);
	}
	const followedValue = followed && valueOf(followed);
	const [x, y, z] = followedValue === undefined ? [] : robotPosition(followedValue, coordinates).toArray();
	const from = follow?.from;
	const lastFollowed = useRef<Follow>(undefined);
	useEffect(() => {
		// Following another robot, or the same one another way, starts again from it, instead of moving the camera as far
		// as it is from the last one
		if (lastFollowed.current !== follow) {
			lastFollowed.current = follow;
			scene.current?.follow(undefined);
		}
		scene.current?.follow(x === undefined ? undefined : new Vector3(x, y, z), from && driverEye(from));
	}, [scene, lastFollowed, follow, from, x, y, z]);

	useWidgetMenu((binding): MenuEntry[] => {
		// Hidden robots can't be followed
		if (cameraMatched || !binding || binding.hidden || !isRobotBinding(binding)) {
			return [];
		}
		const current = follow?.id === binding.id ? (follow.from ? driverStationKey(follow.from) : 'robot') : undefined;
		const followFrom = (station?: DriverStation) => setFollow({ id: binding.id, ...(station && { from: station }) });
		const robotStation = robotDriverStation(time);
		const robotKey = robotStation && driverStationKey(robotStation);
		return [
			'separator',
			...(current === undefined ? [] : [{ label: 'Stop following', onSelect: stopFollowing }]),
			{
				label: 'Follow',
				items: [
					{ label: 'Follow', checked: current === 'robot', closeOnClick: true, onCheckedChange: () => followFrom() },
					'separator',
					...driverStations.map((station) => ({
						label: `From ${driverStationLabel(station)}${driverStationKey(station) === robotKey ? ' (robot’s)' : ''}`,
						checked: current === driverStationKey(station),
						closeOnClick: true,
						onCheckedChange: () => followFrom(station),
					})),
				],
			},
		];
	});
	if (followed === undefined) {
		return { stopFollowing };
	}
	return {
		following: from ? ('driver-station' as const) : ('robot' as const),
		/** Names what the camera follows, for the widget to show */
		label: `Following ${bindingLabel(followed)}${from ? ` from ${driverStationLabel(from)}` : ''}`,
		stopFollowing,
	};
}
