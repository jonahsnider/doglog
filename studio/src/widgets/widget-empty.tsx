import type { ReactNode } from 'react';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';

export function WidgetEmpty({
	icon,
	title,
	description,
	children,
}: {
	icon: ReactNode;
	title: string;
	description: string;
	/** Actions shown under the description */
	children?: ReactNode;
}) {
	return (
		<Empty className="min-h-full py-6 md:py-6">
			<EmptyHeader>
				<EmptyMedia variant="icon">{icon}</EmptyMedia>
				<EmptyTitle>{title}</EmptyTitle>
				<EmptyDescription>{description}</EmptyDescription>
			</EmptyHeader>
			{children !== undefined && <EmptyContent>{children}</EmptyContent>}
		</Empty>
	);
}
