import DatabaseIcon from 'lucide-react/icons/database';
import { getEntry, useDataVersion, useEntries } from '@/data/data-store';
import { useSource } from '@/data/source';
import { useCursorTime } from '@/timeline/timeline';
import { findController, hasControllerData, readController } from '@/widgets/controller/data';
import { height, layouts, width } from '@/widgets/controller/layouts';
import { Dpad, FaceButtons, MenuButton, Shoulder, Stick } from '@/widgets/controller/shapes';
import { WidgetEmpty } from '@/widgets/widget-empty';
import type { WidgetProps } from '@/widgets/widget-type';

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
			className={showAxisValues ? 'min-h-16 w-full' : 'size-full p-3'}
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
			<path d={shape.body} strokeLinejoin="round" className="fill-muted stroke-border" />
			{shape.touchpad && (
				<rect x={134} y={60} width={92} height={50} rx={8} className="fill-surface-bright stroke-border" />
			)}
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
		<div className="@container flex size-full flex-col items-center justify-center-safe gap-2 overflow-auto p-3">
			{drawing}
			<dl className="grid w-full max-w-64 shrink-0 grid-cols-2 gap-x-3 border-t pt-2 text-xs @md:max-w-72 @md:text-sm @2xl:max-w-80 @2xl:text-base">
				{(
					[
						['Left', axes.leftX, axes.leftY, shape.triggers[0], axes.leftTrigger],
						['Right', axes.rightX, axes.rightY, shape.triggers[1], axes.rightTrigger],
					] as const
				).map(([side, x, y, trigger, value]) => (
					<div key={side}>
						<dt className="font-medium">{side}</dt>
						<dd className="flex flex-wrap gap-x-2 text-muted-foreground">
							<span className="whitespace-nowrap">
								X{' '}
								<span className="inline-block min-w-[5ch] text-end font-mono text-foreground">
									{stickValue.format(x)}
								</span>
							</span>
							<span className="whitespace-nowrap">
								Y{' '}
								<span className="inline-block min-w-[5ch] text-end font-mono text-foreground">
									{stickValue.format(y)}
								</span>
							</span>
						</dd>
						<dd className="text-muted-foreground">
							{trigger} <span className="font-mono text-foreground">{value.toFixed(2)}</span>
						</dd>
					</div>
				))}
			</dl>
		</div>
	);
}
