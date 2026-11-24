import { type ConvexReactClient, useConvex, useQuery } from 'convex/react';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
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
		<p className="font-mono text-2xl tracking-widest">
			{code.slice(0, 3)} {code.slice(3)}
		</p>
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
				setState({ step: 'error', message: errorMessage(error, 'Couldn’t pair this device. Try again.') });
			}
		}
	}

	if (state.step === 'idle' || state.step === 'error') {
		return (
			<div className="grid justify-items-start gap-2">
				{state.step === 'error' && (
					<p role="alert" className="text-destructive-foreground text-sm">
						{state.message}
					</p>
				)}
				<Button variant="outline" size="sm" onClick={() => void pair()}>
					Pair this device
				</Button>
			</div>
		);
	}
	return (
		<div className="grid justify-items-start gap-2">
			<p role="status" className="text-sm">
				{state.step === 'waiting'
					? 'On a device that has your key, open Cloud and choose Approve pairing.'
					: 'Check that your other device shows this code, then confirm there.'}
			</p>
			{state.step === 'code' && <PairingCode code={state.code} />}
			<Button
				variant="outline"
				size="sm"
				onClick={() => {
					controller.current?.abort();
					setState({ step: 'idle' });
				}}
			>
				Cancel
			</Button>
		</div>
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
					message: errorMessage(error, 'Couldn’t approve pairing. Start again on your new device.'),
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
			<div className="grid justify-items-start gap-2">
				<p role="status" className="text-sm">
					Another device wants to use your encryption key.
				</p>
				<Button size="sm" onClick={() => void approve(request)}>
					Approve pairing
				</Button>
			</div>
		) : null;
	}
	if (state.step === 'waiting') {
		return (
			<div className="grid justify-items-start gap-2">
				<p role="status" className="text-sm">
					Waiting for your new device…
				</p>
				<Button variant="outline" size="sm" onClick={cancel}>
					Cancel
				</Button>
			</div>
		);
	}
	if (state.step === 'code') {
		return (
			<div className="grid justify-items-start gap-2">
				<p role="status" className="text-sm">
					Pair only if your new device shows this code.
				</p>
				<PairingCode code={state.code} />
				<div className="flex flex-wrap gap-2">
					<Button variant="outline" size="sm" disabled={state.sending} onClick={cancel}>
						Cancel
					</Button>
					<Button size="sm" loading={state.sending} onClick={() => void send(state.confirm, state.code)}>
						Pair device
					</Button>
				</div>
			</div>
		);
	}
	if (state.step === 'done') {
		return (
			<p role="status" className="text-muted-foreground text-sm">
				Your new device is paired.
			</p>
		);
	}
	return (
		<div className="grid justify-items-start gap-2">
			<p role="alert" className="text-destructive-foreground text-sm">
				{state.message}
			</p>
			<Button variant="outline" size="sm" onClick={() => setState({ step: 'idle' })}>
				Dismiss
			</Button>
		</div>
	);
}
