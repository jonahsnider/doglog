// The row under the field widget: the cursor position and tool buttons
import { HStack } from '@astryxdesign/core/Layout';
import { ToggleButton } from '@astryxdesign/core/ToggleButton';
import { Tooltip } from '@astryxdesign/core/Tooltip';
import { InlineShortcut } from '@/components/shortcut';
import { TooltipLabel } from '@/components/tooltip-label';
import { cn } from '@/lib/utils';
import type { FieldPoint } from '@/widgets/field/geometry';
import type { FieldTool } from '@/widgets/field/pencil';

const tools: readonly { tool: FieldTool; key: 'M' | 'A' | 'P'; label: string; hint: string }[] = [
	{ tool: 'distance', key: 'M', label: 'Distance', hint: 'Drag to measure distance, hold Shift to snap to 45°' },
	{ tool: 'angle', key: 'A', label: 'Angle', hint: 'Drag to measure the angle from +X, hold Shift to snap to 45°' },
	{ tool: 'pencil', key: 'P', label: 'Pencil', hint: 'Drag to sketch a line on the field' },
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
			<InlineShortcut hotkey="Mod+C" />
		</span>
	);
}

export function ToolButtons({
	tool,
	onToggle,
	measure = true,
}: {
	tool: FieldTool | undefined;
	onToggle: (tool: FieldTool) => void;
	measure?: boolean;
}) {
	return (
		<div
			className={cn(
				'flex gap-1 transition-opacity duration-150 motion-reduce:transition-none',
				tool === undefined && hiddenWhileIdle,
			)}
		>
			{tools
				.filter((option) => measure || option.tool === 'pencil')
				.map((option) => (
					<Tooltip key={option.tool} content={<TooltipLabel label={option.hint} shortcut={option.key} />}>
						<ToggleButton
							label={option.label}
							size="sm"
							aria-keyshortcuts={option.key}
							isPressed={tool === option.tool}
							onPressedChange={() => onToggle(option.tool)}
						>
							<HStack gap={1} vAlign="center">
								<InlineShortcut hotkey={option.key} />
								{option.label}
							</HStack>
						</ToggleButton>
					</Tooltip>
				))}
		</div>
	);
}
