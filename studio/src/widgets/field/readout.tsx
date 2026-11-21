// The row under the field widget: the cursor position and the measuring tool buttons
import { useFormatForDisplay } from '@tanstack/react-hotkeys';
import { ControlTooltip } from '@/components/control-tooltip';
import { Kbd } from '@/components/ui/kbd';
import { Toggle } from '@/components/ui/toggle';
import { cn } from '@/lib/utils';
import type { FieldPoint, MeasureTool } from '@/widgets/field/geometry';

const tools: readonly { tool: MeasureTool; key: 'M' | 'A'; label: string; hint: string }[] = [
	{ tool: 'distance', key: 'M', label: 'Distance', hint: 'Drag to measure distance, hold Shift to snap to 45°' },
	{ tool: 'angle', key: 'A', label: 'Angle', hint: 'Drag to measure the angle from +X, hold Shift to snap to 45°' },
];

/** Hides controls under the field while it isn't hovered or focused, on devices that can hover */
export const hiddenWhileIdle =
	'transition-opacity duration-150 motion-reduce:transition-none [@media(hover:hover)]:group-[:not(:hover,:focus-within)]/field:opacity-0 [@media(hover:hover)]:group-[:not(:hover,:focus-within)]/field:duration-100';

export function CursorPosition({
	pointer,
	hovered,
	copied,
}: {
	pointer: FieldPoint | undefined;
	hovered: boolean;
	copied: boolean;
}) {
	const formatForDisplay = useFormatForDisplay();
	return (
		<span
			className={cn(
				'flex items-center gap-1.5 transition-opacity duration-150 motion-reduce:transition-none',
				hovered || copied ? 'opacity-100' : 'opacity-0 duration-100',
			)}
		>
			<span
				className={cn(
					'-ms-1 grid rounded-md px-1 py-0.5 transition-[background-color,color] duration-150',
					copied && 'bg-accent text-accent-foreground',
				)}
			>
				{/* Both stay rendered so the label keeps the position's width while they cross-fade */}
				<span
					className={cn(
						'font-mono tabular-nums transition-opacity duration-150 [grid-area:1/1]',
						copied && 'opacity-0',
					)}
				>
					{pointer && `X ${pointer.x.toFixed(2)} m  Y ${pointer.y.toFixed(2)} m`}
				</span>
				<span
					className={cn(
						'text-center font-medium transition-opacity duration-150 [grid-area:1/1]',
						!copied && 'opacity-0',
					)}
				>
					Copied
				</span>
			</span>
			<Kbd className="h-4 min-w-4">{formatForDisplay('Mod+C')}</Kbd>
		</span>
	);
}

export function ToolButtons({
	tool,
	onToggle,
}: {
	tool: MeasureTool | undefined;
	onToggle: (tool: MeasureTool) => void;
}) {
	return (
		<div
			className={cn(
				'flex gap-1 transition-opacity duration-150 motion-reduce:transition-none',
				tool === undefined && hiddenWhileIdle,
			)}
		>
			{tools.map((option) => (
				<ControlTooltip
					key={option.tool}
					label={option.hint}
					render={
						<Toggle
							className="h-5 gap-1 rounded-md border-0 px-1 text-xs sm:h-5 sm:text-xs"
							pressed={tool === option.tool}
							onPressedChange={() => onToggle(option.tool)}
						/>
					}
				>
					<>
						<Kbd className="h-4 min-w-4">{option.key}</Kbd>
						{option.label}
					</>
				</ControlTooltip>
			))}
		</div>
	);
}
