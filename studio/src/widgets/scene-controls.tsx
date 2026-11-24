import { Kbd } from '@/components/ui/kbd';
import { useMediaQuery } from '@/hooks/use-media-query';
import { cn } from '@/lib/utils';
import { sceneKeys } from '@/three/scene-keys';
import type { View } from '@/widgets/view-toggle';

const touchGestures = {
	'2d': [['Pan', 'Drag when zoomed']],
	'3d': [
		['Orbit', '1-finger drag'],
		['Pan', '2-finger drag'],
		['Zoom', 'Pinch'],
	],
} as const;

// Mouse and trackpad share these gestures, so there's no need for separate lists.
const pointerGestures = (panRight: string) =>
	({
		'2d': [
			['Pan', 'Drag when zoomed'],
			['Zoom', 'Scroll'],
			['Reset', 'Double-click'],
		],
		'3d': [
			[
				'Orbit',
				<>
					Drag or <Kbd aria-label="Arrow keys">↑ ↓ ← →</Kbd>
				</>,
			],
			[
				'Pan',
				<>
					<Kbd>Shift</Kbd> + drag or <Kbd>A {panRight} Q E</Kbd>
				</>,
			],
			[
				'Zoom',
				<>
					Scroll or <Kbd>W S</Kbd>
				</>,
			],
		],
	}) as const;

export function SceneControls({
	view,
	visible,
	disabled = false,
	scene = 'robot',
	className,
}: {
	view: View;
	visible: boolean;
	disabled?: boolean;
	scene?: keyof typeof sceneKeys;
	className?: string;
}) {
	const touch = useMediaQuery('(pointer: coarse)');
	if (disabled) {
		return null;
	}
	const gestures = (touch ? touchGestures : pointerGestures(sceneKeys[scene].panRight))[view];
	return (
		<div
			className={cn(
				'pointer-events-none @container flex min-h-0 flex-1 items-end overflow-hidden capture:hidden',
				className,
			)}
			aria-hidden={!visible}
		>
			<div
				className={cn(
					'max-w-full rounded-md border border-border bg-popover px-2 py-1 text-popover-foreground text-xs @max-[9rem]:hidden motion-safe:transition-opacity',
					visible ? 'opacity-100 ease-out' : 'opacity-0 duration-100 ease-in',
				)}
			>
				<dl
					aria-label={`${view.toUpperCase()} view controls`}
					className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-2 gap-y-0.5 [&_kbd]:h-4"
				>
					{gestures.map(([action, input]) => (
						<div key={action} className="col-span-2 grid grid-cols-subgrid">
							<dt className="font-medium">{action}</dt>
							<dd>{input}</dd>
						</div>
					))}
				</dl>
			</div>
		</div>
	);
}
