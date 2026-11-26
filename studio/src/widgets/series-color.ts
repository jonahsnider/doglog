import { chartCount } from '@/theme/choices';
import type { WidgetBinding } from '@/widgets/widget-type';

/** Shared series color for the entry drawn at `index` */
export function seriesColor(index: number, variant?: 'outline'): string {
	return `var(--series-${variant === 'outline' ? 'outline-' : ''}${(index % chartCount) + 1})`;
}

/** The series color picked for a binding, or the one for the entry drawn at `index` */
export function bindingColor(binding: WidgetBinding, index: number, variant?: 'outline'): string {
	return seriesColor(binding.color ?? index, variant);
}

/** Dash patterns of each source's lines, in CSS pixels, by position among the visible sources: solid, dashed, dotted, and dash-dot */
const sourceDashes: readonly (readonly number[])[] = [[], [6, 4], [1.5, 3], [8, 3, 1.5, 3]];

/** The dash pattern of lines from the visible source at `index`, empty for solid lines, see the widgets spec's several sources */
export function sourceDash(index: number): readonly number[] {
	return sourceDashes[index % sourceDashes.length]!;
}
