import { Kbd } from '@/components/ui/kbd';

export function GraphControls() {
	return (
		<dl
			aria-label="Graph controls"
			className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3 gap-y-1 text-start text-wrap text-muted-foreground text-xs capture:hidden"
		>
			<dt className="font-medium text-foreground">Seek</dt>
			<dd>Click or tap</dd>
			<dt className="font-medium text-foreground">Measure</dt>
			<dd>Drag left or right</dd>
			<dt className="font-medium text-foreground">Pan</dt>
			<dd>
				<Kbd>Shift</Kbd> + drag or scroll sideways
			</dd>
			<dt className="font-medium text-foreground">Zoom time</dt>
			<dd>Scroll or pinch on a trackpad</dd>
			<dt className="font-medium text-foreground">Zoom Y</dt>
			<dd>
				Scroll over the axis or <Kbd>Shift</Kbd> + scroll in the plot
			</dd>
		</dl>
	);
}
