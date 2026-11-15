import { createFileRoute, notFound } from '@tanstack/react-router';
import { LayoutGridIcon } from 'lucide-react';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { dashboards } from '@/dashboards';

export const Route = createFileRoute('/dashboards/$dashboardId')({
	loader: ({ params }) => {
		const dashboard = dashboards.find((dashboard) => dashboard.id === params.dashboardId);

		if (!dashboard) {
			throw notFound();
		}

		return dashboard;
	},
	component: DashboardView,
});

function DashboardView() {
	return (
		<div className="flex h-full flex-col">
			<div className="flex min-h-0 flex-1">
				<section aria-label="Panes" className="min-w-0 flex-1">
					<Empty className="h-full">
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<LayoutGridIcon />
							</EmptyMedia>
							<EmptyTitle>Add widget</EmptyTitle>
							<EmptyDescription>Widgets aren't available yet.</EmptyDescription>
						</EmptyHeader>
					</Empty>
				</section>
				<aside aria-label="Key browser" className="w-72 border-l p-3 text-sm text-muted-foreground">
					Key browser
				</aside>
			</div>
			<footer aria-label="Timeline" className="h-12 border-t px-3 text-sm leading-12 text-muted-foreground">
				Timeline
			</footer>
		</div>
	);
}
