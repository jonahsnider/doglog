import type { ReactNode } from 'react';
import { dragRegion } from '@/desktop/title-bar';
import { Frame, FrameHeader, FrameTitle } from './ui/frame';

export function UtilityPage({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
	return (
		<div className="flex-1 overflow-y-auto px-6 scrollbar-gutter-both">
			<div className="mx-auto flex min-h-full max-w-4xl flex-col pb-6">
				<header {...dragRegion} className="sticky top-0 z-10 flex flex-wrap items-center gap-2 bg-background py-6">
					<h1 className="font-heading text-2xl font-semibold">{title}</h1>
					{actions !== undefined && <div className="ms-auto flex flex-wrap justify-end gap-2">{actions}</div>}
				</header>
				{children}
			</div>
		</div>
	);
}

export function UtilityPageSection({ title, children }: { title: string; children: ReactNode }) {
	return (
		<Frame>
			<FrameHeader>
				<FrameTitle>
					<h2 className="font-heading text-base leading-none">{title}</h2>
				</FrameTitle>
			</FrameHeader>
			{children}
		</Frame>
	);
}
