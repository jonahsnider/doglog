import { NetworkTables } from '@ntcore-ts/client';
import { type RobotEnabledWatcher, trackEnabled } from '@/sync/backend';

/** Bit of the Driver Station control word that's set while the robot is enabled */
const enabledBit = 0x01;

/**
 * Follow whether the robot at `host` is enabled, from the control word WPILib publishes to NetworkTables.
 * A robot without robot code running can't be enabled, so it counts as disabled while NetworkTables isn't connected.
 * `onChange` is called whenever `pausedFor()` may have changed.
 */
export function watchRobotEnabled(host: string, onChange: () => void): RobotEnabledWatcher {
	// Shared with a live connection to the same robot
	const nt = NetworkTables.getInstanceByURI(host);
	nt.retain();
	const enabled = trackEnabled(onChange);

	const topic = nt.getIntegerTopic('/FMSInfo/FMSControlData');
	const subscription = topic.subscribe((controlWord) =>
		enabled.set(controlWord !== null && (controlWord & enabledBit) !== 0),
	);
	const removeConnectionListener = nt.addRobotConnectionListener((connected) => {
		if (!connected) {
			enabled.set(false);
		}
	});

	return {
		pausedFor: enabled.pausedFor,
		stop: () => {
			removeConnectionListener();
			topic.unsubscribe(subscription, true);
			nt.release();
		},
	};
}
