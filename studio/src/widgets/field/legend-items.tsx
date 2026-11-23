import BoxesIcon from 'lucide-react/icons/boxes';
import SplineIcon from 'lucide-react/icons/spline';
import type { Mechanism } from '@/data/mechanism';
import { fieldRobot, isRobotBinding } from '@/widgets/field/robots';
import { roles3d } from '@/widgets/field/roles';
import type { LegendItem } from '@/widgets/legend/legend';
import { bindingColor } from '@/widgets/series-color';
import type { WidgetBinding } from '@/widgets/widget-type';

// Like the robot widget's legend, parts and mechanisms aren't drawn in the binding's color
const mechanismIcon = <SplineIcon className="size-3.5" />;
const partsIcon = <BoxesIcon className="size-3.5" />;

/**
 * The field's legend in either view. In 3D, robots and ghosts show the robot they're drawn as, which can be picked
 * there, and how the camera follows them. Parts and mechanisms are marked "3D only" in 2D, and `notes` adds others, ex. a robot that isn't added on this
 * device.
 */
export function fieldLegendItems(
	bindings: readonly WidgetBinding[],
	{
		view,
		time,
		mechanisms,
		notes,
		followed,
	}: {
		view: '2d' | '3d';
		time: number | undefined;
		mechanisms: ReadonlyMap<string, Mechanism | undefined>;
		notes?: ReadonlyMap<string, string>;
		/** The binding the camera follows and how, see `FollowPicker`. Robots can be followed when it's set or `null`. */
		followed?: { id: string; key: string } | null | undefined;
	},
): LegendItem[] {
	return bindings.map((binding, index): LegendItem => {
		const only3d = binding.role !== undefined && roles3d.has(binding.role.id);
		const mechanism = binding.entry?.kind === 'mechanism2d';
		const value = mechanism
			? mechanisms.get(binding.name)
			: binding.entry && time !== undefined
				? binding.entry.samples.valueAt(time)
				: undefined;
		const note = view === '2d' && only3d && binding.entry !== undefined ? '3D only' : notes?.get(binding.id);
		return {
			binding,
			color: bindingColor(binding, index),
			...(only3d && { icon: mechanism ? mechanismIcon : partsIcon }),
			...(view === '3d' && isRobotBinding(binding) && { robot: fieldRobot(binding, bindings) }),
			...(followed !== undefined &&
				isRobotBinding(binding) && { follow: followed?.id === binding.id ? followed.key : 'off' }),
			dimmed: value === undefined,
			...(note !== undefined && { note }),
		};
	});
}
