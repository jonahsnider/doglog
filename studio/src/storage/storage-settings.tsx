// oxlint-disable max-lines -- The connection form's fields for each kind of storage are kept together
// The team's storage connection on the Cloud page, see the log-storage spec's team storage connection
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { ClickableCard } from '@astryxdesign/core/ClickableCard';
import { Code } from '@astryxdesign/core/Code';
import { CodeBlock } from '@astryxdesign/core/CodeBlock';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Divider } from '@astryxdesign/core/Divider';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { FormLayout } from '@astryxdesign/core/FormLayout';
import { Grid } from '@astryxdesign/core/Grid';
import { HStack, Layout, LayoutContent, LayoutFooter, LayoutHeader, VStack } from '@astryxdesign/core/Layout';
import { MetadataList, MetadataListItem } from '@astryxdesign/core/MetadataList';
import { NumberInput } from '@astryxdesign/core/NumberInput';
import { Spinner } from '@astryxdesign/core/Spinner';
import { Step, Stepper } from '@astryxdesign/core/Stepper';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TextInput } from '@astryxdesign/core/TextInput';
import * as stylex from '@stylexjs/stylex';
import { useSelector } from '@tanstack/react-store';
import { createAtom } from '@tanstack/store';
import { useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import CircleXIcon from 'lucide-react/icons/circle-x';
import { type SubmitEvent, useState } from 'react';
import { ConfirmCloudDialog } from '@/cloud/confirm-cloud-action';
import { type TeamKey, accountKeyStore, teamKeyStore } from '@/cloud/session';
import { UtilityPageSection } from '@/components/utility-page';
import { DownloadButton } from '@/desktop/download-button';
import { type CheckResult, type CheckStep, checkConnection } from '@/storage/check';
import {
	type S3Provider,
	type StorageConnection,
	connectionKind,
	presetEndpoint,
	reachableFromWeb,
	s3Presets,
	s3Providers,
} from '@/storage/connection';
import { encryptConnection } from '@/storage/connection-crypto';
import { ProviderIcon } from '@/storage/provider-icon';
import { useTeamStorage } from '@/storage/team-storage';
import { api } from '../../../cloud/convex/_generated/api.js';

type Kind = S3Provider | 'sftp';
const kinds: readonly Kind[] = [...s3Providers, 'sftp'];

const sectionDescription = 'Use a shared storage bucket or server to collaborate on logs and match videos together';

const kindLabel = (kind: Kind) => (kind === 'sftp' ? 'SFTP' : s3Presets[kind].label);

/** What each kind of storage asks for, so admins know what to have ready before choosing it */
const kindNeeds: Record<Kind, string> = {
	r2: 'An account ID and R2 API token',
	b2: 'A region and application key',
	aws: 'A region and IAM access key',
	gcs: 'An HMAC key',
	other: 'Any server with an S3 API, like a NAS',
	sftp: 'A server you log in to over SSH',
};

/**
 * Each provider's names for its key, the format it comes in, and where it's made, since providers call it different
 * things, ex. Google Cloud's access ID
 */
const s3Keys: Record<
	S3Provider,
	{ id: string; secret: string; idExample?: string; secretExample?: string; where?: string }
> = {
	r2: {
		id: 'Access key ID',
		secret: 'Secret access key',
		idExample: 'e2a6e9f8c4b1d7a3f0e5c9b8a7d6f4e3',
		secretExample: '9b0c4d2e7f1a8b3c6d5e4f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c',
		where: 'Create an API token with Object Read & Write access in R2’s Manage API tokens',
	},
	b2: {
		id: 'Key ID',
		secret: 'Application key',
		idExample: '004a1b2c3d4e5f60000000001',
		secretExample: 'K004aBcDeFgHiJkLmNoPqRsTuVwXyZ0',
		where: 'Create an application key in Backblaze’s Application Keys',
	},
	aws: {
		id: 'Access key ID',
		secret: 'Secret access key',
		idExample: 'AKIAIOSFODNN7EXAMPLE',
		secretExample: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
		where: 'Create an access key in an IAM user’s Security credentials',
	},
	gcs: {
		id: 'Access ID',
		secret: 'Secret',
		idExample: 'GOOG1ETS7C7FUP3AIRVJTE2BCDKINBTES3HC2GY5CBFJDCQ2SYHV6A6XXVTJFSA',
		secretExample: 'bGoa+V7g/yqDXvKRqq+JTFn4uQZbPiQJo4pf9RzJ',
		where: 'Create an HMAC key for a service account in Cloud Storage’s Settings, under Interoperability',
	},
	other: { id: 'Access key ID', secret: 'Secret access key' },
};

const listFormat = new Intl.ListFormat('en', { type: 'conjunction' });

const stepNames: Record<CheckStep, string> = {
	list: 'list',
	write: 'write to',
	read: 'read from',
	delete: 'delete from',
};

/** The check's steps as the dialog shows them, then saving */
const progressSteps: readonly { step: CheckStep | 'save'; label: string }[] = [
	{ step: 'list', label: 'List files' },
	{ step: 'write', label: 'Write a test file' },
	{ step: 'read', label: 'Read it back' },
	{ step: 'delete', label: 'Delete it' },
	{ step: 'save', label: 'Save for the team' },
];
const progressIndex = (step: CheckStep | 'save') => progressSteps.findIndex((progress) => progress.step === step);

interface Draft {
	kind: Kind;
	/** R2's account ID, B2's or Amazon's region, or another provider's endpoint */
	preset: string;
	bucket: string;
	accessKeyId: string;
	secretAccessKey: string;
	host: string;
	port: number;
	username: string;
	password: string;
	privateKey: string;
	root: string;
}

function draftFrom(connection: StorageConnection | undefined): Draft {
	const blank: Draft = {
		kind: 'r2',
		preset: '',
		bucket: '',
		accessKeyId: '',
		secretAccessKey: '',
		host: '',
		port: 22,
		username: '',
		password: '',
		privateKey: '',
		root: '',
	};
	if (!connection) {
		return blank;
	}
	// Credentials are never shown again, so replacing them starts with the rest filled in
	if (connection.kind === 'sftp') {
		return { ...blank, kind: 'sftp', host: connection.host, port: connection.port, root: connection.root };
	}
	let preset = connection.endpoint;
	if (connection.provider === 'r2') {
		preset = /^https:\/\/([^.]+)\.r2\.cloudflarestorage\.com/u.exec(connection.endpoint)?.[1] ?? '';
	} else if (connection.provider === 'b2' || connection.provider === 'aws') {
		preset = connection.region;
	}
	return { ...blank, kind: connection.provider, preset, bucket: connection.bucket, root: connection.root };
}

function connectionFrom(draft: Draft): StorageConnection {
	const root = draft.root.trim().replaceAll(/^\/+|\/+$/gu, '');
	if (draft.kind === 'sftp') {
		return {
			kind: 'sftp',
			host: draft.host.trim(),
			port: draft.port,
			username: draft.username.trim(),
			password: draft.password === '' ? undefined : draft.password,
			privateKey: draft.privateKey.trim() === '' ? undefined : draft.privateKey,
			root,
		};
	}
	return {
		kind: 's3',
		provider: draft.kind,
		...presetEndpoint(draft.kind, draft.preset),
		bucket: draft.bucket.trim(),
		accessKeyId: draft.accessKeyId.trim(),
		secretAccessKey: draft.secretAccessKey.trim(),
		root,
	};
}

/** Whether a field the kind of storage needs is blank */
/** The fields the kind of storage needs that are blank, by their labels */
function missingFields(draft: Draft): string[] {
	let fields: (readonly [label: string, value: string])[];
	if (draft.kind === 'sftp') {
		fields = [
			['Host', draft.host],
			['Username', draft.username],
			['Password or private key', draft.password === '' ? draft.privateKey : draft.password],
		];
	} else {
		const keys = s3Keys[draft.kind];
		const [presetLabel = ''] = s3Presets[draft.kind].endpointHint.split(', ex. ');
		fields = [
			...(presetLabel === '' ? [] : [[presetLabel, draft.preset] as const]),
			['Bucket', draft.bucket],
			[keys.id, draft.accessKeyId],
			[keys.secret, draft.secretAccessKey],
		];
	}
	return fields
		.filter(([, value]) => value.trim() === '')
		.map(([label]) => label.charAt(0).toLowerCase() + label.slice(1));
}

/** A saved connection's fields as the form labels them, without its secret, password, or private key */
function savedFields(connection: StorageConnection): (readonly [label: string, value: string, isCode?: boolean])[] {
	const root = connection.root === '' ? [] : [['Root folder', connection.root] as const];
	if (connection.kind === 'sftp') {
		return [
			['Host', connection.host],
			['Port', String(connection.port)],
			['Username', connection.username],
			['Signs in with', connection.privateKey === undefined ? 'Password' : 'Private key'],
			...root,
		];
	}
	const [presetLabel = ''] = s3Presets[connection.provider].endpointHint.split(', ex. ');
	return [
		...(presetLabel === '' ? [] : [[presetLabel, draftFrom(connection).preset] as const]),
		['Bucket', connection.bucket],
		[s3Keys[connection.provider].id, connection.accessKeyId, true],
		...root,
	];
}

/** Submits the details, naming any blank fields while it's disabled */
function CheckButton({ draft, isUnlocked }: { draft: Draft; isUnlocked: boolean }) {
	const missing = missingFields(draft);
	return (
		<Button
			type="submit"
			label="Check connection"
			variant="primary"
			// The key's banner explains itself, so the tooltip only names the blank fields
			tooltip={missing.length > 0 ? `Fill in the ${listFormat.format(missing)}` : undefined}
			isDisabled={missing.length > 0 || !isUnlocked}
		/>
	);
}

/** Why the connection can't be saved from this device yet, since it's encrypted with a team key the device must hold */
function KeyBlocker({ teamKey }: { teamKey: TeamKey | 'failed' | 'waiting' | undefined }) {
	const { status } = useSelector(accountKeyStore);
	if (typeof teamKey === 'object') {
		return null;
	}
	if (teamKey === 'waiting') {
		return (
			<Banner
				status="info"
				title="Waiting for your team’s encryption key"
				description="The connection is encrypted with your team’s key, which you’ll get when a teammate next opens DogLog Studio."
			/>
		);
	}
	if (status === 'missing') {
		return (
			<Banner
				status="warning"
				title="Approve this device first"
				description="The connection is encrypted with your team’s key, which this device can’t unlock until you approve this sign-in from a device you’re already signed in on, under Account on this page."
			/>
		);
	}
	if (status === 'error' || teamKey === 'failed') {
		return (
			<Banner
				status="error"
				title="Couldn’t unlock your team’s encryption key on this device"
				description="The connection is encrypted with your team’s key. Try again under Account on this page."
			/>
		);
	}
	return <Banner status="info" title="Unlocking your team’s encryption key on this device…" />;
}

// The fields hold an API key, not a login, and 1Password's menu for them takes focus from the field as it's clicked
const noPasswordManager = { 'data-1p-ignore': true };

type FieldsProps = { draft: Draft; update: (changes: Partial<Draft>) => void };

function SftpFields({ draft, update }: FieldsProps) {
	return (
		<>
			<HStack gap={2} wrap="wrap">
				<TextInput
					{...noPasswordManager}
					label="Host"
					value={draft.host}
					placeholder="nas.local"
					hasSpellCheck={false}
					onChange={(host) => update({ host })}
				/>
				<NumberInput
					label="Port"
					value={draft.port}
					min={1}
					max={65_535}
					isIntegerOnly
					width={120}
					onChange={(port) => update({ port })}
				/>
			</HStack>
			<TextInput
				{...noPasswordManager}
				label="Username"
				placeholder="doglog"
				value={draft.username}
				autoComplete="off"
				hasSpellCheck={false}
				onChange={(username) => update({ username })}
			/>
			<TextInput
				{...noPasswordManager}
				label="Password"
				type="password"
				description="Or the private key's passphrase"
				value={draft.password}
				autoComplete="off"
				isOptional
				onChange={(password) => update({ password })}
			/>
			<TextArea
				{...noPasswordManager}
				label="Private key"
				description="An OpenSSH or PEM private key, used instead of a password"
				value={draft.privateKey}
				rows={3}
				isOptional
				onChange={(privateKey) => update({ privateKey })}
			/>
		</>
	);
}

function S3Fields({ draft, update, hint }: FieldsProps & { hint: string }) {
	const [label = '', example] = hint.split(', ex. ');
	const keys = s3Keys[draft.kind === 'sftp' ? 'other' : draft.kind];
	return (
		<>
			{hint !== '' && (
				<TextInput
					{...noPasswordManager}
					label={label}
					placeholder={example}
					value={draft.preset}
					hasSpellCheck={false}
					onChange={(preset) => update({ preset })}
				/>
			)}
			<TextInput
				{...noPasswordManager}
				label="Bucket"
				placeholder="team-logs"
				value={draft.bucket}
				hasSpellCheck={false}
				onChange={(bucket) => update({ bucket })}
			/>
			<TextInput
				{...noPasswordManager}
				label={keys.id}
				description={keys.where}
				placeholder={keys.idExample}
				value={draft.accessKeyId}
				autoComplete="off"
				hasSpellCheck={false}
				onChange={(accessKeyId) => update({ accessKeyId })}
			/>
			<TextInput
				{...noPasswordManager}
				label={keys.secret}
				type="password"
				placeholder={keys.secretExample}
				value={draft.secretAccessKey}
				autoComplete="off"
				onChange={(secretAccessKey) => update({ secretAccessKey })}
			/>
		</>
	);
}

/** Which step of the check failed, why it usually does, and for CORS the rule to add */
function CheckFailure({ result }: { result: Exclude<CheckResult, { ok: true }> }) {
	return (
		<Banner
			status="error"
			role="alert"
			title={`Couldn’t ${stepNames[result.step]} the storage`}
			description={
				<VStack gap={2}>
					<Text>{result.hint}</Text>
					{result.fix.map(({ code, language }) => (
						<CodeBlock
							key={code}
							code={code}
							language={language}
							width="100%"
							isWrapped
							hasLanguageLabel={language !== undefined}
							hasCopyButton
						/>
					))}
					<CodeBlock code={result.message} size="sm" width="100%" isWrapped maxHeight={200} hasLanguageLabel={false} />
				</VStack>
			}
		/>
	);
}

/** Encrypt a connection with the team key so Cloud can't read it, returns why saving failed */
async function encryptForSave(
	teamKey: TeamKey,
	connection: StorageConnection,
	save: (args: { keyVersion: number; iv: ArrayBuffer; ciphertext: ArrayBuffer }) => Promise<unknown>,
): Promise<string | undefined> {
	try {
		const { teamId, keyVersion, key } = teamKey;
		const { iv, ciphertext } = await encryptConnection(key, { teamId, keyVersion }, connection);
		await save({ keyVersion, iv, ciphertext });
		return undefined;
	} catch (cause) {
		return cause instanceof Error ? cause.message : String(cause);
	}
}

/** How the check is going, see the log-storage spec's check a connection */
type Run =
	| { state: 'running'; step: CheckStep | 'save' }
	| { state: 'failed'; result: Exclude<CheckResult, { ok: true }> }
	| { state: 'save-failed'; error: string }
	| { state: 'done'; corsWarning?: string };

function runIndex(run: Run): number {
	switch (run.state) {
		case 'running':
			return progressIndex(run.step);
		case 'failed':
			return progressIndex(run.result.step);
		case 'save-failed':
			return progressIndex('save');
		default:
			return progressSteps.length;
	}
}

/** Each step of the check, with a spinner on the one running and an error on the one that failed */
function CheckProgress({ run }: { run: Run }) {
	const active = runIndex(run);
	const failed = run.state === 'failed' || run.state === 'save-failed';
	const indicator = (index: number) => {
		if (index !== active) {
			return 'auto';
		}
		// The error color is close to the theme's accent, so the icon is what marks the failed step
		return failed ? <CircleXIcon aria-hidden size={16} /> : <Spinner size="sm" />;
	};
	return (
		<Stepper activeStep={active} orientation="vertical" density="compact" label="Connection check">
			{progressSteps.map(({ step, label }, index) => (
				<Step
					key={step}
					step={index}
					label={label}
					status={failed && index === active ? 'error' : undefined}
					indicator={indicator(index)}
				/>
			))}
		</Stepper>
	);
}

/** The check's progress, then why it failed or that the storage is ready */
function CheckOutcome({ run }: { run: Run }) {
	return (
		<VStack gap={4}>
			<CheckProgress run={run} />
			{run.state === 'failed' && <CheckFailure result={run.result} />}
			{run.state === 'save-failed' && (
				<Banner status="error" role="alert" title="Couldn’t save the connection" description={run.error} />
			)}
			{run.state === 'done' && (
				<Banner
					status={run.corsWarning === undefined ? 'success' : 'warning'}
					title="Every member can use the team’s storage now"
					description={run.corsWarning}
				/>
			)}
		</VStack>
	);
}

/** One card per kind of storage, with its logo and what it asks for */
function ProviderPicker({ onPick }: { onPick: (kind: Kind) => void }) {
	return (
		<Grid columns={{ minWidth: 220 }} gap={2}>
			{kinds.map((kind) => (
				<ClickableCard key={kind} label={kindLabel(kind)} padding={3} onClick={() => onPick(kind)}>
					<HStack gap={3} vAlign="center">
						<ProviderIcon kind={kind} size={24} />
						<VStack gap={0.5}>
							<Text type="label">{kindLabel(kind)}</Text>
							<Text type="supporting" color="secondary">
								{kindNeeds[kind]}
							</Text>
						</VStack>
					</HStack>
				</ClickableCard>
			))}
		</Grid>
	);
}

function ConnectionFields({ draft, update }: FieldsProps) {
	// The web app can't open SSH connections, so SFTP is listed but explained instead of set up
	if (draft.kind === 'sftp' && !STUDIO_DESKTOP) {
		return (
			<EmptyState
				icon={<ProviderIcon kind="sftp" size={28} />}
				title="SFTP needs the desktop app"
				description="Browsers can’t open SSH connections, so set up SFTP and use it from the DogLog Studio desktop app."
				actions={<DownloadButton />}
			/>
		);
	}
	const connection = connectionFrom(draft);
	const webCantReach = !STUDIO_DESKTOP && draft.preset.trim() !== '' && !reachableFromWeb(connection);
	return (
		<FormLayout>
			{draft.kind === 'sftp' ? (
				<SftpFields draft={draft} update={update} />
			) : (
				<S3Fields draft={draft} update={update} hint={s3Presets[draft.kind].endpointHint} />
			)}
			<TextInput
				{...noPasswordManager}
				label="Root folder"
				description={draft.kind === 'sftp' ? 'Blank for the login folder' : 'Blank for the whole bucket'}
				placeholder="doglog"
				value={draft.root}
				isOptional
				hasSpellCheck={false}
				onChange={(root) => update({ root })}
			/>
			{webCantReach && (
				<Banner
					status="warning"
					title="Only the desktop app can reach this storage"
					description="Browsers can’t reach local network or http:// addresses, so members will need the desktop app."
				/>
			)}
		</FormLayout>
	);
}

const pages = ['Provider', 'Details', 'Check'] as const;

/** Choose a kind of storage, fill in its details, then check and save it, see the log-storage spec's kinds of storage */
/**
 * A setup closed before it finished, so reopening it continues there. Kept in memory and never on disk, since it can
 * hold a secret key or password, so it's gone once Studio reloads.
 */
const pausedSetup = createAtom<{ key: string; draft: Draft; page: number } | undefined>(undefined);

function ConnectionDialog({
	teamId,
	initial,
	onClose,
}: {
	teamId: string;
	initial: StorageConnection | undefined;
	onClose: () => void;
}) {
	const save = useMutation(api.storage.save);
	const teamKey = useSelector(teamKeyStore);
	// Setting up and replacing credentials are paused separately, and only for the team they were started for
	const pauseKey = `${teamId}:${initial ? 'replace' : 'set-up'}`;
	const [resumed] = useState(() => {
		const paused = pausedSetup.get();
		return paused?.key === pauseKey ? paused : undefined;
	});
	const fresh = () => ({ draft: draftFrom(initial), page: initial ? 1 : 0 });
	const [draft, setDraft] = useState(() => resumed?.draft ?? fresh().draft);
	// Replacing credentials starts at the details, since the kind is already chosen
	const [page, setPage] = useState(() => resumed?.page ?? fresh().page);
	const [run, setRun] = useState<Run>({ state: 'running', step: 'list' });
	const update = (changes: Partial<Draft>) => setDraft((current) => ({ ...current, ...changes }));
	const unlocked = typeof teamKey === 'object' ? teamKey : undefined;
	const running = page === 2 && run.state === 'running';
	const webSftp = draft.kind === 'sftp' && !STUDIO_DESKTOP;
	const close = () => {
		// Closing mid-check could save the connection after the dialog is gone
		if (running) {
			return;
		}
		const changed = JSON.stringify(draft) !== JSON.stringify(fresh().draft);
		// A check that's shown its result reopens at the details, to change them and check again
		pausedSetup.set(changed ? { key: pauseKey, draft, page: Math.min(page, 1) } : undefined);
		onClose();
	};
	const finish = () => {
		pausedSetup.set(undefined);
		onClose();
	};

	async function check() {
		if (!unlocked) {
			return;
		}
		const connection = connectionFrom(draft);
		setPage(2);
		setRun({ state: 'running', step: 'list' });
		const checked = await checkConnection(connection, (step) => setRun({ state: 'running', step }));
		if (!checked.ok) {
			setRun({ state: 'failed', result: checked });
			return;
		}
		setRun({ state: 'running', step: 'save' });
		const error = await encryptForSave(unlocked, connection, save);
		setRun(error === undefined ? { state: 'done', corsWarning: checked.corsWarning } : { state: 'save-failed', error });
	}

	function submit(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault();
		if (page === 1 && !webSftp && missingFields(draft).length === 0 && unlocked) {
			void check();
		}
	}

	let content;
	let actions;
	if (page === 0) {
		content = (
			<ProviderPicker
				onPick={(kind) => {
					update(kind === draft.kind ? {} : { kind, preset: '' });
					setPage(1);
				}}
			/>
		);
		actions = <Button label="Cancel" variant="ghost" onClick={close} />;
	} else if (page === 1) {
		content = (
			<VStack gap={4}>
				{!webSftp && <KeyBlocker teamKey={teamKey} />}
				<ConnectionFields draft={draft} update={update} />
			</VStack>
		);
		actions = (
			<>
				<Button label="Back" variant="ghost" onClick={() => setPage(0)} />
				{!webSftp && <CheckButton draft={draft} isUnlocked={unlocked !== undefined} />}
			</>
		);
	} else {
		content = <CheckOutcome run={run} />;
		actions =
			run.state === 'done' ? (
				<Button label="Done" variant="primary" onClick={finish} />
			) : (
				<>
					<Button label="Back" variant="ghost" isDisabled={running} onClick={() => setPage(1)} />
					<Button label="Check again" variant="primary" isLoading={running} onClick={() => void check()} />
				</>
			);
	}

	return (
		<Dialog isOpen onOpenChange={(open) => !open && close()} width={600} purpose="form">
			<form onSubmit={submit}>
				<Layout
					// Fill, so the longest step scrolls inside the dialog instead of pushing the footer out of it
					height="fill"
					padding={4}
					defaultHasDividers
					header={
						<>
							<DialogHeader
								title={initial ? 'Replace storage credentials' : 'Configure remote storage'}
								subtitle={
									page === 0 ? (
										sectionDescription
									) : (
										<HStack gap={1.5} vAlign="center">
											<ProviderIcon kind={draft.kind} size={14} />
											{kindLabel(draft.kind)}
										</HStack>
									)
								}
								onOpenChange={(open) => !open && close()}
								hasDivider={false}
							/>
							{/* A position indicator only, the footer's buttons are how to move between steps */}
							<LayoutHeader hasDivider={false}>
								<Stepper activeStep={page} label="Storage setup" density="compact">
									{pages.map((name, index) => (
										<Step key={name} step={index} label={name} />
									))}
								</Stepper>
							</LayoutHeader>
						</>
					}
					content={<LayoutContent>{content}</LayoutContent>}
					footer={
						<LayoutFooter>
							<HStack gap={2} hAlign="end">
								{actions}
							</HStack>
						</LayoutFooter>
					}
				/>
			</form>
		</Dialog>
	);
}

const styles = stylex.create({
	// People copy these, ex. to find the key in the provider's console
	selectable: { userSelect: 'text' },
});

/** The connected storage's kind and location, with admins' buttons to replace its credentials or disconnect it */
function ConnectedStorage({ isAdmin, onReplace }: { isAdmin: boolean; onReplace: () => void }) {
	const team = useTeamStorage();
	const remove = useMutation(api.storage.remove);
	const [disconnecting, setDisconnecting] = useState(false);
	const connection = team?.connection;
	return (
		<UtilityPageSection title="Storage" description={sectionDescription}>
			<VStack gap={3}>
				<Card variant="muted" width="100%" padding={4}>
					<VStack gap={3}>
						<HStack gap={3} vAlign="center">
							<ProviderIcon kind={!connection || connection.kind === 'sftp' ? 'sftp' : connection.provider} />
							<Text type="label">{connection ? connectionKind(connection) : 'Connected'}</Text>
						</HStack>
						{connection ? (
							<MetadataList>
								{savedFields(connection).map(([label, value, isCode]) => (
									<MetadataListItem key={label} label={label}>
										<span {...stylex.props(styles.selectable)}>{isCode === true ? <Code>{value}</Code> : value}</span>
									</MetadataListItem>
								))}
							</MetadataList>
						) : (
							<Text color="secondary">Unlocking the connection on this device…</Text>
						)}
					</VStack>
				</Card>
				{isAdmin && (
					<HStack gap={2} wrap="wrap">
						<Button label="Replace credentials" isDisabled={!team} onClick={onReplace} />
						<Button label="Disconnect" variant="ghost" onClick={() => setDisconnecting(true)} />
					</HStack>
				)}
			</VStack>
			<ConfirmCloudDialog
				open={disconnecting}
				onOpenChange={setDisconnecting}
				label="Disconnect"
				destructive
				title="Disconnect the team’s storage?"
				description="Members’ Studio stops reaching it. Nothing in the storage is deleted, and members may still have its credentials until you replace them."
				failureMessage="Couldn’t disconnect the storage. Try again."
				onConfirm={() => remove()}
			/>
		</UtilityPageSection>
	);
}

/** The team's storage: set up and managed by admins, described to members without its credentials */
export function TeamStorageSettings({ team }: { team: FunctionReturnType<typeof api.teams.getMine> | undefined }) {
	const stored = useQuery(api.storage.get);
	const local = useTeamStorage();
	const [dialog, setDialog] = useState<'set-up' | 'replace'>();
	if (!team || stored === undefined) {
		return null;
	}
	const isAdmin = team.role === 'admin';
	return (
		<>
			{stored === null ? (
				<UtilityPageSection title="Storage" description={sectionDescription}>
					{isAdmin ? (
						<HStack>
							<Button label="Configure remote storage" variant="primary" onClick={() => setDialog('set-up')} />
						</HStack>
					) : (
						<Text color="secondary">Your team doesn’t have storage yet. A team admin can set it up here.</Text>
					)}
				</UtilityPageSection>
			) : (
				<ConnectedStorage isAdmin={isAdmin} onReplace={() => setDialog('replace')} />
			)}
			{/* Kept here so the dialog stays open while the section switches to the saved connection */}
			{dialog && (
				<ConnectionDialog
					teamId={team.id}
					initial={dialog === 'replace' ? local?.connection : undefined}
					onClose={() => setDialog(undefined)}
				/>
			)}
			<Divider />
		</>
	);
}
