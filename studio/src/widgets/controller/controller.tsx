import {
	colorVars,
	fontWeightVars,
	spacingVars,
	typeScaleVars,
	typographyVars,
} from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import DatabaseIcon from 'lucide-react/icons/database';
import { getEntry, useDataVersion, useEntries } from '@/data/data-store';
import { useSource } from '@/data/source';
import { useCursorTime } from '@/timeline/timeline';
import { findController, hasControllerData, readController } from '@/widgets/controller/data';
import { height, layouts, width } from '@/widgets/controller/layouts';
import { Dpad, FaceButtons, MenuButton, Shoulder, Stick } from '@/widgets/controller/shapes';
import { WidgetEmpty } from '@/widgets/widget-empty';
import type { WidgetProps } from '@/widgets/widget-type';

const md = '@container (min-width: 28rem)';
const xl = '@container (min-width: 42rem)';

const styles = stylex.create({
	drawing: {
		width: '100%',
		height: '100%',
		padding: spacingVars['--spacing-3'],
	},
	drawingWithValues: {
		minHeight: '4rem',
		width: '100%',
	},
	shell: { fill: colorVars['--color-background-muted'], stroke: colorVars['--color-border'] },
	touchpad: { fill: colorVars['--color-background-surface'], stroke: colorVars['--color-border'] },
	container: {
		containerType: 'inline-size',
		display: 'flex',
		width: '100%',
		height: '100%',
		flexDirection: 'column',
		alignItems: 'center',
		justifyContent: 'safe center',
		gap: spacingVars['--spacing-2'],
		overflow: 'auto',
		padding: spacingVars['--spacing-3'],
	},
	values: {
		display: 'grid',
		width: '100%',
		maxWidth: { default: '16rem', [md]: '18rem', [xl]: '20rem' },
		flexShrink: 0,
		gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
		columnGap: spacingVars['--spacing-3'],
		borderTopWidth: 1,
		borderTopStyle: 'solid',
		borderTopColor: colorVars['--color-border'],
		paddingTop: spacingVars['--spacing-2'],
		fontSize: {
			default: typeScaleVars['--text-supporting-size'],
			[md]: typeScaleVars['--text-label-size'],
			[xl]: typeScaleVars['--text-large-size'],
		},
		lineHeight: { default: '1rem', [md]: '1.25rem', [xl]: '1.5rem' },
	},
	side: {
		fontWeight: fontWeightVars['--font-weight-medium'],
	},
	axes: {
		display: 'flex',
		flexWrap: 'wrap',
		columnGap: spacingVars['--spacing-2'],
	},
	secondary: {
		color: colorVars['--color-text-secondary'],
	},
	axis: {
		whiteSpace: 'nowrap',
	},
	value: {
		fontFamily: typographyVars['--font-family-code'],
		color: colorVars['--color-text-primary'],
	},
	stickValue: {
		display: 'inline-block',
		minWidth: '5ch',
		textAlign: 'end',
	},
});

const stickValue = new Intl.NumberFormat('en-US', {
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
	signDisplay: 'exceptZero',
});

export function Controller({ options }: WidgetProps) {
	const source = useSource();
	// Controllers are found by entry name, they change when entries are added
	useEntries();
	// Inputs at the cursor change as samples arrive
	useDataVersion();
	const time = useCursorTime();

	const port = Number(options['controller']);
	const controller = findController(port, getEntry);
	if (!source) {
		return <WidgetEmpty icon={<DatabaseIcon />} title="No data" description="Open a log or connect to a robot." />;
	}
	if (!hasControllerData(controller)) {
		return (
			<WidgetEmpty
				icon={<DatabaseIcon />}
				title="No data"
				description={`The current source doesn't have controller ${port}.`}
			/>
		);
	}

	const layout = options['layout'] === 'playstation' ? 'playstation' : 'xbox';
	const shape = layouts[layout];
	const state = readController(controller!, layout, time);
	const { axes, pressed } = state;
	const showAxisValues = options['axisValues'] === 'on';
	const drawing = (
		<svg
			{...stylex.props(showAxisValues ? styles.drawingWithValues : styles.drawing)}
			viewBox={`0 0 ${width} ${height}`}
			role="img"
			aria-label={`Controller ${port}`}
			strokeWidth={1.5}
		>
			<Shoulder
				side="left"
				trigger={axes.leftTrigger}
				bumperPressed={pressed.has('leftBumper')}
				labels={[shape.triggers[0], shape.bumpers[0]]}
			/>
			<Shoulder
				side="right"
				trigger={axes.rightTrigger}
				bumperPressed={pressed.has('rightBumper')}
				labels={[shape.triggers[1], shape.bumpers[1]]}
			/>
			<path d={shape.body} strokeLinejoin="round" {...stylex.props(styles.shell)} />
			{shape.touchpad && <rect x={134} y={60} width={92} height={50} rx={8} {...stylex.props(styles.touchpad)} />}
			<MenuButton
				center={shape.back}
				shape={shape.menuShape}
				button="back"
				pressed={pressed.has('back')}
				label={shape.menuLabels[0]}
			/>
			<MenuButton
				center={shape.start}
				shape={shape.menuShape}
				button="start"
				pressed={pressed.has('start')}
				label={shape.menuLabels[1]}
			/>
			<Stick center={shape.leftStick} x={axes.leftX} y={axes.leftY} pressed={pressed.has('leftStick')} />
			<Stick center={shape.rightStick} x={axes.rightX} y={axes.rightY} pressed={pressed.has('rightStick')} />
			<Dpad center={shape.dpad} state={state} />
			<FaceButtons center={shape.face} glyphs={shape.faceGlyphs} state={state} />
		</svg>
	);
	if (!showAxisValues) {
		return drawing;
	}

	return (
		<div {...stylex.props(styles.container)}>
			{drawing}
			<dl {...stylex.props(styles.values)}>
				{(
					[
						['Left', axes.leftX, axes.leftY, shape.triggers[0], axes.leftTrigger],
						['Right', axes.rightX, axes.rightY, shape.triggers[1], axes.rightTrigger],
					] as const
				).map(([side, x, y, trigger, value]) => (
					<div key={side}>
						<dt {...stylex.props(styles.side)}>{side}</dt>
						<dd {...stylex.props(styles.axes, styles.secondary)}>
							<span {...stylex.props(styles.axis)}>
								X <span {...stylex.props(styles.value, styles.stickValue)}>{stickValue.format(x)}</span>
							</span>
							<span {...stylex.props(styles.axis)}>
								Y <span {...stylex.props(styles.value, styles.stickValue)}>{stickValue.format(y)}</span>
							</span>
						</dd>
						<dd {...stylex.props(styles.secondary)}>
							{trigger} <span {...stylex.props(styles.value)}>{value.toFixed(2)}</span>
						</dd>
					</div>
				))}
			</dl>
		</div>
	);
}
