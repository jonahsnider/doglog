import { RadioGroup, RadioPrimitive } from '@/components/ui/radio-group';
import { SegmentedControl, SegmentedControlItem } from '@/components/ui/segmented-control';
import { cn } from '@/lib/utils';

export type View = '2d' | '3d';

/** A control for a widget's View option, ex. the robot and field widgets. `compact` fits a row of `h-5` buttons. */
export function ViewToggle({
	view,
	onChange,
	compact = false,
	className,
}: {
	view: View;
	onChange: (view: View) => void;
	compact?: boolean;
	className?: string;
}) {
	const item = compact ? 'h-4 px-1.5 text-xs sm:h-4 sm:text-xs' : undefined;
	return (
		<SegmentedControl
			size="sm"
			className={cn('capture:invisible', className)}
			render={
				<RadioGroup
					aria-label="View"
					className="flex-row gap-0.5"
					value={view}
					onValueChange={(value: string) => onChange(value === '2d' ? '2d' : '3d')}
				/>
			}
		>
			<SegmentedControlItem className={item} render={<RadioPrimitive.Root value="2d" />}>
				2D
			</SegmentedControlItem>
			<SegmentedControlItem className={item} render={<RadioPrimitive.Root value="3d" />}>
				3D
			</SegmentedControlItem>
		</SegmentedControl>
	);
}
