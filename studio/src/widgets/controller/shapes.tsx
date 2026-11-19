import { useId } from 'react';
import { cn } from '@/lib/utils';
import type { ControllerButton, ControllerState } from '@/widgets/controller/data';
import { type LayoutShape, type Point, width } from '@/widgets/controller/layouts';

/** A trigger's front, wider at its rounded top, leaning outward from its pivot behind the bumper */
const trigger = {
	path: 'M 90 58 L 84 18 C 83 9 90 4 101 4 L 109 4 C 120 4 126 9 125 18 L 118 58 Z',
	pivot: [104, 56] as Point,
	lean: -10,
	top: 4,
	/** Where the bumper covers the whole width of the trigger, the bottom of its fill */
	visibleBottom: 56,
	/** How far a trigger moves down when it's pressed all the way */
	travel: 6,
	labelHeight: 36,
};
const bumperPath =
	// The top edge shows above the body's shoulder, the rest is tucked behind the body
	'M 56 80 C 62 62 86 52 112 50 C 134 49 150 51 166 55 L 164 70 C 140 66 124 66 104 68 C 84 70 70 78 64 90 Z';

const faceSpacing = 23;
const faceRadius = 11;
const stickWell = 24;
const stickCap = 13;
/** How far a stick's cap moves from its center when the stick is pushed all the way */
const stickTravel = stickWell - stickCap;
const dpadArm = { width: 15, reach: 23 };

const releasedFill = 'fill-background stroke-border';
const pressedFill = 'fill-primary stroke-primary';

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

function Label({ at, pressed, size = 10, children }: { at: Point; pressed: boolean; size?: number; children: string }) {
	return (
		<text
			x={at[0]}
			y={at[1]}
			fontSize={size}
			textAnchor="middle"
			dominantBaseline="central"
			className={cn(
				'pointer-events-none font-sans font-medium',
				pressed ? 'fill-primary-foreground' : 'fill-muted-foreground',
			)}
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
		return (
			<g key={button}>
				<circle cx={at[0]} cy={at[1]} r={faceRadius} className={pressed ? pressedFill : releasedFill} />
				<Label at={at} pressed={pressed}>
					{glyphs[index]!}
				</Label>
			</g>
		);
	});
}

/** A plus-shaped D-pad, each arm filled while pressed and marked with an arrow */
export function Dpad({ center: [cx, cy], state }: { center: Point; state: ControllerState }) {
	const half = dpadArm.width / 2;
	const { reach } = dpadArm;
	const outline = `M ${-half} ${-reach} H ${half} V ${-half} H ${reach} V ${half} H ${half} V ${reach} H ${-half} V ${half} H ${-reach} V ${-half} H ${-half} Z`;
	return (
		<g transform={`translate(${cx} ${cy})`}>
			<path d={outline} strokeLinejoin="round" className={releasedFill} />
			{dpadDirections.map(([direction, [dx, dy]]) => {
				const pressed = state.pressed.has(direction);
				// Arms point up before rotating, so one shape serves every direction
				const angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
				return (
					<g key={direction} transform={`rotate(${angle})`}>
						{pressed && (
							<rect
								x={-half + 1}
								y={-reach + 1}
								width={dpadArm.width - 2}
								height={reach - half}
								rx={2}
								className="fill-primary"
							/>
						)}
						<path
							d={`M 0 ${-reach + 5} L 3.5 ${-reach + 10} H -3.5 Z`}
							className={pressed ? 'fill-primary-foreground' : 'fill-muted-foreground'}
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
	return (
		<g>
			<circle
				cx={center[0]}
				cy={center[1]}
				r={stickWell}
				className={cn('fill-background', pressed ? 'stroke-primary' : 'stroke-border')}
			/>
			<circle cx={cap[0]} cy={cap[1]} r={stickCap} className={pressed ? pressedFill : 'fill-muted stroke-border'} />
			<circle
				cx={cap[0]}
				cy={cap[1]}
				r={stickCap - 4}
				className={cn('fill-none', pressed ? 'stroke-primary-foreground/40' : 'stroke-border')}
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
	const fillTop = trigger.visibleBottom - pressed * (trigger.visibleBottom - trigger.top);
	const travel = pressed * trigger.travel;
	const [pivotX, pivotY] = trigger.pivot;
	// Labels are placed after mirroring so their text isn't flipped
	const labelX = (left: number) => (side === 'left' ? left : width - left);
	const lean = (trigger.lean * Math.PI) / 180;
	return (
		<g>
			<g transform={side === 'left' ? undefined : `matrix(-1 0 0 1 ${width} 0)`}>
				<g transform={`translate(0 ${travel}) rotate(${trigger.lean} ${pivotX} ${pivotY})`}>
					<clipPath id={clipId}>
						<path d={trigger.path} />
					</clipPath>
					<path d={trigger.path} strokeLinejoin="round" className="fill-muted stroke-border" />
					{pressed > 0 && (
						<rect
							x={pivotX - 30}
							y={fillTop}
							width={60}
							height={pivotY + 4 - fillTop}
							clipPath={`url(#${clipId})`}
							className="fill-primary"
						/>
					)}
					<path d={trigger.path} strokeLinejoin="round" className="fill-none stroke-border" />
				</g>
				<path
					d={bumperPath}
					strokeLinejoin="round"
					className={bumperPressed ? pressedFill : 'fill-muted stroke-border'}
				/>
			</g>
			<Label
				at={[
					labelX(pivotX + Math.sin(lean) * trigger.labelHeight),
					pivotY - Math.cos(lean) * trigger.labelHeight + travel,
				]}
				pressed={pressed >= 0.6}
			>
				{triggerLabel}
			</Label>
			<Label at={[labelX(112), 56]} pressed={bumperPressed} size={8}>
				{bumperLabel}
			</Label>
		</g>
	);
}

export function MenuButton({
	center: [cx, cy],
	shape,
	pressed,
	label,
}: {
	center: Point;
	shape: LayoutShape['menuShape'];
	pressed: boolean;
	label: string;
}) {
	const className = pressed ? pressedFill : releasedFill;
	return shape === 'circle' ? (
		<circle cx={cx} cy={cy} r={7} className={className}>
			<title>{label}</title>
		</circle>
	) : (
		<rect x={cx - 3.5} y={cy - 8} width={7} height={16} rx={3.5} className={className}>
			<title>{label}</title>
		</rect>
	);
}
