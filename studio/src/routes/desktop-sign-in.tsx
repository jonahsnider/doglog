import type { WireCreationOptions, WireRequestOptions } from '@convex-dev/auth/methods/username-passkey/react-custom';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Divider } from '@astryxdesign/core/Divider';
import { VStack } from '@astryxdesign/core/Layout';
import { Spinner } from '@astryxdesign/core/Spinner';
import { Text } from '@astryxdesign/core/Text';
import { createFileRoute } from '@tanstack/react-router';
import ExternalLinkIcon from 'lucide-react/icons/external-link';
import KeyRoundIcon from 'lucide-react/icons/key-round';
import LinkIcon from 'lucide-react/icons/link';
import { type ReactNode, useEffect, useState, useTransition } from 'react';
import * as z from 'zod';
import { browserCeremonies } from '@/cloud/passkey-ceremonies';
import { sealSignInResult, signInLink } from '@/cloud/sign-in-handoff';
import { CopyField } from '@/components/copy-field';
import { BackToDashboards, PageEmptyState } from '@/components/page-empty-state';

// Where the desktop app signs in, see sign-in-handoff.ts. Read from the URL directly, since the router would parse
// values that look like numbers.

const isObject = (value: unknown) => typeof value === 'object' && value !== null;

const passkeyRequest = z.discriminatedUnion('ceremony', [
	z.object({ ceremony: z.literal('register'), options: z.custom<WireCreationOptions>(isObject) }),
	z.object({ ceremony: z.literal('authenticate'), options: z.custom<WireRequestOptions>(isObject) }),
]);
type PasskeyRequest = z.infer<typeof passkeyRequest> & { key: string };

type SignInRequest = PasskeyRequest | { ceremony: 'oauth'; key: string; result: { code: string } | { error: string } };

function parseJson(text: string | null): unknown {
	try {
		return text === null ? undefined : JSON.parse(text);
	} catch {
		return undefined;
	}
}

function readRequest(): SignInRequest | undefined {
	const params = new URLSearchParams(location.search);
	const key = params.get('key');
	if (key === null) {
		return undefined;
	}
	const code = params.get('convexAuthCode');
	const error = params.get('convexAuthError');
	if (code !== null || error !== null) {
		return { ceremony: 'oauth', key, result: code === null ? { error: error ?? '' } : { code } };
	}
	const passkey = passkeyRequest.safeParse(parseJson(new URLSearchParams(location.hash.slice(1)).get('passkey')));
	return passkey.success ? { ...passkey.data, key } : undefined;
}

export const Route = createFileRoute('/desktop-sign-in')({
	component: DesktopSignIn,
});

function DesktopSignIn() {
	const [request] = useState(readRequest);
	const [code, setCode] = useState<string>();

	useEffect(() => {
		if (request?.ceremony !== 'oauth') {
			return undefined;
		}
		let active = true;
		void (async () => {
			const sealed = await sealSignInResult(request.key, request.result);
			if (active) {
				setCode(sealed);
				location.assign(signInLink(sealed));
			}
		})();
		return () => {
			active = false;
		};
	}, [request]);

	if (code !== undefined) {
		return (
			<SignInMessage
				icon={<ExternalLinkIcon />}
				title="Return to DogLog Studio"
				description="Finish signing in in the desktop app. You can close this tab."
			>
				<VStack gap={4} width="100%">
					<Button label="Open DogLog Studio" variant="primary" onClick={() => location.assign(signInLink(code))} />
					<Divider label="or" />
					<VStack gap={2}>
						<Text color="secondary">Didn’t open? Paste this code into the app.</Text>
						<CopyField label="Sign-in code" value={code} />
					</VStack>
				</VStack>
			</SignInMessage>
		);
	}
	if (request === undefined) {
		return (
			<SignInMessage
				icon={<LinkIcon />}
				title="Couldn’t continue signing in"
				description="This link is missing details from DogLog Studio. Sign in again from the app."
			>
				<BackToDashboards />
			</SignInMessage>
		);
	}
	if (request.ceremony === 'oauth') {
		return <SignInMessage icon={<Spinner size="lg" />} title="Returning to DogLog Studio" />;
	}
	return <PasskeyPrompt request={request} onDone={setCode} />;
}

// Waits for a click, since Safari only shows the passkey prompt after one, and so signing in is the user's choice
function PasskeyPrompt({ request, onDone }: { request: PasskeyRequest; onDone: (code: string) => void }) {
	const [pending, startTransition] = useTransition();
	const [error, setError] = useState<string>();

	function run() {
		setError(undefined);
		startTransition(async () => {
			const result = await (
				request.ceremony === 'register'
					? browserCeremonies.register(request.options)
					: browserCeremonies.authenticate(request.options)
			).catch(() => undefined);
			if (result?.success !== true) {
				setError(
					result === undefined
						? 'Couldn’t continue with your passkey. Try again.'
						: 'The passkey prompt was closed or timed out. Try again when you’re ready.',
				);
				return;
			}
			const sealed = await sealSignInResult(request.key, { response: result.response });
			onDone(sealed);
			location.assign(signInLink(sealed));
		});
	}

	return (
		<SignInMessage
			icon={<KeyRoundIcon />}
			title="Sign in to DogLog Studio"
			description={
				request.ceremony === 'register'
					? 'Create a passkey for your Cloud account in the desktop app.'
					: 'Use your passkey to sign in to Cloud in the desktop app.'
			}
		>
			<VStack gap={3} hAlign="center">
				<Button label="Continue with passkey" variant="primary" isLoading={pending} onClick={run} />
				{error !== undefined && <Banner status="error" role="alert" title={error} />}
			</VStack>
		</SignInMessage>
	);
}

function SignInMessage({
	icon,
	title,
	description,
	children,
}: {
	icon: ReactNode;
	title: string;
	description?: string;
	children?: ReactNode;
}) {
	return <PageEmptyState icon={icon} title={title} description={description} actions={children} />;
}
