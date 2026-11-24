import type { PasskeyCeremonies } from '@convex-dev/auth/methods/username-passkey/react-custom';
import * as z from 'zod';

export function supportsPasskeys(): boolean {
	return (
		globalThis.isSecureContext &&
		typeof PublicKeyCredential !== 'undefined' &&
		typeof PublicKeyCredential.parseCreationOptionsFromJSON === 'function' &&
		typeof PublicKeyCredential.parseRequestOptionsFromJSON === 'function' &&
		typeof PublicKeyCredential.prototype.toJSON === 'function'
	);
}

// Only the fields Cloud accepts, unknown ones are stripped
export const registrationResponse = z.object({
	id: z.string(),
	rawId: z.string(),
	response: z.object({
		clientDataJSON: z.string(),
		attestationObject: z.string(),
		transports: z.array(z.string()).optional(),
	}),
	type: z.literal('public-key'),
});

export const authenticationResponse = z.object({
	id: z.string(),
	rawId: z.string(),
	response: z.object({
		clientDataJSON: z.string(),
		authenticatorData: z.string(),
		signature: z.string(),
		userHandle: z.string().nullish(),
	}),
	type: z.literal('public-key'),
});

/** Runs passkey ceremonies in this browser */
export const browserCeremonies = {
	isSupported: supportsPasskeys,
	async register(options) {
		const credential = await navigator.credentials.create({
			publicKey: PublicKeyCredential.parseCreationOptionsFromJSON(options),
		});
		const parsed = registrationResponse.safeParse(
			credential instanceof PublicKeyCredential ? credential.toJSON() : undefined,
		);
		return parsed.success
			? { success: true, response: parsed.data }
			: { success: false, userError: { error: 'CEREMONY_ABORTED' } };
	},
	async authenticate(options) {
		const credential = await navigator.credentials.get({
			publicKey: PublicKeyCredential.parseRequestOptionsFromJSON(options),
		});
		const parsed = authenticationResponse.safeParse(
			credential instanceof PublicKeyCredential ? credential.toJSON() : undefined,
		);
		return parsed.success
			? { success: true, response: parsed.data }
			: { success: false, userError: { error: 'CEREMONY_ABORTED' } };
	},
} satisfies PasskeyCeremonies;
