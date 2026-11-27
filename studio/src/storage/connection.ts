// A team's storage connection, see the log-storage spec. Admins set it up on the Cloud page, and every member's Studio
// gets it encrypted with the team key.
import * as z from 'zod';

export const s3Providers = ['r2', 'b2', 'aws', 'gcs', 'other'] as const;
export type S3Provider = (typeof s3Providers)[number];

const root = z.string().catch('');

const s3Schema = z.object({
	kind: z.literal('s3'),
	provider: z.enum(s3Providers),
	/** Ex. `https://<account>.r2.cloudflarestorage.com`, without the bucket. Not used for Amazon S3. */
	endpoint: z.string(),
	region: z.string(),
	bucket: z.string(),
	accessKeyId: z.string(),
	secretAccessKey: z.string(),
	/** Folder in the bucket everything is kept in, `''` for the bucket's root */
	root,
});

const sftpSchema = z.object({
	kind: z.literal('sftp'),
	host: z.string(),
	port: z.number(),
	username: z.string(),
	password: z.string().optional(),
	/** An OpenSSH or PEM private key, used instead of a password */
	privateKey: z.string().optional(),
	/** Folder on the server everything is kept in, `''` for the login folder */
	root,
});

export const connectionSchema = z.discriminatedUnion('kind', [s3Schema, sftpSchema]);

export type StorageConnection = z.infer<typeof connectionSchema>;
export type S3Connection = z.infer<typeof s3Schema>;
export type SftpConnection = z.infer<typeof sftpSchema>;

/** What each S3-compatible provider needs, and how Studio fills in the rest */
export const s3Presets: Record<S3Provider, { label: string; region: string; endpointHint: string }> = {
	r2: { label: 'Cloudflare R2', region: 'auto', endpointHint: 'Account ID, ex. 023e105f4ecef8ad9ca31a8372d0c353' },
	b2: { label: 'Backblaze B2', region: 'us-west-004', endpointHint: 'Region, ex. us-west-004' },
	aws: { label: 'Amazon S3', region: 'us-east-1', endpointHint: 'Region, ex. us-east-1' },
	gcs: { label: 'Google Cloud Storage', region: 'auto', endpointHint: '' },
	other: { label: 'Other S3-compatible', region: 'us-east-1', endpointHint: 'Endpoint, ex. https://nas.local:9000' },
};

/** The endpoint a provider's preset field fills in: R2's account ID, B2's region, or a whole endpoint for others */
export function presetEndpoint(provider: S3Provider, value: string): { endpoint: string; region: string } {
	const trimmed = value.trim();
	switch (provider) {
		case 'r2': {
			return { endpoint: `https://${trimmed}.r2.cloudflarestorage.com`, region: 'auto' };
		}
		case 'b2': {
			return { endpoint: `https://s3.${trimmed}.backblazeb2.com`, region: trimmed };
		}
		case 'aws': {
			return { endpoint: `https://s3.${trimmed}.amazonaws.com`, region: trimmed };
		}
		case 'gcs': {
			return { endpoint: 'https://storage.googleapis.com', region: 'auto' };
		}
		default: {
			// Scheme-less hosts are HTTPS, like opening a log from a URL
			return { endpoint: /^https?:\/\//iu.test(trimmed) ? trimmed : `https://${trimmed}`, region: 'us-east-1' };
		}
	}
}

/** The storage kind's name, ex. Cloudflare R2 */
export function connectionKind(connection: StorageConnection): string {
	return connection.kind === 'sftp' ? 'SFTP' : s3Presets[connection.provider].label;
}

/** Whether a browser can reach the storage: S3-compatible storage at an HTTPS address that isn't on the local network */
export function reachableFromWeb(connection: StorageConnection): boolean {
	if (connection.kind === 'sftp') {
		return false;
	}
	let url: URL;
	try {
		url = new URL(connection.endpoint);
	} catch {
		return false;
	}
	const host = url.hostname;
	const local =
		host === 'localhost' ||
		host.endsWith('.local') ||
		/^(?:10|127)\./u.test(host) ||
		host.startsWith('192.168.') ||
		/^172\.(?:1[6-9]|2\d|3[01])\./u.test(host) ||
		/^\[?(?:fc|fd|fe80)/iu.test(host);
	return url.protocol === 'https:' && !local;
}

/** A folder path relative to the root, joined with `/`, without empty parts */
export function joinPath(...parts: string[]): string {
	return parts
		.flatMap((part) => part.split('/'))
		.filter(Boolean)
		.join('/');
}
