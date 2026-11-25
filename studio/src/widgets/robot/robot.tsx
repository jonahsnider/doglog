import { colorVars, radiusVars, spacingVars, typeScaleVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import BoxesIcon from 'lucide-react/icons/boxes';
import DatabaseIcon from 'lucide-react/icons/database';
import HouseIcon from 'lucide-react/icons/house';
import ListPlusIcon from 'lucide-react/icons/list-plus';
import SplineIcon from 'lucide-react/icons/spline';
import { useRef } from 'react';
import { Button } from '@astryxdesign/core/Button';
import type { Entry } from '@/data/data-store';
import { useSource } from '@/data/source';
import { Mechanism3d } from '@/three/mechanism-3d';
import { Scene3d, type Scene3dHandle } from '@/three/scene';
import { useCursorTime } from '@/timeline/timeline';
import { Legend, type LegendItem } from '@/widgets/legend/legend';
import { MechanismCanvas } from '@/widgets/robot/mechanism-2d';
import { usePickedRobot } from '@/widgets/robot/picked-robot';
import { mechanismPlane } from '@/widgets/robot/roles';
import { SceneControls } from '@/widgets/scene-controls';
import { useMechanisms } from '@/widgets/use-mechanisms';
import { useSceneControls } from '@/widgets/use-scene-controls';
import { defaultRobot } from '@/widgets/robot/robot-option';
import { type View, ViewToggle } from '@/widgets/view-toggle';
import { WidgetEmpty } from '@/widgets/widget-empty';
import type { WidgetBinding, WidgetProps } from '@/widgets/widget-type';

const styles = stylex.create({
	root: { height: '100%', padding: spacingVars['--spacing-2'] },
	stage: {
		position: 'relative',
		display: 'flex',
		width: '100%',
		height: '100%',
		alignItems: 'center',
		justifyContent: 'center',
		containerType: 'size',
	},
	view: { display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
	overlay: {
		pointerEvents: 'none',
		position: 'absolute',
		inset: 0,
		display: 'flex',
		flexDirection: 'column',
		paddingInline: spacingVars['--spacing-1-5'],
		paddingBottom: spacingVars['--spacing-10'],
	},
	legend: {
		pointerEvents: 'auto',
		flexShrink: 0,
		width: 'fit-content',
		maxWidth: '50%',
		maxHeight: '50%',
		marginTop: spacingVars['--spacing-1-5'],
		overflowY: 'auto',
		paddingInline: spacingVars['--spacing-1-5'],
		borderRadius: radiusVars['--radius-element'],
		backgroundColor: colorVars['--color-background-surface'],
	},
	// Along the bottom, letting drags between the controls through to the 3D view
	controls: {
		pointerEvents: 'none',
		position: 'absolute',
		insetInline: spacingVars['--spacing-1-5'],
		bottom: spacingVars['--spacing-1-5'],
		display: 'flex',
		alignItems: 'flex-end',
		gap: spacingVars['--spacing-2'],
	},
	control: { pointerEvents: 'auto' },
	note: {
		display: 'flex',
		minWidth: 0,
		alignItems: 'center',
		gap: spacingVars['--spacing-2'],
		paddingInline: spacingVars['--spacing-1-5'],
		borderRadius: radiusVars['--radius-element'],
		backgroundColor: colorVars['--color-background-surface'],
		color: colorVars['--color-text-secondary'],
		fontSize: typeScaleVars['--text-supporting-size'],
		lineHeight: '1rem',
	},
	reset: { marginInlineStart: 'auto' },
	icon: { width: 14, height: 14 },
});

const mechanismIcon = <SplineIcon {...stylex.props(styles.icon)} />;
const partsIcon = <BoxesIcon {...stylex.props(styles.icon)} />;

function isMechanism(binding: WidgetBinding): boolean {
	return binding.entry?.kind === 'mechanism2d';
}

function hasValue(entry: Entry | undefined, time: number | undefined): boolean {
	return entry !== undefined && time !== undefined && entry.samples.valueAt(time) !== undefined;
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
	const unbound = bindings.length === 0;
	const controls = useSceneControls(unbound);

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
		<div data-capture-pending={view === '3d' && loading ? '' : undefined} {...stylex.props(styles.root)}>
			<div {...stylex.props(styles.stage)}>
				<div {...stylex.props(styles.view)} {...(view === '3d' && controls.handlers)}>
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
				</div>
				<div {...stylex.props(styles.overlay)}>
					{legend.length > 0 && (
						<div {...stylex.props(styles.legend)}>
							<Legend items={legend} vertical roles={view === '3d'} />
						</div>
					)}
					{unbound && view === '3d' && <SceneControls view="3d" visible={controls.visible} />}
				</div>
				<div {...stylex.props(styles.controls)}>
					<ViewToggle
						xstyle={styles.control}
						view={view}
						onChange={(next) => {
							controls.input();
							setOption('view', next);
						}}
					/>
					{view === '3d' && robotNote !== undefined && (
						<span {...stylex.props(styles.control, styles.note)}>{robotNote}</span>
					)}
					{view === '3d' && (
						<Button
							label="Reset view"
							icon={<HouseIcon />}
							size="sm"
							xstyle={[styles.control, styles.reset]}
							className="capture-invisible"
							onClick={() => {
								controls.input();
								scene.current?.reset();
							}}
						/>
					)}
				</div>
			</div>
		</div>
	);
}
