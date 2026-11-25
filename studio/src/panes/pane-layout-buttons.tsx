import Columns2Icon from 'lucide-react/icons/columns-2';
import Maximize2Icon from 'lucide-react/icons/maximize-2';
import Minimize2Icon from 'lucide-react/icons/minimize-2';
import Rows2Icon from 'lucide-react/icons/rows-2';
import { shortcuts } from '@/commands/commands';
import { PaneButton } from '@/panes/pane-button';
import type { SplitDirection } from '@/panes/layout';

/** Splitting is hidden while zoomed since it would restore the other panes, and for panes that aren't `splittable` */
export function PaneLayoutButtons({
	splittable,
	canSplitRight,
	canSplitDown,
	canZoom,
	zoomed,
	onSplit,
	onZoom,
}: {
	splittable: boolean;
	canSplitRight: boolean;
	canSplitDown: boolean;
	canZoom: boolean;
	zoomed: boolean;
	onSplit: (direction: SplitDirection) => void;
	onZoom: () => void;
}) {
	return (
		<>
			{splittable && !zoomed && (
				<>
					<PaneButton
						label="Split right"
						shortcut={shortcuts.splitRight}
						disabled={!canSplitRight}
						onClick={() => onSplit('row')}
						icon={Columns2Icon}
					/>
					<PaneButton
						label="Split down"
						shortcut={shortcuts.splitDown}
						disabled={!canSplitDown}
						onClick={() => onSplit('column')}
						icon={Rows2Icon}
					/>
				</>
			)}
			<PaneButton
				label={zoomed ? 'Restore pane' : 'Zoom pane'}
				shortcut={shortcuts.zoom}
				disabled={!canZoom}
				pressed={zoomed}
				onClick={onZoom}
				icon={zoomed ? Minimize2Icon : Maximize2Icon}
			/>
		</>
	);
}
