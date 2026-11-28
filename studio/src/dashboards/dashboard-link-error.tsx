import LinkIcon from 'lucide-react/icons/link';
import { BackToDashboards, PageEmptyState } from '@/components/page-empty-state';

export function DashboardLinkError({ description = 'The link is invalid or unsupported.' }: { description?: string }) {
	return (
		<PageEmptyState
			icon={<LinkIcon />}
			title="Couldn’t open dashboard link"
			description={description}
			actions={<BackToDashboards />}
		/>
	);
}
