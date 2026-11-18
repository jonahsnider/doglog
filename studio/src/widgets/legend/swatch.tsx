import { CheckIcon } from 'lucide-react';
import { type RefObject, use, useRef, useState } from 'react';
import { Popover, PopoverPopup } from '@/components/ui/popover';
import { WidgetBindingsContext } from '@/entries/drag';
import { cn } from '@/lib/utils';
import { chartCount } from '@/theme/choices';
import { seriesColor } from '@/widgets/series-color';
import type { LegendItem } from '@/widgets/legend/legend';
import type { WidgetBinding } from '@/widgets/widget-type';

/** Picks one of the chart colors for the binding, or lets the widget pick one */
function ColorPicker({
	binding,
	anchor,
	open,
	onOpenChange,
	onPick,
}: {
	binding: WidgetBinding;
	anchor: RefObject<HTMLButtonElement | null>;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onPick: (color: number | undefined) => void;
}) {
	const popup = useRef<HTMLDivElement>(null);
	return (
		<Popover open={open} onOpenChange={onOpenChange}>
			{/* Focus only goes back to the swatch after using the keyboard, so Space plays or pauses after picking with the mouse */}
			<PopoverPopup
				anchor={anchor}
				align="start"
				ref={popup}
				// Focusing the popup instead of Auto doesn't show a focus ring after right-clicking, Tab still reaches the colors
				initialFocus={popup}
				finalFocus={(closeType) => closeType === 'keyboard'}
				className="**:data-[slot=popover-viewport]:p-2"
				aria-label={`${binding.name} color`}
			>
				<button
					type="button"
					className="mb-1 flex w-full cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring"
					aria-pressed={binding.color === undefined}
					onClick={() => onPick(undefined)}
				>
					<CheckIcon className={cn('size-4', binding.color !== undefined && 'invisible')} />
					Auto
				</button>
				<div className="grid grid-cols-5 gap-0.5">
					{Array.from({ length: chartCount }, (_, index) => (
						<button
							key={index}
							type="button"
							className="flex size-7 cursor-pointer items-center justify-center rounded-full outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring aria-pressed:ring-2 aria-pressed:ring-foreground"
							aria-label={`Color ${index + 1}`}
							aria-pressed={binding.color === index}
							onClick={() => onPick(index)}
						>
							<span className="size-5 rounded-full" style={{ background: seriesColor(index) }} />
						</button>
					))}
				</div>
			</PopoverPopup>
		</Popover>
	);
}

/** Toggles whether the binding is hidden, right-clicking a colored swatch picks its color */
export function LegendSwatch({ item }: { item: LegendItem }) {
	const { binding } = item;
	const widget = use(WidgetBindingsContext);
	const swatch = useRef<HTMLButtonElement>(null);
	const [pickingColor, setPickingColor] = useState(false);
	return (
		<>
			{/* Hidden bindings show a hollow swatch, unlike dimmed ones that just have no value */}
			<button
				ref={swatch}
				type="button"
				// Clicked anywhere in the row's height, around the small swatch it shows
				className="-m-[6px] flex shrink-0 cursor-pointer rounded-full p-[6px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
				aria-label={`${binding.hidden ? 'Show' : 'Hide'} ${binding.name}`}
				aria-pressed={!binding.hidden}
				// Clicking doesn't focus it, so Space plays or pauses instead of toggling it again
				onMouseDown={(event) => event.preventDefault()}
				onClick={() => widget?.toggleHidden(binding.id)}
				// Instead of opening the widget's menu
				onContextMenu={
					item.icon === undefined
						? (event) => {
								event.preventDefault();
								event.stopPropagation();
								setPickingColor(true);
							}
						: undefined
				}
			>
				{item.icon === undefined ? (
					<span
						className="size-3 rounded-full border-2"
						style={{ borderColor: item.color, background: binding.hidden ? undefined : item.color }}
					/>
				) : (
					<span className={cn('flex', binding.hidden && 'opacity-40')}>{item.icon}</span>
				)}
			</button>
			{item.icon === undefined && (
				<ColorPicker
					binding={binding}
					anchor={swatch}
					open={pickingColor}
					onOpenChange={setPickingColor}
					onPick={(color) => {
						widget?.setColor(binding.id, color);
						setPickingColor(false);
					}}
				/>
			)}
		</>
	);
}
