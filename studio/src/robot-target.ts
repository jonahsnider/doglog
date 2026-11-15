import * as z from 'zod';

/** NT server host for a simulator on this computer
 * @public
 */
export const simulatorHost = 'localhost';

const teamNumberSchema = z
	.string()
	.regex(/^\d{1,5}$/)
	.transform(Number)
	.refine((team) => team !== 0)
	.transform((team) => `10.${Math.floor(team / 100)}.${team % 100}.2`);

const robotHostSchema = z.union([teamNumberSchema, z.ipv4()]);

/**
 * Turn a robot connection target (a team number or an IPv4 address) into the NT server host.
 * Team numbers use the standard robot address, ex. team 581 is `10.5.81.2`.
 * Returns `undefined` if the target isn't a valid team number or IP address.
 */
export function getRobotHost(target: string): string | undefined {
	return robotHostSchema.safeParse(target.trim()).data;
}
