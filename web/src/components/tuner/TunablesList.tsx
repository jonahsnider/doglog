import type { TunableValue } from './Tuner';
import { TunableValueRow } from './TunableValueRow';

interface TunablesListProps {
	tunables: Map<string, TunableValue>;
	onUpdateValue: (key: string, value: string | number | boolean) => void;
}

export function TunablesList({ tunables, onUpdateValue }: TunablesListProps) {
	const sortedTunables = Array.from(tunables.values()).sort((a, b) => a.key.localeCompare(b.key));

	if (sortedTunables.length === 0) {
		return (
			<div className="rounded-lg border border-[var(--sl-color-gray-5)] bg-[var(--sl-color-gray-6)] p-8 text-center">
				<div className="mb-2 text-4xl">📡</div>
				<h3 className="mb-2 text-lg font-medium text-[var(--sl-color-white)]">Waiting for tunable values...</h3>
				<p className="text-[var(--sl-color-gray-3)]">
					Tunable values created with <code className="text-[var(--sl-color-accent)]">DogLog.tunable()</code> will
					appear here automatically.
				</p>
			</div>
		);
	}

	// Group tunables by their prefix (first part of the key before /)
	const groups = new Map<string, TunableValue[]>();
	for (const tunable of sortedTunables) {
		const parts = tunable.key.split('/');
		const group = parts.length > 1 ? parts[0]! : 'Other';
		const existing = groups.get(group);
		if (existing) {
			existing.push(tunable);
		} else {
			groups.set(group, [tunable]);
		}
	}

	const sortedGroups = Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h2 className="text-lg font-medium text-[var(--sl-color-white)]">Tunable Values ({sortedTunables.length})</h2>
			</div>

			{sortedGroups.map(([group, values]) => (
				<div
					key={group}
					className="rounded-lg border border-[var(--sl-color-gray-5)] bg-[var(--sl-color-gray-6)] overflow-hidden"
				>
					<div className="border-b border-[var(--sl-color-gray-5)] bg-[var(--sl-color-gray-5)]/30 px-4 py-2">
						<h3 className="font-medium text-[var(--sl-color-white)]">{group}</h3>
					</div>
					<div className="divide-y divide-[var(--sl-color-gray-5)]">
						{values.map((tunable) => (
							<TunableValueRow key={tunable.key} tunable={tunable} onUpdateValue={onUpdateValue} />
						))}
					</div>
				</div>
			))}
		</div>
	);
}
