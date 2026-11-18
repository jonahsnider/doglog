import { Columns2Icon, Maximize2Icon, Minimize2Icon, Rows2Icon } from 'lucide-react';
import { shortcuts } from '@/commands/commands';
import { PaneButton } from '@/panes/pane-button';
import type { SplitDirection } from '@/panes/layout';

/** Splitting is hidden while zoomed since it would restore the other panes */
export function PaneLayoutButtons({
	canSplitRight,
	canSplitDown,
	canZoom,
	zoomed,
	onSplit,
	onZoom,
}: {
	canSplitRight: boolean;
	canSplitDown: boolean;
	canZoom: boolean;
	zoomed: boolean;
	onSplit: (direction: SplitDirection) => void;
	onZoom: () => void;
}) {
	return (
		<>
			{!zoomed && (
				<>
					<PaneButton
						label="Split right"
						shortcut={shortcuts.splitRight}
						disabled={!canSplitRight}
						onClick={() => onSplit('row')}
					>
						<Columns2Icon />
					</PaneButton>
					<PaneButton
						label="Split down"
						shortcut={shortcuts.splitDown}
						disabled={!canSplitDown}
						onClick={() => onSplit('column')}
					>
						<Rows2Icon />
					</PaneButton>
				</>
			)}
			<PaneButton
				label={zoomed ? 'Restore pane' : 'Zoom pane'}
				shortcut={shortcuts.zoom}
				disabled={!canZoom}
				pressed={zoomed}
				onClick={onZoom}
			>
				{zoomed ? <Minimize2Icon /> : <Maximize2Icon />}
			</PaneButton>
		</>
	);
}
