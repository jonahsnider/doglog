import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { HStack, VStack } from '@astryxdesign/core/Layout';
import { Text } from '@astryxdesign/core/Text';
import { type ConvexReactClient, useConvex, useQuery } from 'convex/react';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { api } from '../../../cloud/convex/_generated/api.js';
import type { Id } from '../../../cloud/convex/_generated/dataModel';
import {
	cancelPairing,
	errorMessage,
	type PairingAccount,
	type PairingRequest,
	pairNewDevice,
	startApproval,
} from './pairing-flow';

function PairingCode({ code }: { code: string }) {
	return (
		<Text type="code" size="2xl" as="p">
			{code.slice(0, 3)} {code.slice(3)}
		</Text>
	);
}

type PairState =
	| { step: 'idle' }
	| { step: 'waiting' }
	| { step: 'code'; code: string }
	| { step: 'error'; message: string };

export function PairThisDevice({ account, onPaired }: { account: PairingAccount; onPaired: () => void }) {
	const client = useConvex();
	const [state, setState] = useState<PairState>({ step: 'idle' });
	const controller = useRef<AbortController>(null);
	useEffect(() => () => controller.current?.abort(), []);

	async function pair() {
		const current = new AbortController();
		controller.current = current;
		setState({ step: 'waiting' });
		try {
			await pairNewDevice(client, account, current.signal, (code) => setState({ step: 'code', code }));
			onPaired();
		} catch (error) {
			if (!current.signal.aborted) {
				setState({ step: 'error', message: errorMessage(error, 'Couldn’t get approval. Try again.') });
			}
		}
	}

	if (state.step === 'idle' || state.step === 'error') {
		return (
			<VStack gap={2} hAlign="start">
				{state.step === 'error' && <Banner status="error" role="alert" title={state.message} />}
				<Button label="Request approval" size="sm" onClick={() => void pair()} />
			</VStack>
		);
	}
	return (
		<VStack gap={2} hAlign="start">
			<Text role="status">
				{state.step === 'waiting'
					? 'On a device you’re already signed in on, open Cloud and choose Approve.'
					: 'Check that your other device shows this code, then confirm there.'}
			</Text>
			{state.step === 'code' && <PairingCode code={state.code} />}
			<Button
				label="Cancel"
				size="sm"
				onClick={() => {
					controller.current?.abort();
					setState({ step: 'idle' });
				}}
			/>
		</VStack>
	);
}

interface Attempt {
	controller: AbortController;
	id: Id<'pairings'>;
}

function endAttempt(client: ConvexReactClient, attempt: RefObject<Attempt | null>) {
	const current = attempt.current;
	attempt.current = null;
	if (current) {
		current.controller.abort();
		void cancelPairing(client, current.id);
	}
}

type ApproveState =
	| { step: 'idle' }
	| { step: 'waiting' }
	| { step: 'code'; code: string; confirm: () => Promise<void>; sending: boolean }
	| { step: 'done' }
	| { step: 'error'; message: string };

export function ApprovePairing({ account }: { account: PairingAccount }) {
	const client = useConvex();
	const request = useQuery(api.pairings.getMine);
	const [state, setState] = useState<ApproveState>({ step: 'idle' });
	const attempt = useRef<Attempt>(null);
	useEffect(() => () => endAttempt(client, attempt), [client]);

	function cancel() {
		endAttempt(client, attempt);
		setState({ step: 'idle' });
	}

	async function approve(pairing: PairingRequest) {
		const controller = new AbortController();
		attempt.current = { controller, id: pairing.id };
		setState({ step: 'waiting' });
		try {
			const { code, confirm } = await startApproval(client, account, pairing, controller.signal);
			setState({ step: 'code', code, confirm, sending: false });
		} catch (error) {
			if (!controller.signal.aborted) {
				attempt.current = null;
				setState({
					step: 'error',
					message: errorMessage(error, 'Couldn’t approve the sign-in. Start again on your new device.'),
				});
			}
		}
	}

	async function send(confirm: () => Promise<void>, code: string) {
		setState({ step: 'code', code, confirm, sending: true });
		try {
			await confirm();
			// The new device removes the attempt once it has saved the key
			attempt.current = null;
			setState({ step: 'done' });
		} catch (error) {
			endAttempt(client, attempt);
			setState({
				step: 'error',
				message: errorMessage(error, 'Couldn’t send your key. Start again on your new device.'),
			});
		}
	}

	if (state.step === 'idle') {
		return request && !request.approverKey ? (
			<VStack gap={2} hAlign="start">
				<Text role="status">A new sign-in is waiting for your approval.</Text>
				<Button label="Approve" variant="primary" size="sm" onClick={() => void approve(request)} />
			</VStack>
		) : null;
	}
	if (state.step === 'waiting') {
		return (
			<VStack gap={2} hAlign="start">
				<Text role="status">Waiting for your new device…</Text>
				<Button label="Cancel" size="sm" onClick={cancel} />
			</VStack>
		);
	}
	if (state.step === 'code') {
		return (
			<VStack gap={2} hAlign="start">
				<Text role="status">Approve only if your new device shows this code.</Text>
				<PairingCode code={state.code} />
				<HStack wrap="wrap" gap={2}>
					<Button label="Cancel" size="sm" isDisabled={state.sending} onClick={cancel} />
					<Button
						label="Approve sign-in"
						variant="primary"
						size="sm"
						isLoading={state.sending}
						onClick={() => void send(state.confirm, state.code)}
					/>
				</HStack>
			</VStack>
		);
	}
	if (state.step === 'done') {
		return (
			<Text role="status" color="secondary">
				Your new device is approved.
			</Text>
		);
	}
	return (
		<Banner
			status="error"
			role="alert"
			title={state.message}
			isDismissable
			onDismiss={() => setState({ step: 'idle' })}
		/>
	);
}
