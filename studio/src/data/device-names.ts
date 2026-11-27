// Renames the devices in HOOT logs, which only name them by model and ID, with the names robot projects give them
import { createAtom } from '@tanstack/store';
import type { DataSet } from '@/data/data-set';
import type { Entry } from '@/data/data-store';
import { FieldEntry } from '@/data/field-entry';
import { sourceState } from '@/data/source-store';
import { loadRobotDevices, type RobotDevices, robotDevicesStore } from '@/three/robot-devices';

/**
 * A device's entry in a HOOT log: the entry the HOOT file is embedded in (empty for a HOOT file), the CAN bus, the
 * device's model and ID, and the signal, ex. `/Phoenix6/rio/TalonFX-11/Velocity`
 */
const devicePattern = /^(.*?)\/Phoenix6\/([^/]+)\/([A-Za-z0-9]+-\d+)(\/.+)$/u;

/** A renamed device's group in the entry browser, see `renamedDevicesStore` */
export type RenamedDevice = { readonly id: string; readonly robot: string };

/** The groups of renamed devices in every log, by path, ex. `/Phoenix6/rio/Shooter/Left` */
export const renamedDevicesStore = createAtom<ReadonlyMap<string, RenamedDevice>>(new Map());

function nameOf({ devices }: RobotDevices, bus: string, id: string): string | undefined {
	return Object.hasOwn(devices, bus) && Object.hasOwn(devices[bus]!, id) ? devices[bus]![id] : undefined;
}

/** The robot that names the most of a log's devices, by bus, preferring the one added last when they tie */
function closestRobot(
	devices: ReadonlyMap<string, ReadonlySet<string>>,
	robots: readonly RobotDevices[],
): RobotDevices | undefined {
	let closest: RobotDevices | undefined;
	let most = 0;
	for (const robot of robots) {
		let count = 0;
		for (const [bus, ids] of devices) {
			for (const id of ids) {
				if (nameOf(robot, bus, id) !== undefined) {
					count++;
				}
			}
		}
		if (count > 0 && count >= most) {
			closest = robot;
			most = count;
		}
	}
	return closest;
}

type DeviceEntry = { entry: Entry; original: string; bus: string; id: string; signal: string };

/**
 * Rename the devices in each HOOT log in `data`, including HOOT files embedded in it, with the names of the closest
 * robot, see `closestRobot()`. Devices the robot doesn't name get their names from the log back.
 */
export function renameDevices(data: DataSet, robots: readonly RobotDevices[]): void {
	const logs = new Map<string, DeviceEntry[]>();
	for (const entry of data.entries.values()) {
		const original = entry.device?.original ?? entry.name;
		const match = entry instanceof FieldEntry ? null : devicePattern.exec(original);
		if (match) {
			const [, log = '', bus = '', id = '', signal = ''] = match;
			let devices = logs.get(log);
			if (!devices) {
				devices = [];
				logs.set(log, devices);
			}
			devices.push({ entry, original, bus, id, signal });
		}
	}

	const names = new Map<Entry, string>();
	for (const [log, devices] of logs) {
		const buses = new Map<string, Set<string>>();
		for (const { bus, id } of devices) {
			buses.set(bus, (buses.get(bus) ?? new Set()).add(id));
		}
		const robot = closestRobot(buses, robots);
		for (const { entry, original, bus, id, signal } of devices) {
			const name = robot && nameOf(robot, bus, id);
			entry.device = name === undefined ? undefined : { original, id, robot: robot!.robot };
			const renamed = name === undefined ? original : `${log}/Phoenix6/${bus}/${name}${signal}`;
			if (renamed !== entry.name) {
				names.set(entry, renamed);
			}
		}
	}
	data.renameEntries(names);
}

function showRenamedDevices(): void {
	const groups = new Map<string, RenamedDevice>();
	for (const data of sourceState.logData.values()) {
		for (const { name, device } of data.entries.values()) {
			if (device) {
				// The entry's name without the signal at its end
				const signal = devicePattern.exec(device.original)![4]!;
				groups.set(name.slice(0, -signal.length), { id: device.id, robot: device.robot });
			}
		}
	}
	renamedDevicesStore.set(groups);
}

let started = false;

/** Rename every log's devices whenever the robots' device names change, and check for changes when the window is focused */
function start(): void {
	if (started) {
		return;
	}
	started = true;
	robotDevicesStore.subscribe(() => {
		const robots = robotDevicesStore.get();
		if (robots !== undefined) {
			for (const data of sourceState.logData.values()) {
				renameDevices(data, robots);
			}
			showRenamedDevices();
		}
	});
	void loadRobotDevices();
	void import('@/three/robot-projects').then(({ refreshRobotDevices }) => {
		void refreshRobotDevices();
		window.addEventListener('focus', () => void refreshRobotDevices());
		return undefined;
	});
}

/** Rename the devices in a log's HOOT files that just loaded, see `renameDevices()` */
export function nameDevices(data: DataSet): void {
	start();
	const robots = robotDevicesStore.get();
	if (robots !== undefined) {
		renameDevices(data, robots);
		showRenamedDevices();
	}
}
