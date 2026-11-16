import { Empty, EmptyTitle } from '@/components/ui/empty';
import { getWidgetType, widgetTypes } from '@/widgets/registry';
import type { WidgetType } from '@/widgets/widget-type';

/** Shown in empty panes */
export function AddWidgetPrompt({ onAdd }: { onAdd: (type: WidgetType) => void }) {
	return (
		<Empty
			// Without select-none, double-clicking selects text in the new widget
			className="h-full justify-start gap-4 overflow-auto p-4 select-none [container-type:size] [container-name:add-widget] md:p-4"
			onDoubleClick={(event) => {
				// Double-clicking a widget tile shouldn't also add the default widget
				if (!(event.target instanceof Element && event.target.closest('button'))) {
					onAdd(getWidgetType('discrete-timeline')!);
				}
			}}
		>
			<EmptyTitle className="add-widget-tiny:hidden">Add widget</EmptyTitle>
			<div className="grid w-full max-w-sm grid-cols-2 gap-3 add-widget-compact:max-w-56 add-widget-compact:grid-cols-1 add-widget-compact:gap-2">
				{widgetTypes.map((type) => (
					<button
						key={type.id}
						type="button"
						className="flex cursor-pointer flex-col gap-2 rounded-xl border bg-card p-2 text-sm text-muted-foreground outline-none transition-[border-color,box-shadow,color] hover:border-ring/50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background add-widget-compact:flex-row add-widget-compact:items-center add-widget-compact:justify-center add-widget-compact:px-3"
						onClick={() => onAdd(type)}
					>
						<div className="flex aspect-16/10 items-center justify-center rounded-md border bg-muted/50 add-widget-compact:contents">
							<type.icon className="size-8 shrink-0 add-widget-compact:size-4" />
						</div>
						<span className="pb-0.5 text-center add-widget-compact:pb-0">{type.name}</span>
					</button>
				))}
			</div>
		</Empty>
	);
}
