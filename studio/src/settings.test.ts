import { afterEach, beforeEach, expect, test, vi } from 'vite-plus/test';

const storage = new Map<string, string>();

beforeEach(() => {
	vi.resetModules();
	storage.clear();
	vi.stubGlobal('localStorage', {
		getItem: (key: string) => storage.get(key) ?? null,
		setItem: (key: string, value: string) => storage.set(key, value),
	});
});

afterEach(() => {
	vi.unstubAllGlobals();
});

test('new settings keep the Team 581 default', async () => {
	const { settingsStore } = await import('./settings.ts');
	expect(settingsStore.get()).toStrictEqual({
		theme: 'system',
		themePreset: 'team581',
		themeColor: '#1c1816',
		highContrast: false,
		visualizationPalette: 'default',
		reduceMotion: false,
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
	for (const themePreset of ['team581', 'match13', 'custom'] as const) {
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
		highContrast: false,
		visualizationPalette: 'tritan',
		reduceMotion: false,
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
