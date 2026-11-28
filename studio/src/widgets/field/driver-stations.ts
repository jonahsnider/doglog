/** One of the six driver stations, numbered 1 to 3 from the drivers' left */
export type DriverStation = { readonly alliance: 'blue' | 'red'; readonly number: 1 | 2 | 3 };

export const driverStations: readonly DriverStation[] = (['blue', 'red'] as const).flatMap((alliance) =>
	([1, 2, 3] as const).map((number) => ({ alliance, number })),
);

export const driverStationLabel = ({ alliance, number }: DriverStation) =>
	`${alliance === 'blue' ? 'Blue' : 'Red'} ${number}`;

/** Tells driver stations apart, ex. `red-2` */
export const driverStationKey = ({ alliance, number }: DriverStation) => `${alliance}-${number}`;
