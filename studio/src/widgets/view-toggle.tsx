import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import type { StyleXStyles } from '@stylexjs/stylex';

export type View = '2d' | '3d';

/** A control for a widget's View option, ex. the robot and field widgets */
export function ViewToggle({
	view,
	onChange,
	xstyle,
}: {
	view: View;
	onChange: (view: View) => void;
	xstyle?: StyleXStyles;
}) {
	return (
		<SegmentedControl
			label="View"
			size="sm"
			value={view}
			onChange={(value) => onChange(value === '2d' ? '2d' : '3d')}
			className="capture-invisible"
			xstyle={xstyle}
		>
			<SegmentedControlItem value="2d" label="2D" />
			<SegmentedControlItem value="3d" label="3D" />
		</SegmentedControl>
	);
}
