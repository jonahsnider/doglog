// Apart from `@/timeline/events` so log workers can read Driver Station data too

/**
 * WPILib's and AdvantageKit's Driver Station entries: whether the robot is enabled, in autonomous, in test, and emergency
 * stopped, and AdvantageKit's mode name
 */
export const driverStationEntries = [
	['/DS:enabled', '/DS:autonomous', '/DS:test', '/DS:estop'],
	...['/DriverStation/', '/AdvantageKit/DriverStation/', '/NT:/AdvantageKit/DriverStation/'].map(
		(prefix) =>
			[
				`${prefix}Enabled`,
				`${prefix}Autonomous`,
				`${prefix}Test`,
				`${prefix}EmergencyStop`,
				`${prefix}RobotMode`,
			] as const,
	),
] as const;
// Live sources have the same flags as a bitfield in NetworkTables
export const controlDataName = '/FMSInfo/FMSControlData';
export const controlBits = { enabled: 0x01, autonomous: 0x02, test: 0x04, estop: 0x08 };
