import {
	colorVars,
	fontWeightVars,
	radiusVars,
	spacingVars,
	typeScaleVars,
} from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import FileUpIcon from 'lucide-react/icons/file-up';
import { useRef, useState } from 'react';
import { useEventListener } from 'usehooks-ts';
import { draggedFileType, handleLogFileDrop, isLogFile } from '@/data/open-log';
import { useDraggedFile } from '@/desktop/file-drop';
import { isRobotConfig } from '@/three/robot-projects';

const styles = stylex.create({
	overlay: {
		pointerEvents: 'none',
		position: 'fixed',
		inset: spacingVars['--spacing-2'],
		zIndex: 50,
		display: 'flex',
		flexDirection: 'column',
		alignItems: 'center',
		justifyContent: 'center',
		gap: spacingVars['--spacing-2'],
		borderRadius: radiusVars['--radius-container'],
		borderWidth: 2,
		borderStyle: 'dashed',
		borderColor: colorVars['--color-accent'],
		backgroundColor: `color-mix(in srgb, ${colorVars['--color-accent']} 8%, transparent)`,
		fontSize: typeScaleVars['--text-label-size'],
		lineHeight: typeScaleVars['--text-label-leading'],
		fontWeight: fontWeightVars['--font-weight-medium'],
		backdropFilter: 'blur(4px)',
	},
	icon: {
		width: 24,
		height: 24,
		color: colorVars['--color-icon-accent'],
	},
});

/** Whether a path dragged over the desktop app may be a log, or a folder of them, which have no extension */
function isLogDrop(path: string): boolean {
	return isLogFile(path) || !path.split(/[/\\]/u).at(-1)!.includes('.');
}

/** Covers the window while a potential log file, or folder of them, is dragged over it */
export function LogDropOverlay() {
	const [dragging, setDragging] = useState(false);
	// The desktop app gets file drags from Tauri instead of the browser's drag events
	const draggedFile = useDraggedFile();

	// Entering a child element fires before leaving its parent, so count how deep the drag is
	const depth = useRef(0);

	useEventListener('dragenter', (event) => {
		if (event.dataTransfer?.types.includes('Files') === true) {
			depth.current++;
		}
	});
	useEventListener('dragover', (event) => {
		const transfer = event.dataTransfer;
		const type = draggedFileType(transfer);
		if (!transfer || type === undefined) {
			return;
		}
		// Unknown files may be logs, but don't show a log hint over a widget accepting the drag.
		const log =
			!event.defaultPrevented && (type === '' || type === 'application/x-wpilog' || type === 'application/x-wpilogxz');
		if (!event.defaultPrevented) {
			event.preventDefault();
			transfer.dropEffect = log ? 'copy' : 'none';
		}
		setDragging(log);
	});
	useEventListener('dragleave', (event) => {
		if (event.dataTransfer?.types.includes('Files') === true) {
			depth.current = Math.max(0, depth.current - 1);
			if (depth.current === 0) {
				setDragging(false);
			}
		}
	});
	useEventListener('drop', (event) => {
		depth.current = 0;
		setDragging(false);
		handleLogFileDrop(event);
	});

	const project = draggedFile !== undefined && isRobotConfig(draggedFile);
	if (!dragging && !project && !(draggedFile !== undefined && isLogDrop(draggedFile))) {
		return null;
	}

	return (
		<div {...stylex.props(styles.overlay)}>
			<FileUpIcon {...stylex.props(styles.icon)} />
			{project ? 'Drop to add robot project' : 'Drop to open log'}
		</div>
	);
}
