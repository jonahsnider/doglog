import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { createServer, type RequestListener } from 'node:http';
import { text } from 'node:stream/consumers';
import { expect, test } from 'vite-plus/test';
import { S3Storage } from './client';
import type { S3Connection } from './connection';

async function withStorage(handle: RequestListener, run: (connection: S3Connection) => Promise<void>): Promise<void> {
	const server = createServer(handle);
	server.listen(0, '127.0.0.1');
	await once(server, 'listening');
	try {
		const address = server.address();
		if (address === null || typeof address === 'string') {
			throw new Error('Expected TCP test server.');
		}
		await run({
			kind: 's3',
			provider: 'other',
			endpoint: `http://127.0.0.1:${address.port}`,
			region: 'us-east-1',
			bucket: 'logs',
			root: 'team',
			accessKeyId: 'test-key',
			secretAccessKey: 'test-secret',
		});
	} finally {
		const closed = once(server, 'close');
		server.close();
		server.closeAllConnections();
		await closed;
	}
}

test.skipIf(STUDIO_DESKTOP)('never deletes the source when a copy returns an error inside a 200 response', async () => {
	const requests: { method: string | undefined; source: string | string[] | undefined }[] = [];
	const replies = new Map<string | undefined, string>([
		['GET', '<ListBucketResult><IsTruncated>false</IsTruncated></ListBucketResult>'],
		['PUT', '<Error><Code>AccessDenied</Code><Message>Copy denied</Message></Error>'],
	]);
	await withStorage(
		(request, response) => {
			requests.push({ method: request.method, source: request.headers['x-amz-copy-source'] });
			response.end(replies.get(request.method));
		},
		async (connection) => {
			await expect(new S3Storage(connection).rename('log #1.wpilog', 'log #2.wpilog')).rejects.toMatchObject({
				code: 'AccessDenied',
			});
		},
	);
	expect(requests.find(({ method }) => method === 'PUT')?.source).toBe('/logs/team/log%20%231.wpilog');
	expect(requests.some(({ method }) => method === 'DELETE')).toBe(false);
});

test.skipIf(STUDIO_DESKTOP)('signs the provider-specific CORS XML with a checksum matching the body', async () => {
	let received: { body: string; checksum: unknown; authorization: string | undefined } | undefined;
	await withStorage(
		(request, response) => {
			void text(request).then((body) => {
				received = {
					body,
					checksum: request.headers['x-amz-checksum-sha256'],
					authorization: request.headers.authorization,
				};
				return response.end();
			});
		},
		async (connection) => {
			await new S3Storage({ ...connection, provider: 'gcs', region: 'auto' }).allowBrowsers();
		},
	);
	expect(received?.body).toMatch(/^<CorsConfig>.*<\/CorsConfig>$/u);
	expect(received?.checksum).toBe(createHash('sha256').update(received!.body).digest('base64'));
	expect(received?.authorization).toContain('x-amz-checksum-sha256');
});
