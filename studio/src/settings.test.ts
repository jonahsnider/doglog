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
		themeColor: '#591616',
		robotTarget: '',
	});
});

test.each([
	{ themeColor: '#591616', themePreset: 'team581' },
	{ themeColor: '#1234AB', themePreset: 'custom' },
])('existing color $themeColor and theme mode survive adding presets', async ({ themeColor, themePreset }) => {
	storage.set(storageKey, JSON.stringify({ theme: 'light', themeColor, robotTarget: '581' }));
	const { settingsStore } = await import('./settings.ts');
	const expected = {
		theme: 'light',
		themeColor,
		robotTarget: '581',
		themePreset,
	};
	expect(settingsStore.get()).toStrictEqual(expected);
	expect(JSON.parse(String(storage.get(storageKey)))).toStrictEqual(expected);
});

test('custom colors survive preset changes and a reload', async () => {
	storage.set(storageKey, JSON.stringify({ theme: 'dark', themeColor: '#123456' }));
	const { settingsStore, updateSettings } = await import('./settings.ts');
	for (const themePreset of ['team581', 'coss', 'custom'] as const) {
		updateSettings({ themePreset });
		expect(settingsStore.get().themeColor).toBe('#123456');
	}
	updateSettings({ themePreset: 'coss' });
	vi.resetModules();
	const reloaded = await import('./settings.ts');
	expect(reloaded.settingsStore.get()).toStrictEqual({
		theme: 'dark',
		themePreset: 'coss',
		themeColor: '#123456',
		robotTarget: '',
	});
});
