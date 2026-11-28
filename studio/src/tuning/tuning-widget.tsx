import { Button } from '@astryxdesign/core/Button';
import { Spinner } from '@astryxdesign/core/Spinner';
import { colorVars, spacingVars, textSizeVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import { useHotkey } from '@tanstack/react-hotkeys';
import { useSelector } from '@tanstack/react-store';
import SlidersHorizontalIcon from 'lucide-react/icons/sliders-horizontal';
import { use, useRef, useState } from 'react';
import { InlineShortcut } from '@/components/shortcut';
import { toastManager } from '@/components/toast';
import { useDataVersion } from '@/data/data-store';
import type { LiveStatus } from '@/data/live-source';
import { useSource } from '@/data/source';
import { WidgetBindingsContext } from '@/entries/drag';
import { startEditing } from '@/entries/editing';
import {
	tuningDashboardId,
	applyTunables,
	committedDraft,
	currentValue,
	type Draft,
	parseDraft,
	previousStore,
	sameTunableValue,
	type Tunable,
	type TunableValue,
} from '@/tuning/tunables';
import { ArrayTunable } from '@/tuning/array-tunable';
import { listSections } from '@/tuning/sections';
import { type Editing, Notes, ScalarRow, SectionHeading } from '@/tuning/tunable-rows';
import { WidgetEmpty, WidgetLoading } from '@/widgets/widget-empty';
import type { WidgetProps } from '@/widgets/widget-type';

const applyShortcut = 'Mod+Enter';

const styles = stylex.create({
	panel: { display: 'flex', flexDirection: 'column', height: '100%', outline: 'none' },
	values: {
		flex: 1,
		minHeight: 0,
		overflowY: 'auto',
		paddingInline: spacingVars['--spacing-1-5'],
		paddingBottom: spacingVars['--spacing-2'],
	},
	footer: {
		display: 'flex',
		flexShrink: 0,
		alignItems: 'center',
		gap: spacingVars['--spacing-2'],
		paddingBlock: spacingVars['--spacing-2'],
		paddingInline: spacingVars['--spacing-3'],
	},
	status: {
		display: 'flex',
		flex: 1,
		alignItems: 'center',
		gap: spacingVars['--spacing-1-5'],
		fontSize: textSizeVars['--font-size-sm'],
		fontVariantNumeric: 'tabular-nums',
		color: colorVars['--color-text-secondary'],
	},
});

/** Staged values, with the robot's value when each was staged */
type Staged = Readonly<Record<string, { value: TunableValue; base: TunableValue | undefined }>>;

function without<T>(record: Readonly<Record<string, T>>, key: string): Readonly<Record<string, T>> {
	const { [key]: _, ...rest } = record;
	return rest;
}

/** Stage a value, or unstage it if it's what the robot has */
function stage(current: Staged, tunable: Tunable, value: TunableValue): Staged {
	const rest = without(current, tunable.entry.name);
	const base = currentValue(tunable);
	return sameTunableValue(value, base) ? rest : { ...rest, [tunable.entry.name]: { value, base } };
}

function showApplyError(error: unknown): void {
	toastManager.add({
		type: 'error',
		title: 'Couldn’t apply changes',
		description: error instanceof Error ? error.message : String(error),
	});
}

/**
 * Tunes the robot's tunable values bound to it, grouped by table, applying staged changes together. Once the live
 * session has connected, its values stay editable while it's reconnecting or disconnected, and are applied once it's
 * connected again.
 */
export function TuningWidget({ bindings }: WidgetProps) {
	const source = useSource();
	// Until the live session first connects, there's nothing to tune
	if (source?.type !== 'live') {
		return (
			<WidgetEmpty
				icon={<SlidersHorizontalIcon aria-hidden />}
				title="Live connection required"
				description="Connect to a robot to tune its values."
			/>
		);
	}
	if (source.status === 'connecting') {
		return <WidgetLoading label="Connecting to robot…" />;
	}
	return <Tunables bindings={bindings} status={source.status} />;
}

function Tunables({ bindings, status }: Pick<WidgetProps, 'bindings'> & { status: LiveStatus }) {
	const connected = status === 'connected';
	useDataVersion();
	const widget = use(WidgetBindingsContext);
	const paneId = widget?.paneId;
	const { tunables, sections } = listSections(bindings);
	const previous = useSelector(previousStore);

	const [staged, setStaged] = useState<Staged>({});
	// Values the robot already has, ex. someone else applied them, aren't staged anymore
	const settled = tunables.filter((tunable) => {
		const value = staged[tunable.entry.name]?.value;
		return value !== undefined && sameTunableValue(value, currentValue(tunable));
	});
	if (settled.length > 0) {
		setStaged(settled.reduce((rest, { entry }) => without(rest, entry.name), staged));
	}
	const stagedValues = Object.fromEntries(Object.entries(staged).map(([name, { value }]) => [name, value]));
	// Staged values the robot's value changed under, ex. someone else applied another value
	const stale = new Set(
		tunables.flatMap((tunable) => {
			const { name } = tunable.entry;
			return name in staged && !sameTunableValue(staged[name]!.base, currentValue(tunable)) ? [name] : [];
		}),
	);
	// What's typed in each field, staged as soon as it's a valid value
	const [drafts, setDrafts] = useState<Readonly<Record<string, Draft>>>({});
	const [applying, setApplying] = useState(false);
	const stagedCount = Object.keys(staged).length;
	// Invalid values aren't staged, but Discard still clears them
	const hasInvalid = tunables.some((tunable) => {
		const draft = drafts[tunable.entry.name];
		return draft !== undefined && parseDraft(tunable, draft) === undefined;
	});

	const editing: Editing = {
		staged: stagedValues,
		stale,
		drafts,
		previous,
		edit: (tunable, draft) => {
			const { name } = tunable.entry;
			const value = draft === undefined ? undefined : parseDraft(tunable, draft);
			setDrafts(draft === undefined ? without(drafts, name) : { ...drafts, [name]: draft });
			setStaged(value === undefined ? without(staged, name) : stage(staged, tunable, value));
		},
		commit: (tunable) => {
			const { name } = tunable.entry;
			const draft = drafts[name];
			if (draft !== undefined && parseDraft(tunable, draft) !== undefined) {
				const kept = committedDraft(tunable, draft);
				setDrafts(kept === undefined ? without(drafts, name) : { ...drafts, [name]: kept });
			}
		},
	};

	const discard = () => {
		setStaged({});
		setDrafts({});
	};
	// Fractions stay as they're typed after they're applied
	const applied = () => {
		setStaged({});
		setDrafts(
			Object.fromEntries(
				tunables.flatMap((tunable) => {
					const draft = drafts[tunable.entry.name];
					const kept =
						draft !== undefined && parseDraft(tunable, draft) !== undefined
							? committedDraft(tunable, draft)
							: undefined;
					return kept === undefined ? [] : [[tunable.entry.name, kept]];
				}),
			),
		);
	};
	const apply = () => {
		if (stagedCount === 0 || applying || !connected) {
			return;
		}
		setApplying(true);
		void applyTunables(tunables, stagedValues)
			.then(applied, showApplyError)
			.finally(() => setApplying(false));
	};

	// Anywhere in the widget, including its fields
	const panelRef = useRef<HTMLDivElement>(null);
	useHotkey(applyShortcut, apply, { target: panelRef, ignoreInputs: false });

	if (tunables.length === 0) {
		return (
			<WidgetEmpty
				icon={<SlidersHorizontalIcon />}
				title={bindings.length === 0 ? 'No tunables' : 'No data'}
				description={
					bindings.length === 0
						? 'Pick the values to tune from the entry browser.'
						: "The robot doesn't publish any of these tunables."
				}
			>
				{paneId !== undefined && (
					<Button label="Edit entries" size="sm" onClick={() => startEditing(tuningDashboardId, paneId)} />
				)}
			</WidgetEmpty>
		);
	}

	return (
		// Focusable so clicking anywhere in the panel lets its shortcut work
		<div ref={panelRef} tabIndex={-1} {...stylex.props(styles.panel)}>
			<div {...stylex.props(styles.values)}>
				{sections.map((section) =>
					section.array ? (
						<ArrayTunable
							key={section.key}
							tunable={section.tunable}
							editing={editing}
							layout={section.binding.role}
							onLayoutChange={(layout) => widget?.setRole(section.binding.id, layout)}
						/>
					) : (
						<section key={section.key}>
							{section.key !== '' && <SectionHeading table={section.key} />}
							{section.tunables.map((tunable) => (
								<ScalarRow key={tunable.entry.name} tunable={tunable} editing={editing} />
							))}
						</section>
					),
				)}
			</div>
			<div {...stylex.props(styles.footer)}>
				<span {...stylex.props(styles.status)}>
					{status === 'reconnecting' && <Spinner size="sm" aria-label="Reconnecting" />}
					<Notes
						notes={[
							stagedCount > 0 && { text: `${stagedCount} staged`, morphKey: 'staged' },
							stale.size > 0 && { text: `${stale.size} changed`, morphKey: 'changed', warning: true },
							!connected && { text: status === 'reconnecting' ? 'Reconnecting' : 'Disconnected' },
						]}
					/>
				</span>
				<Button
					label="Discard"
					variant="ghost"
					size="sm"
					isDisabled={stagedCount === 0 && !hasInvalid}
					onClick={discard}
				/>
				<Button
					label={stale.size > 0 ? 'Apply anyway' : 'Apply'}
					variant="primary"
					size="sm"
					isDisabled={stagedCount === 0 || !connected}
					isLoading={applying}
					endContent={<InlineShortcut hotkey={applyShortcut} />}
					onClick={apply}
				/>
			</div>
		</div>
	);
}
