import { colorVars, fontWeightVars, typographyVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import { useId } from 'react';
import type { ControllerButton, ControllerState } from '@/widgets/controller/data';
import { type LayoutShape, type Point, width } from '@/widgets/controller/layouts';

/** The top of a trigger, peeking out above the bumper like it does when looking at a controller's front */
const trigger = {
	path: 'M 68 60 C 67 40 78 26 98 25 C 118 24 131 34 132 48 L 130 60 Z',
	/** The trigger's outer and inner ends, its fill grows from the outer end as it's pressed */
	outer: 67,
	inner: 132,
	top: 24,
	label: [99, 16] as Point,
};
const bumper = {
	// The top edge shows above the body's shoulder, the rest is tucked behind the body
	path: 'M 44 78 C 56 56 80 42 110 41 C 130 41 146 45 158 50 L 156 62 L 52 80 Z',
	label: [110, 46.5] as Point,
};

const faceSpacing = 26;
const faceRadius = 12;
const stickWell = 26;
const stickCap = 15;
/** How far a stick's cap moves from its center when the stick is pushed all the way */
const stickTravel = stickWell - stickCap;
const dpadArm = { half: 8, reach: 24, corner: 3 };
const dpadWell = 31;

const styles = stylex.create({
	/** Buttons stand out from the body, the wells around sticks and the D-pad sink into it */
	raised: { fill: 'var(--md-surface-bright)', stroke: colorVars['--color-border'] },
	recessed: { fill: colorVars['--color-background-body'], stroke: colorVars['--color-border'] },
	pressed: { fill: colorVars['--color-accent'], stroke: colorVars['--color-accent'] },
	shell: { fill: colorVars['--color-background-muted'], stroke: colorVars['--color-border'] },
	outline: { fill: 'none', stroke: colorVars['--color-border'] },
	accentFill: { fill: colorVars['--color-accent'] },
	accentStroke: { stroke: colorVars['--color-accent'] },
	glyph: { fill: 'none', stroke: colorVars['--color-text-secondary'] },
	glyphPressed: { stroke: colorVars['--color-on-accent'] },
	mark: { fill: colorVars['--color-text-secondary'] },
	markPressed: { fill: colorVars['--color-on-accent'] },
	label: {
		pointerEvents: 'none',
		fontFamily: typographyVars['--font-family-body'],
		fontWeight: fontWeightVars['--font-weight-semibold'],
	},
});

/** Draws the left side's shoulder controls on the right */
const mirror = `matrix(-1 0 0 1 ${width} 0)`;

const faceButtons: readonly (readonly [ControllerButton, Point])[] = [
	['faceUp', [0, -1]],
	['faceRight', [1, 0]],
	['faceDown', [0, 1]],
	['faceLeft', [-1, 0]],
];
const dpadDirections: readonly (readonly [ControllerButton, Point])[] = [
	['up', [0, -1]],
	['right', [1, 0]],
	['down', [0, 1]],
	['left', [-1, 0]],
];

/** PlayStation face button symbols, drawn instead of text since fonts draw them at different sizes */
const symbolPaths: Partial<Record<string, string>> = {
	'△': 'M 0 -5 L 5.5 4 H -5.5 Z',
	'○': 'M -5 0 A 5 5 0 1 0 5 0 A 5 5 0 1 0 -5 0',
	'✕': 'M -4.5 -4.5 L 4.5 4.5 M 4.5 -4.5 L -4.5 4.5',
	'□': 'M -4.5 -4.5 H 4.5 V 4.5 H -4.5 Z',
};

function Label({ at, pressed, size = 10, children }: { at: Point; pressed: boolean; size?: number; children: string }) {
	return (
		<text
			x={at[0]}
			y={at[1]}
			fontSize={size}
			textAnchor="middle"
			dominantBaseline="central"
			{...stylex.props(styles.label, styles.mark, pressed && styles.markPressed)}
		>
			{children}
		</text>
	);
}

export function FaceButtons({
	center,
	glyphs,
	state,
}: {
	center: Point;
	glyphs: LayoutShape['faceGlyphs'];
	state: ControllerState;
}) {
	return faceButtons.map(([button, [dx, dy]], index) => {
		const pressed = state.pressed.has(button);
		const at: Point = [center[0] + dx * faceSpacing, center[1] + dy * faceSpacing];
		const glyph = glyphs[index]!;
		const symbol = symbolPaths[glyph];
		return (
			<g key={button}>
				<circle cx={at[0]} cy={at[1]} r={faceRadius} {...stylex.props(pressed ? styles.pressed : styles.raised)} />
				{symbol === undefined ? (
					<Label at={at} pressed={pressed} size={11}>
						{glyph}
					</Label>
				) : (
					<path
						d={symbol}
						transform={`translate(${at[0]} ${at[1]})`}
						strokeLinejoin="round"
						strokeLinecap="round"
						{...stylex.props(styles.glyph, pressed && styles.glyphPressed)}
					/>
				)}
			</g>
		);
	});
}

/** A plus-shaped D-pad in a round well, each arm filled while pressed and marked with an arrow */
export function Dpad({ center: [cx, cy], state }: { center: Point; state: ControllerState }) {
	const { half: h, reach: r, corner: c } = dpadArm;
	// Arms have rounded ends, traced clockwise from the top arm's left side
	const end = `A ${c} ${c} 0 0 1`;
	const outline = [
		`M ${-h} ${-r + c} ${end} ${-h + c} ${-r} H ${h - c} ${end} ${h} ${-r + c} V ${-h}`,
		`H ${r - c} ${end} ${r} ${-h + c} V ${h - c} ${end} ${r - c} ${h} H ${h}`,
		`V ${r - c} ${end} ${h - c} ${r} H ${-h + c} ${end} ${-h} ${r - c} V ${h}`,
		`H ${-r + c} ${end} ${-r} ${h - c} V ${-h + c} ${end} ${-r + c} ${-h} H ${-h} Z`,
	].join(' ');
	return (
		<g transform={`translate(${cx} ${cy})`}>
			<circle r={dpadWell} {...stylex.props(styles.recessed)} />
			<path d={outline} strokeLinejoin="round" {...stylex.props(styles.raised)} />
			{dpadDirections.map(([direction, [dx, dy]]) => {
				const pressed = state.pressed.has(direction);
				// Arms point up before rotating, so one shape serves every direction
				const angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
				return (
					<g key={direction} transform={`rotate(${angle})`}>
						{pressed && (
							<rect
								x={-h + 1.5}
								y={-r + 1.5}
								width={h * 2 - 3}
								height={r - h - 1.5}
								rx={c - 1}
								{...stylex.props(styles.accentFill)}
							/>
						)}
						<path
							d={`M 0 ${-r + 6} L 3.5 ${-r + 11} H -3.5 Z`}
							{...stylex.props(styles.mark, pressed && styles.markPressed)}
						/>
					</g>
				);
			})}
		</g>
	);
}

export function Stick({ center, x, y, pressed }: { center: Point; x: number; y: number; pressed: boolean }) {
	// Sticks report a square range on some controllers, the cap stays inside the well
	const scale = 1 / Math.max(1, Math.hypot(x, y));
	const cap: Point = [center[0] + x * scale * stickTravel, center[1] + y * scale * stickTravel];
	const guide = stickWell - 6;
	return (
		<g>
			<circle
				cx={center[0]}
				cy={center[1]}
				r={stickWell}
				{...stylex.props(styles.recessed, pressed && styles.accentStroke)}
			/>
			{/* Crosshairs show where the stick rests, so small pushes are visible */}
			<path
				d={`M ${center[0] - guide} ${center[1]} H ${center[0] + guide} M ${center[0]} ${center[1] - guide} V ${center[1] + guide}`}
				strokeWidth={1}
				{...stylex.props(styles.outline)}
			/>
			<circle cx={cap[0]} cy={cap[1]} r={stickCap} {...stylex.props(pressed ? styles.pressed : styles.raised)} />
			<circle
				cx={cap[0]}
				cy={cap[1]}
				r={stickCap - 5}
				{...stylex.props(styles.outline, pressed && styles.glyphPressed)}
			/>
		</g>
	);
}

/** A trigger and bumper on the left, or mirrored onto the right */
export function Shoulder({
	side,
	trigger: value,
	bumperPressed,
	labels: [triggerLabel, bumperLabel],
}: {
	side: 'left' | 'right';
	trigger: number;
	bumperPressed: boolean;
	labels: readonly [string, string];
}) {
	const clipId = useId();
	const pressed = Math.min(1, Math.max(0, value));
	// Labels are placed after mirroring so their text isn't flipped
	const labelX = (left: number) => (side === 'left' ? left : width - left);
	return (
		<g>
			<g transform={side === 'left' ? undefined : mirror}>
				<clipPath id={clipId}>
					<path d={trigger.path} />
				</clipPath>
				<path d={trigger.path} strokeLinejoin="round" {...stylex.props(styles.shell)} />
				{pressed > 0 && (
					<rect
						x={trigger.outer}
						y={trigger.top}
						width={pressed * (trigger.inner - trigger.outer)}
						height={36}
						clipPath={`url(#${clipId})`}
						{...stylex.props(styles.accentFill)}
					/>
				)}
				<path d={trigger.path} strokeLinejoin="round" {...stylex.props(styles.outline)} />
				<path d={bumper.path} strokeLinejoin="round" {...stylex.props(bumperPressed ? styles.pressed : styles.shell)} />
			</g>
			<Label at={[labelX(trigger.label[0]), trigger.label[1]]} pressed={false} size={9}>
				{triggerLabel}
			</Label>
			<Label at={[labelX(bumper.label[0]), bumper.label[1]]} pressed={bumperPressed} size={8}>
				{bumperLabel}
			</Label>
		</g>
	);
}

/** Xbox controllers mark Back with overlapping windows and Start with a menu */
const menuIcons = {
	back: 'M -3.5 -1 H 1 V 3.5 H -3.5 Z M -1 -1 V -3.5 H 3.5 V 1 H 1',
	start: 'M -3.5 -2.5 H 3.5 M -3.5 0 H 3.5 M -3.5 2.5 H 3.5',
};

export function MenuButton({
	center: [cx, cy],
	shape,
	button,
	pressed,
	label,
}: {
	center: Point;
	shape: LayoutShape['menuShape'];
	button: 'back' | 'start';
	pressed: boolean;
	label: string;
}) {
	const surface = stylex.props(pressed ? styles.pressed : styles.raised);
	return shape === 'circle' ? (
		<g>
			<title>{label}</title>
			<circle cx={cx} cy={cy} r={8} {...surface} />
			<path
				d={menuIcons[button]}
				transform={`translate(${cx} ${cy})`}
				strokeWidth={1.2}
				strokeLinejoin="round"
				strokeLinecap="round"
				{...stylex.props(styles.glyph, pressed && styles.glyphPressed)}
			/>
		</g>
	) : (
		<rect x={cx - 4} y={cy - 8} width={8} height={16} rx={4} {...surface}>
			<title>{label}</title>
		</rect>
	);
}
