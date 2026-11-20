import BoxesIcon from 'lucide-react/icons/boxes';
import DatabaseIcon from 'lucide-react/icons/database';
import HouseIcon from 'lucide-react/icons/house';
import ListPlusIcon from 'lucide-react/icons/list-plus';
import SplineIcon from 'lucide-react/icons/spline';
import { useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioPrimitive } from '@/components/ui/radio-group';
import { SegmentedControl, SegmentedControlItem } from '@/components/ui/segmented-control';
import { type Entry, useDataVersion, useEntries } from '@/data/data-store';
import { useSource } from '@/data/source';
import { type Mechanism, mechanismLayout, readMechanism } from '@/data/mechanism';
import { Mechanism3d } from '@/three/mechanism-3d';
import { Scene3d, type Scene3dHandle } from '@/three/scene';
import { useCursorTime } from '@/timeline/timeline';
import { Legend, type LegendItem } from '@/widgets/legend/legend';
import { MechanismCanvas } from '@/widgets/robot/mechanism-2d';
import { usePickedRobot } from '@/widgets/robot/picked-robot';
import { mechanismPlane } from '@/widgets/robot/roles';
import { defaultRobot } from '@/widgets/robot/robot-option';
import { WidgetEmpty } from '@/widgets/widget-empty';
import type { WidgetBinding, WidgetProps } from '@/widgets/widget-type';

type View = '2d' | '3d';

const mechanismIcon = <SplineIcon className="size-3.5" />;
const partsIcon = <BoxesIcon className="size-3.5" />;

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
			className="capture:invisible"
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
	const { robot, note: robotNote, loading } = usePickedRobot(options['robot'] ?? defaultRobot, parts?.entry);

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
			icon: isMechanism(binding) ? mechanismIcon : partsIcon,
			dimmed: isMechanism(binding) ? mechanisms.get(binding.name) === undefined : !hasValue(binding.entry, time),
			...(text !== undefined && { note: text }),
		};
	});

	const mechanism2d = shown2d && mechanisms.get(shown2d.name);

	return (
		<div data-capture-pending={view === '3d' && loading ? '' : undefined} className="h-full p-2">
			<div className="relative flex size-full items-center justify-center [container-type:size]">
				{view === '3d' ? (
					<Scene3d ref={scene} label="Robot">
						{robot}
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
				{legend.length > 0 && (
					// Over the robot's top-left corner, so the robot is centered and the legend only covers its rows
					<div className="absolute top-1.5 left-1.5 max-h-1/2 w-fit max-w-1/2 overflow-y-auto rounded-md bg-background px-1.5">
						<Legend items={legend} vertical roles={view === '3d'} />
					</div>
				)}
				{/* Along the bottom, letting drags between the controls through to the 3D view */}
				<div className="pointer-events-none absolute inset-x-1.5 bottom-1.5 flex items-end gap-2 *:pointer-events-auto">
					<ViewToggle view={view} onChange={(next) => setOption('view', next)} />
					{view === '3d' && robotNote !== undefined && (
						<span className="flex min-w-0 items-center gap-2 rounded-md bg-background px-1.5 text-muted-foreground text-xs">
							{robotNote}
						</span>
					)}
					{view === '3d' && (
						<Button
							variant="ghost"
							size="xs"
							className="ms-auto bg-background capture:invisible"
							onClick={() => scene.current?.reset()}
						>
							<HouseIcon />
							Reset view
						</Button>
					)}
				</div>
			</div>
		</div>
	);
}
