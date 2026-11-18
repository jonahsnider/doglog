import { NetworkTables } from '@ntcore-ts/client';
import { type RobotEnabledWatcher, trackEnabled } from '@/sync/backend';

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

	// WPILib 2027 and later, a little-endian 64-bit `ControlWord` struct with the enabled flag in bit 58
	const controlWordTopic = nt.getRawTopic('/DriverStation/ControlWord');
	const controlWordSubscription = controlWordTopic.subscribe(
		(controlWord) => {
			if (controlWord !== null) {
				enabled.set(controlWord.length === 8 && (controlWord[7]! & 0x04) !== 0);
			}
		},
		// The value is already known when the live connection to the same robot has it
		{ immediateNotify: true },
	);
	// WPILib 2026 and earlier, published whether or not the robot is on a field, with the enabled flag in bit 0
	const fmsControlDataTopic = nt.getIntegerTopic('/FMSInfo/FMSControlData');
	const fmsControlDataSubscription = fmsControlDataTopic.subscribe(
		(controlWord) => {
			if (controlWord !== null) {
				enabled.set((controlWord & 0x01) !== 0);
			}
		},
		{ immediateNotify: true },
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
			controlWordTopic.unsubscribe(controlWordSubscription, true);
			fmsControlDataTopic.unsubscribe(fmsControlDataSubscription, true);
			nt.release();
		},
	};
}
