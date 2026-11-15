import { createFileRoute } from '@tanstack/react-router';
import { FolderSyncIcon } from 'lucide-react';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';

export const Route = createFileRoute('/logs')({
	component: Logs,
});

function Logs() {
	return (
		<Empty className="h-full">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<FolderSyncIcon />
				</EmptyMedia>
				<EmptyTitle>Log sync is coming soon</EmptyTitle>
				<EmptyDescription>Syncing logs from your robot isn’t available yet.</EmptyDescription>
			</EmptyHeader>
		</Empty>
	);
}
