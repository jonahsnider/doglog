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
