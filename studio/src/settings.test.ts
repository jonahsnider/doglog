// oxlint-disable landmines/no-test-doubles -- Tests run without a DOM, so they provide the browser globals themselves
import { afterAll, beforeAll, beforeEach, expect, test, vi } from 'vite-plus/test';

const storage = new Map<string, string>();

beforeAll(async () => {
	vi.stubGlobal('localStorage', {
		getItem: (key: string) => storage.get(key) ?? null,
		setItem: (key: string, value: string) => storage.set(key, value),
	});
	// Tests reload the module, load it once up front so the first test's budget doesn't include a cold load
	await import('./settings.ts');
});

beforeEach(() => {
	vi.resetModules();
	storage.clear();
});

afterAll(() => {
	vi.unstubAllGlobals();
});

test('new settings keep the DogLog default', async () => {
	const { settingsStore } = await import('./settings.ts');
	expect(settingsStore.get()).toStrictEqual({
		theme: 'system',
		themePreset: null,
		themeColor: '#1c1816',
		frcColors: null,
		highContrast: false,
		visualizationPalette: 'default',
		reduceMotion: false,
		reduceTransparency: false,
		name: '',
		robotTarget: '',
		reduceLiveBandwidth: false,
		mediaControls: false,
		timelineAlerts: true,
		timelineCompress: true,
		timelineShifts: true,
		naturalScrolling: true,
	});
});

test('custom colors survive preset changes and a reload', async () => {
	const { settingsStore, updateSettings } = await import('./settings.ts');
	updateSettings({ theme: 'dark', themePreset: 'custom', themeColor: '#123456' });
	for (const themePreset of ['doglog', 'match13', 'custom'] as const) {
		updateSettings({ themePreset });
		expect(settingsStore.get().themeColor).toBe('#123456');
	}
	updateSettings({ themePreset: 'froglog', visualizationPalette: 'tritan' });
	vi.resetModules();
	const reloaded = await import('./settings.ts');
	expect(reloaded.settingsStore.get()).toStrictEqual({
		theme: 'dark',
		themePreset: 'froglog',
		themeColor: '#123456',
		frcColors: null,
		highContrast: false,
		visualizationPalette: 'tritan',
		reduceMotion: false,
		reduceTransparency: false,
		name: '',
		robotTarget: '',
		reduceLiveBandwidth: false,
		mediaControls: false,
		timelineAlerts: true,
		timelineCompress: true,
		timelineShifts: true,
		naturalScrolling: true,
	});
});
