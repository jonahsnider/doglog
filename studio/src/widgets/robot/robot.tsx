import { BoxesIcon, DatabaseIcon, ListPlusIcon, SplineIcon } from 'lucide-react';
import { useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioPrimitive } from '@/components/ui/radio-group';
import { SegmentedControl, SegmentedControlItem } from '@/components/ui/segmented-control';
import { type Entry, useDataVersion, useEntries } from '@/data/data-store';
import { useSource } from '@/data/source';
import { type Mechanism, mechanismLayout, readMechanism } from '@/data/mechanism';
import { Mechanism3d } from '@/three/mechanism-3d';
import { type CameraView, Scene3d, type Scene3dHandle } from '@/three/scene';
import { SwerveRobot } from '@/three/swerve-robot';
import { useCursorTime } from '@/timeline/timeline';
import { Legend, type LegendItem } from '@/widgets/legend/legend';
import { MechanismCanvas } from '@/widgets/robot/mechanism-2d';
import { mechanismPlane } from '@/widgets/robot/roles';
import { WidgetEmpty } from '@/widgets/widget-empty';
import type { WidgetBinding, WidgetProps } from '@/widgets/widget-type';

type View = '2d' | '3d';

const cameraViews: readonly { view: CameraView; label: string }[] = [
	{ view: 'reset', label: 'Reset' },
	{ view: 'top', label: 'Top' },
	{ view: 'front', label: 'Front' },
	{ view: 'side', label: 'Side' },
];

/** The mechanisms of the bound entries at the cursor, `undefined` for ones without a value */
function useMechanisms(bindings: readonly WidgetBinding[]): ReadonlyMap<string, Mechanism | undefined> {
	const time = useCursorTime();
	// Values at the cursor change as samples arrive
	useDataVersion();
	const entries = useEntries();
	const names = [
		...new Set(bindings.flatMap((binding) => (binding.entry?.kind === 'mechanism2d' ? [binding.name] : []))),
	].join('\n');
	const layouts = useMemo(
		() => (names === '' ? [] : names.split('\n').map((name) => [name, mechanismLayout(name, entries)] as const)),
		[names, entries],
	);
	return new Map(
		layouts.map(([name, layout]) => [name, time === undefined ? undefined : readMechanism(layout, time)] as const),
	);
}

function isMechanism(binding: WidgetBinding): boolean {
	return binding.entry?.kind === 'mechanism2d';
}

function hasValue(entry: Entry | undefined, time: number | undefined): boolean {
	return entry !== undefined && time !== undefined && entry.samples.valueAt(time) !== undefined;
}

function ViewToggle({ view, onChange }: { view: View; onChange: (view: View) => void }) {
	return (
		<SegmentedControl
			size="sm"
			render={
				<RadioGroup
					aria-label="View"
					className="flex-row gap-0.5"
					value={view}
					onValueChange={(value: string) => onChange(value === '2d' ? '2d' : '3d')}
				/>
			}
		>
			<SegmentedControlItem render={<RadioPrimitive.Root value="2d" />}>2D</SegmentedControlItem>
			<SegmentedControlItem render={<RadioPrimitive.Root value="3d" />}>3D</SegmentedControlItem>
		</SegmentedControl>
	);
}

/** Why there's no mechanism to draw in 2D */
function Empty2d({ mechanism }: { mechanism: WidgetBinding | undefined }) {
	const source = useSource();
	if (!source) {
		return <WidgetEmpty icon={<DatabaseIcon />} title="No data" description="Open a log or connect to a robot." />;
	}
	if (!mechanism) {
		return (
			<WidgetEmpty
				icon={<ListPlusIcon />}
				title="No mechanism"
				description="Add a Mechanism2d entry to draw it in 2D, or switch to 3D."
			/>
		);
	}
	return (
		<WidgetEmpty
			icon={<DatabaseIcon />}
			title="No data"
			description={`${mechanism.name} has no value at the cursor.`}
		/>
	);
}

export function Robot({ bindings, options, setOption }: WidgetProps) {
	const view: View = options['view'] === '2d' ? '2d' : '3d';
	const time = useCursorTime();
	const mechanisms = useMechanisms(bindings);
	const scene = useRef<Scene3dHandle>(null);

	// 2D draws one mechanism, 3D moves the robot's parts with one pose array
	const shown2d = bindings.find((binding) => isMechanism(binding) && !binding.hidden);
	const parts = bindings.find((binding) => binding.entry?.kind === 'struct[]' && !binding.hidden);

	const note = (binding: WidgetBinding) => {
		if (binding.entry === undefined || binding.hidden) {
			return undefined;
		}
		if (view === '2d') {
			return binding === shown2d ? undefined : '3D only';
		}
		return isMechanism(binding) || binding === parts ? undefined : 'Unused';
	};
	const legend = bindings.map((binding): LegendItem => {
		const text = note(binding);
		return {
			binding,
			icon: isMechanism(binding) ? <SplineIcon className="size-3.5" /> : <BoxesIcon className="size-3.5" />,
			dimmed: isMechanism(binding) ? mechanisms.get(binding.name) === undefined : !hasValue(binding.entry, time),
			...(text !== undefined && { note: text }),
		};
	});

	const mechanism2d = shown2d && mechanisms.get(shown2d.name);

	return (
		<div className="flex h-full flex-col gap-2 p-2">
			{legend.length > 0 && (
				<div className="max-h-[33%] shrink-0 overflow-y-auto">
					<Legend items={legend} />
				</div>
			)}
			<div className="flex min-h-0 min-w-0 flex-1 items-center justify-center [container-type:size]">
				{view === '3d' ? (
					<Scene3d ref={scene} label="Robot">
						<SwerveRobot />
						{bindings.map((binding) => {
							const mechanism = binding.hidden ? undefined : mechanisms.get(binding.name);
							return mechanism ? (
								<Mechanism3d key={binding.id} mechanism={mechanism} plane={mechanismPlane(binding)} />
							) : null;
						})}
					</Scene3d>
				) : mechanism2d ? (
					<MechanismCanvas mechanism={mechanism2d} />
				) : (
					<Empty2d mechanism={shown2d} />
				)}
			</div>
			<div className="flex shrink-0 items-center justify-between gap-2">
				<ViewToggle view={view} onChange={(next) => setOption('view', next)} />
				{view === '3d' && (
					<div className="flex gap-1">
						{cameraViews.map(({ view: cameraView, label }) => (
							<Button key={cameraView} variant="ghost" size="xs" onClick={() => scene.current?.setView(cameraView)}>
								{label}
							</Button>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
