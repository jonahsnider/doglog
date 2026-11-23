import { expect, test } from 'vite-plus/test';
import {
	buildOpenLogDeepLink,
	describeHttpError,
	guessLogFileName,
	initialLogLabel,
	isHtmlContentType,
	isMixedContentUrl,
	normalizeLogUrl,
	parseContentDispositionFilename,
} from '@/data/log-url';

test('normalizeLogUrl accepts http(s) URLs and defaults scheme-less hosts to https', () => {
	expect(normalizeLogUrl('https://example.com/qual12.wpilog')?.href).toBe('https://example.com/qual12.wpilog');
	expect(normalizeLogUrl('http://10.5.81.2:8080/logs/match.wpilogxz')?.href).toBe(
		'http://10.5.81.2:8080/logs/match.wpilogxz',
	);
	expect(normalizeLogUrl('  example.com/qual12.wpilog?sig=abc&exp=1  ')?.href).toBe(
		'https://example.com/qual12.wpilog?sig=abc&exp=1',
	);
	expect(normalizeLogUrl('localhost:5173/test.wpilog')?.href).toBe('https://localhost:5173/test.wpilog');
	expect(normalizeLogUrl('example.com:8080/test.wpilog')?.href).toBe('https://example.com:8080/test.wpilog');
});

test.each([
	'',
	'   ',
	'file:///tmp/qual12.wpilog',
	'ftp://example.com/qual12.wpilog',
	'javascript:alert(1)',
	'data:application/octet-stream;base64,AAAA',
	'/Users/team581/qual12.wpilog',
	'C:\\logs\\qual12.wpilog',
	'dashbaord',
	'.wpilog',
	'example.',
	'https://example.com/with spaces.wpilog',
])('normalizeLogUrl rejects invalid input %j', (bad) => {
	expect(normalizeLogUrl(bad)).toBeUndefined();
});

test('buildOpenLogDeepLink percent-encodes URLs with query parameters', () => {
	expect(buildOpenLogDeepLink('https://example.com/log.wpilog?a=1&b=2')).toBe(
		'doglog://open?url=https%3A%2F%2Fexample.com%2Flog.wpilog%3Fa%3D1%26b%3D2',
	);
});

test('parseContentDispositionFilename prefers filename* and strips path segments', () => {
	expect(
		parseContentDispositionFilename('attachment; filename="fallback.wpilog"; filename*=UTF-8\'\'qual%2012.wpilog'),
	).toBe('qual 12.wpilog');
	expect(parseContentDispositionFilename('attachment; filename="../../secret/match.wpilog"')).toBe('match.wpilog');
	expect(parseContentDispositionFilename('attachment; filename=plain.wpilogxz')).toBe('plain.wpilogxz');
	expect(parseContentDispositionFilename('inline')).toBeUndefined();
});

test('guessLogFileName falls back from Content-Disposition to decoded path to log.wpilog', () => {
	expect(guessLogFileName('https://cdn.example.com/download/1234', 'attachment; filename="FRC_2026_Q12.wpilog"')).toBe(
		'FRC_2026_Q12.wpilog',
	);
	expect(guessLogFileName('https://cdn.example.com/logs/qual%2012.wpilog?sig=1')).toBe('qual 12.wpilog');
	expect(guessLogFileName('https://cdn.example.com/')).toBe('log.wpilog');
	expect(initialLogLabel('https://cdn.example.com/')).toBe('cdn.example.com');
});

test('isHtmlContentType, describeHttpError, and isMixedContentUrl classify edge cases', () => {
	expect(isHtmlContentType('text/html; charset=utf-8')).toBe(true);
	expect(isHtmlContentType('application/xhtml+xml')).toBe(true);
	expect(isHtmlContentType('application/octet-stream')).toBe(false);

	expect(describeHttpError(401)).toContain('signing in');
	expect(describeHttpError(403)).toContain('signing in');
	expect(describeHttpError(404)).toContain('404');
	expect(describeHttpError(502, 'Bad Gateway')).toBe('Server returned HTTP 502 Bad Gateway.');

	expect(isMixedContentUrl(new URL('http://example.com/a.wpilog'), 'https:')).toBe(true);
	expect(isMixedContentUrl(new URL('http://localhost:8080/a.wpilog'), 'https:')).toBe(false);
	expect(isMixedContentUrl(new URL('https://example.com/a.wpilog'), 'https:')).toBe(false);
	expect(isMixedContentUrl(new URL('http://example.com/a.wpilog'), 'http:')).toBe(false);
});
