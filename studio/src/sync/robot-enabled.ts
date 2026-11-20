import type { NtClient } from '@/nt/client';
import { type RobotEnabledWatcher, trackEnabled } from '@/sync/backend';

/** WPILib 2027 and later, a little-endian 64-bit `ControlWord` struct with the enabled flag in bit 58 */
const controlWordTopic = '/DriverStation/ControlWord';
/** WPILib 2026 and earlier, published whether or not the robot is on a field, with the enabled flag in bit 0 */
const fmsControlDataTopic = '/FMSInfo/FMSControlData';

/**
 * Follow whether the robot is enabled through `nt`, from the control word WPILib publishes to NetworkTables.
 * A robot without robot code running can't be enabled, so it counts as disabled while NetworkTables isn't connected.
 * `onChange` is called whenever `pausedFor()` may have changed. Stopping it closes `nt`.
 */
export function watchRobotEnabled(nt: NtClient, onChange: () => void): RobotEnabledWatcher {
	const enabled = trackEnabled(onChange);

	// The values are already known when another window or the live session is connected to the same robot
	nt.subscribe(
		controlWordTopic,
		{},
		{
			value: (name, _type, controlWord) => {
				if (name === controlWordTopic) {
					enabled.set(controlWord instanceof Uint8Array && controlWord.length === 8 && (controlWord[7]! & 0x04) !== 0);
				}
			},
		},
	);
	nt.subscribe(
		fmsControlDataTopic,
		{},
		{
			value: (name, _type, controlWord) => {
				if (name === fmsControlDataTopic && typeof controlWord === 'number') {
					enabled.set((controlWord & 0x01) !== 0);
				}
			},
		},
	);
	nt.onConnectedChange((connected) => {
		if (!connected) {
			enabled.set(false);
		}
	});

	return { pausedFor: enabled.pausedFor, stop: () => nt.close() };
}
