/** Shared chart color for the entry drawn at `index` */
export function seriesColor(index: number): string {
	return `var(--chart-${(index % 5) + 1})`;
}
