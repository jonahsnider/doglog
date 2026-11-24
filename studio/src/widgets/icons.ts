import BotIcon from 'lucide-react/icons/bot';
import CameraIcon from 'lucide-react/icons/camera';
import ChartColumnIcon from 'lucide-react/icons/chart-column';
import ChartLineIcon from 'lucide-react/icons/chart-line';
import ClapperboardIcon from 'lucide-react/icons/clapperboard';
import Gamepad2Icon from 'lucide-react/icons/gamepad-2';
import NotebookPenIcon from 'lucide-react/icons/notebook-pen';
import TableIcon from 'lucide-react/icons/table';
import TerminalIcon from 'lucide-react/icons/terminal';
import type { ComponentType, SVGProps } from 'react';
import CompetitionFieldIcon from '@/widgets/field/competition-field.svg?react';
import SwerveDriveIcon from '@/widgets/swerve/swerve-drive.svg?react';
import type { WidgetTypeId } from '@/widgets/widget-info';

/**
 * Each widget type's icon, a Lucide icon or a single color SVG imported with `?react`. Kept apart from the widgets so
 * link preview images can draw them without the widgets' code, see `@/link-previews/preview-image`.
 */
export const widgetIcons: Record<WidgetTypeId, ComponentType<SVGProps<SVGSVGElement>>> = {
	graph: ChartLineIcon,
	histogram: ChartColumnIcon,
	field: CompetitionFieldIcon,
	robot: BotIcon,
	table: TableIcon,
	console: TerminalIcon,
	swerve: SwerveDriveIcon,
	controller: Gamepad2Icon,
	notepad: NotebookPenIcon,
	video: ClapperboardIcon,
	camera: CameraIcon,
};
