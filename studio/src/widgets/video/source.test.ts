import { expect, test } from 'vite-plus/test';
import { formatSync, parseSync, parseVideo } from '@/widgets/video/source';

test('YouTube links in the forms people copy them', () => {
	const id = 'dQw4w9WgXcQ';
	for (const link of [
		`https://www.youtube.com/watch?v=${id}`,
		`youtube.com/watch?feature=shared&v=${id}`,
		`https://m.youtube.com/watch?v=${id}`,
		`https://youtu.be/${id}?si=abc`,
		`https://www.youtube.com/live/${id}`,
		`https://www.youtube.com/shorts/${id}`,
		`https://www.youtube-nocookie.com/embed/${id}`,
	]) {
		expect(parseVideo(link)).toEqual({ kind: 'youtube', id, start: undefined });
	}
});

test("a YouTube link's timestamp is where it starts", () => {
	expect(parseVideo('https://youtu.be/dQw4w9WgXcQ?t=296')).toMatchObject({ start: 296 });
	expect(parseVideo('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1h4m56s')).toMatchObject({ start: 3896 });
	expect(parseVideo('https://www.youtube.com/embed/dQw4w9WgXcQ?start=90')).toMatchObject({ start: 90 });
});

test('other links are unsupported, and text without slashes is a file name', () => {
	expect(parseVideo('https://vimeo.com/123456789')).toEqual({ kind: 'unsupported' });
	expect(parseVideo('https://www.youtube.com/@FIRSTRoboticsCompetition')).toEqual({ kind: 'unsupported' });
	expect(parseVideo(' qual12 stands.mp4 ')).toEqual({ kind: 'file', name: 'qual12 stands.mp4' });
	expect(parseVideo('  ')).toBeUndefined();
});

test('a sync moved before the start keeps its offset', () => {
	// Nudging a video that starts 10 s into the log earlier
	expect(formatSync({ log: 10, video: -0.1 })).toBe('10.1=0');
	expect(parseSync(formatSync({ log: 83, video: 296.5 }))).toEqual({ log: 83, video: 296.5 });
	expect(parseSync('')).toEqual({ log: 0, video: 0 });
});
