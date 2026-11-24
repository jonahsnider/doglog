import { afterEach, beforeEach, expect, test, vi } from 'vite-plus/test';

const storageKey = 'doglog-studio:settings';
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
		contrast: 'standard',
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

test.each([
	{ themeColor: '#591616', themePreset: 'team581', expectedColor: '#1c1816' },
	{ themeColor: '#1234AB', themePreset: 'custom', expectedColor: '#1234AB' },
])(
	'existing color $themeColor and theme mode survive adding presets',
	async ({ themeColor, themePreset, expectedColor }) => {
		storage.set(storageKey, JSON.stringify({ theme: 'light', themeColor, robotTarget: '581' }));
		const { settingsStore } = await import('./settings.ts');
		const expected = {
			theme: 'light',
			themeColor: expectedColor,
			contrast: 'standard',
			reduceMotion: false,
			name: '',
			robotTarget: '581',
			reduceLiveBandwidth: false,
			mediaControls: false,
			timelineAlerts: true,
			timelineCompress: true,
			timelineShifts: true,
			naturalScrolling: true,
			themePreset,
		};
		expect(settingsStore.get()).toStrictEqual(expected);
		expect(JSON.parse(String(storage.get(storageKey)))).toStrictEqual(expected);
	},
);

test('custom colors survive preset changes and a reload', async () => {
	storage.set(storageKey, JSON.stringify({ theme: 'dark', themeColor: '#123456' }));
	const { settingsStore, updateSettings } = await import('./settings.ts');
	for (const themePreset of ['team581', 'match13', 'custom'] as const) {
		updateSettings({ themePreset });
		expect(settingsStore.get().themeColor).toBe('#123456');
	}
	updateSettings({ themePreset: 'froglog' });
	vi.resetModules();
	const reloaded = await import('./settings.ts');
	expect(reloaded.settingsStore.get()).toStrictEqual({
		theme: 'dark',
		themePreset: 'froglog',
		themeColor: '#123456',
		contrast: 'standard',
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

test('the removed Neutral preset falls back to Team 581 and keeps the custom color', async () => {
	storage.set(storageKey, JSON.stringify({ themePreset: 'coss', themeColor: '#123456' }));
	const { settingsStore } = await import('./settings.ts');
	expect(settingsStore.get()).toMatchObject({ themePreset: 'team581', themeColor: '#123456' });
});
