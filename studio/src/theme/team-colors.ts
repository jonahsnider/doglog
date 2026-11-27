import { createAtom } from '@tanstack/store';
import * as z from 'zod';
import { teamDefaultsStore } from '@/cloud/session';
import { settingsStore, updateSettings } from '@/settings';

const hexColorSchema = z.string().regex(/^#[\da-f]{6}$/iu);
const responseSchema = z.object({ primaryHex: hexColorSchema, secondaryHex: hexColorSchema });

/** The team the FRC Colors preset is for: the Cloud team's number, or the robot connection's team number */
export const colorsTeamNumberStore = createAtom(() => {
	const cloudTeamNumber = teamDefaultsStore.get()?.teamNumber ?? null;
	if (cloudTeamNumber !== null) {
		return cloudTeamNumber;
	}
	const target = settingsStore.get().robotTarget.trim();
	return /^\d{1,5}$/u.test(target) && Number(target) !== 0 ? Number(target) : null;
});

async function fetchTeamColors(teamNumber: number, signal: AbortSignal): Promise<void> {
	try {
		const response = await fetch(`https://api.frc-colors.com/v1/team/${teamNumber}`, { signal });
		if (response.ok) {
			const { primaryHex, secondaryHex } = responseSchema.parse(await response.json());
			updateSettings({ frcColors: { teamNumber, colors: { primary: primaryHex, secondary: secondaryHex } } });
		} else if (response.status === 404) {
			updateSettings({ frcColors: { teamNumber, colors: null } });
		}
	} catch {
		// Offline or replaced by another team number, keep the cached colors
	}
}

/**
 * Keep the FRC Colors preset's colors up to date with its team, refreshing them once per launch. Joining a Cloud team
 * switches to FRC Colors if the user hasn't picked a preset, so members see their team's colors.
 */
export function syncTeamColors(): void {
	let controller: AbortController | undefined;
	let timeout: ReturnType<typeof setTimeout> | undefined;
	const update = () => {
		controller?.abort();
		clearTimeout(timeout);
		const teamNumber = colorsTeamNumberStore.get();
		if (teamNumber === null) {
			if (settingsStore.get().frcColors !== null) {
				updateSettings({ frcColors: null });
			}
			return;
		}
		const current = new AbortController();
		controller = current;
		// Wait for typing in the robot connection setting to finish
		timeout = setTimeout(() => void fetchTeamColors(teamNumber, current.signal), 500);
	};
	update();
	colorsTeamNumberStore.subscribe(update);

	// Joining a team, or a team without a number setting one, gives this device a Cloud team number. A preset the user
	// picked, even DogLog, stays.
	let cloudTeamNumber = teamDefaultsStore.get()?.teamNumber ?? null;
	teamDefaultsStore.subscribe((defaults) => {
		const teamNumber = defaults?.teamNumber ?? null;
		if (cloudTeamNumber === null && teamNumber !== null && settingsStore.get().themePreset === null) {
			updateSettings({ themePreset: 'frc-colors' });
		}
		cloudTeamNumber = teamNumber;
	});
}
