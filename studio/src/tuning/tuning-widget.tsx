import { Button } from '@astryxdesign/core/Button';
import { Spinner } from '@astryxdesign/core/Spinner';
import { useHotkey } from '@tanstack/react-hotkeys';
import { useSelector } from '@tanstack/react-store';
import SlidersHorizontalIcon from 'lucide-react/icons/sliders-horizontal';
import { use, useRef, useState } from 'react';
import { InlineShortcut } from '@/components/shortcut';
import { toastManager } from '@/components/toast';
import { type Entry, useDataVersion } from '@/data/data-store';
import type { LiveStatus } from '@/data/live-source';
import { useSource } from '@/data/source';
import { WidgetBindingsContext } from '@/entries/drag';
import { startEditing } from '@/entries/editing';
import { tuningDashboardId } from '@/tuning/dashboard';
import { ArrayTunable } from '@/tuning/array-tunable';
import { type Editing, Notes, ScalarRow, SectionHeading } from '@/tuning/tunable-rows';
import {
	applyTunables,
	committedDraft,
	compareTables,
	currentValue,
	type Draft,
	findTunables,
	parseDraft,
	previousStore,
	sameTunableValue,
	type Tunable,
	type TunableValue,
} from '@/tuning/tunables';
import { WidgetEmpty, WidgetLoading } from '@/widgets/widget-empty';
import type { WidgetBinding, WidgetProps } from '@/widgets/widget-type';

const applyShortcut = 'Mod+Enter';

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

type Section =
	| { key: string; array: false; tunables: Tunable[] }
	/** `binding` picks how the array is edited */
	| { key: string; array: true; tunable: Tunable; binding: WidgetBinding };

/** Where a tunable is listed: its table, or for an array, its own section at its path */
function sectionKey(tunable: Tunable): string {
	if (!tunable.array) {
		return tunable.table;
	}
	return tunable.table === '' ? tunable.label : `${tunable.table}/${tunable.label}`;
}

/** The bound tunables, in sections ordered like `compareTables()` */
function listSections(bindings: readonly WidgetBinding[]): { tunables: Tunable[]; sections: Section[] } {
	// An entry can be bound more than once, its first binding is used
	const firstBindings = new Map<string, WidgetBinding & { entry: Entry }>();
	for (const binding of bindings) {
		if (binding.entry !== undefined && !firstBindings.has(binding.name)) {
			firstBindings.set(binding.name, { ...binding, entry: binding.entry });
		}
	}
	const tunables = findTunables([...firstBindings.values()].map(({ entry }) => entry)).toSorted(
		(a, b) =>
			compareTables(sectionKey(a), sectionKey(b)) || a.label.localeCompare(b.label, undefined, { numeric: true }),
	);
	const sections: Section[] = [];
	for (const tunable of tunables) {
		const key = sectionKey(tunable);
		const last = sections.at(-1);
		if (tunable.array) {
			sections.push({ key, array: true, tunable, binding: firstBindings.get(tunable.entry.name)! });
		} else if (last?.array === false && last.key === key) {
			last.tunables.push(tunable);
		} else {
			sections.push({ key, array: false, tunables: [tunable] });
		}
	}
	return { tunables, sections };
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
		<div ref={panelRef} tabIndex={-1} className="flex h-full flex-col outline-none">
			<div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
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
			<div className="flex shrink-0 items-center gap-2 px-3 py-2">
				<span className="tunable-status">
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
