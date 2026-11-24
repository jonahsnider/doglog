import { afterEach, expect, test, vi } from 'vite-plus/test';
import { DataSet } from '@/data/data-set';
import { setActiveData } from '@/data/data-store';
import { registerPlaybackVideo } from './playback-clock';
import { getTimeline, resetTimeline, seek, setSpeed, setVideoRange, togglePlayback } from './timeline';

afterEach(() => {
	setActiveData(undefined);
	resetTimeline(undefined);
	setSpeed(1);
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

function playbackFrames(): FrameRequestCallback {
	let frame: FrameRequestCallback | undefined;
	vi.useFakeTimers({ toFake: ['performance'] });
	vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
		frame = callback;
		return 1;
	});
	vi.stubGlobal('cancelAnimationFrame', () => undefined);
	return (now) => frame?.(now);
}

test('playback reports the compressed rate up to the span end and previews exports at 1x', () => {
	const frame = playbackFrames();
	const log = new DataSet(() => {});
	const enabled = log.addEntry('/DS:enabled', 'boolean');
	log.addSample(enabled, 0, false);
	log.addSample(enabled, 34_000_000, true);
	log.addSample(enabled, 50_000_000, true);
	setActiveData(log);
	setSpeed(2);

	// Removing the two-second margins leaves an idle span of 30 seconds played in 1.5 seconds.
	seek(31_000_000);
	togglePlayback();
	const { seekRevision } = getTimeline();
	expect(getTimeline().playbackRate).toBe(20);
	frame(100);
	expect(getTimeline()).toMatchObject({ time: 32_000_000, playbackRate: 2, seekRevision });
	frame(200);
	expect(getTimeline().time).toBe(32_200_000);
	seek(33_000_000);
	expect(getTimeline()).toMatchObject({ time: 33_000_000, playback: 'playing', seekRevision: seekRevision + 1 });

	setVideoRange({ start: 3_000_000, end: 40_000_000 }, { time: 4_000_000, playback: 'playing' });
	expect(getTimeline().playbackRate).toBe(1);
	frame(300);
	expect(getTimeline().time).toBe(4_100_000);
});

test('one local video drives only the part of log playback it can show', ({ onTestFinished }) => {
	const frame = playbackFrames();
	const log = new DataSet(() => {});
	const enabled = log.addEntry('/DS:enabled', 'boolean');
	log.addSample(enabled, 5_000_000, true);
	log.addSample(enabled, 15_000_000, false);
	log.addSample(enabled, 45_000_000, true);
	log.addSample(enabled, 63_000_000, true);
	setActiveData(log);
	let shown: number | null = null;
	onTestFinished(
		registerPlaybackVideo({ range: { start: 2_000_000, end: 46_000_000 }, maxRate: 8, read: () => shown }),
	);

	seek(9_000_000);
	togglePlayback();
	frame(500);
	expect(getTimeline().time).toBe(9_000_000);
	shown = 4_037_000;
	frame(600);
	expect(getTimeline().time).toBe(9_037_000);
	frame(1_000);
	expect(getTimeline().time).toBe(9_037_000);

	const removeSecondVideo = registerPlaybackVideo(undefined);
	onTestFinished(removeSecondVideo);
	frame(1_100);
	expect(getTimeline().time).toBe(9_137_000);
	removeSecondVideo();
	frame(1_200);
	// The next presented frame crosses into the disabled span, but must not skip compressed time.
	shown = 12_057_000;
	frame(1_300);
	expect(getTimeline().time).toBe(17_000_000);
	frame(2_800);
	expect(getTimeline().time).toBe(43_000_000);

	shown = 46_000_000;
	frame(2_900);
	expect(getTimeline().time).toBe(51_000_000);
	frame(3_000);
	expect(getTimeline().time).toBe(51_100_000);

	setVideoRange({ start: 8_000_000, end: 30_000_000 }, { time: 9_000_000, playback: 'playing' });
	frame(3_100);
	expect(getTimeline().time).toBe(9_100_000);
});
