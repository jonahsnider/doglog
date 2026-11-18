import { chartCount } from '@/theme/choices';
import type { WidgetBinding } from '@/widgets/widget-type';

/** Shared chart color for the entry drawn at `index` */
export function seriesColor(index: number): string {
	return `var(--chart-${(index % chartCount) + 1})`;
}

/** The chart color picked for a binding, or the one for the entry drawn at `index` */
export function bindingColor(binding: WidgetBinding, index: number): string {
	return seriesColor(binding.color ?? index);
}
